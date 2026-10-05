import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'js-yaml';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { FSMEngine } from '../core/fsm-engine.js';
import { EventStore } from '../core/event-store.js';
import { JobManager } from '../core/job-manager.js';
import { SkillManifestSchema } from '../core/types.js';
import { ContextRouter } from '../core/context-router.js';
import { discoverContextCandidates, readSkillMetadata } from '../core/context-candidate-discovery.js';
import {
  getRuntimeCapabilities,
  RUNTIME_VERSION,
} from '../core/runtime-capabilities.js';
import { getReactiveBootloader } from '../core/bootloader.js';

export interface ReactiveMcpServerOptions {
  workspaceDir?: string;
  defaultSkill?: string;
}

export function createReactiveMcpServer(options: ReactiveMcpServerOptions = {}): McpServer {
  const workspaceDir = options.workspaceDir || process.cwd();
  let defaultSkill = options.defaultSkill || 'test-fsm';

  const server = new McpServer({
    name: 'reactive-skills-server',
    version: RUNTIME_VERSION,
  });

  const contextRouter = new ContextRouter();
  const contextCandidateSchema = z.object({
    id: z.string().min(1),
    skill: z.string().min(1),
    summary: z.string().min(1),
    keywords: z.array(z.string()).optional(),
  });

  // Cached active engine instance per skill and job
  const engines = new Map<string, FSMEngine>();

  function normalizeDeliverableName(name: string): string | null {
    const trimmed = String(name || '').trim();
    if (!trimmed || trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
      return null;
    }
    if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) {
      return null;
    }
    return trimmed;
  }

  function findSkillDir(skillName: string): string | undefined {
    if (!/^[A-Za-z0-9._-]+$/.test(skillName)) return undefined;

    const candidatePaths = [
      path.resolve(workspaceDir, 'skills', skillName),
      path.resolve(workspaceDir, 'skills', `_${skillName}_skill`),
      path.resolve(workspaceDir, skillName),
      path.resolve(workspaceDir, '..', 'skills', skillName),
      path.join(os.homedir(), '.agents', 'skills', skillName),
      path.join(os.homedir(), '.gemini', 'config', 'skills', skillName),
      path.join(os.homedir(), '.kilocode', 'skills', skillName),
      path.join(os.homedir(), '.codex', 'skills', skillName),
    ];

    const directPath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath));
    if (directPath) return directPath;

    const skillsRoot = path.resolve(workspaceDir, 'skills');
    if (!fs.existsSync(skillsRoot)) return undefined;

    for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidateDir = path.join(skillsRoot, entry.name);
      for (const fileName of ['skill.yaml', 'skill.yml']) {
        const manifestPath = path.join(candidateDir, fileName);
        if (!fs.existsSync(manifestPath)) continue;
        try {
          const parsed = yaml.load(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
          if (parsed?.name === skillName) return candidateDir;
        } catch {
          // Ignore invalid manifests during local skill lookup.
        }
      }
    }

    return undefined;
  }

  function getEngine(
    skillName: string = defaultSkill,
    jobId?: string,
    options: { autoRotateTerminal?: boolean } = {}
  ): FSMEngine {
    const jobManager = new JobManager(workspaceDir);
    let resolvedJobId = jobId;
    if (!resolvedJobId) {
      if (options.autoRotateTerminal) {
        const rotation = jobManager.rotateIfTerminal(skillName);
        if (rotation.rotated && rotation.previousJobId) {
          const previousKey = `${skillName}::${rotation.previousJobId}`;
          const previousEngine = engines.get(previousKey);
          previousEngine?.close();
          engines.delete(previousKey);
        }
        resolvedJobId = rotation.activeJobId;
      } else {
        resolvedJobId = jobManager.getActiveJobId(skillName);
      }
    }
    const cacheKey = `${skillName}::${resolvedJobId}`;

    if (engines.has(cacheKey)) {
      const cached = engines.get(cacheKey)!;
      // Rebuild when another process moved the run, for example an approval in the user's terminal.
      if (fs.existsSync(cached.getSkillDir()) && !cached.hasExternalChanges()) {
        return cached;
      }
      // Not closed: an in-flight call may still be using it, and it refuses stale writes itself.
      // ponytail: a replaced engine's SQLite handle stays open until it is collected; refcount if churn grows.
      engines.delete(cacheKey);
    }

    const skillDir = findSkillDir(skillName);

    if (!skillDir) {
      throw new Error(`Skill '${skillName}' not found in workspace or global registry.`);
    }

    const engine = new FSMEngine({
      skillDir,
      workspaceDir,
      jobId: resolvedJobId,
    });
    engines.set(cacheKey, engine);
    return engine;
  }

  server.tool(
    'reactive_capabilities',
    'Get runtime version and capabilities for one-time INIT transport negotiation',
    {},
    async () => {
      const capabilities = await getRuntimeCapabilities({
        transport: 'mcp',
        launcher: 'persistent',
        scope: 'local',
        workspace: workspaceDir,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(capabilities, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'reactive_bootloader',
    'Get the authoritative runtime bootloader for a reactive skill',
    {
      skill_name: z.string().min(1).regex(/^[A-Za-z0-9._-]+$/).describe('Reactive skill name'),
    },
    async ({ skill_name }) => {
      try {
        return {
          content: [{ type: 'text', text: JSON.stringify(getReactiveBootloader(skill_name), null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'reactive_context_route',
    'Use Jev to select the smallest useful skill and context slice before prompt assembly',
    {
      user_message: z.string().min(1).describe('Current user task or message'),
      candidates: z.array(contextCandidateSchema).optional().describe('Optional skill metadata; omit to use local manifest discovery'),
      token_budget: z.number().int().min(128).max(32768).optional().describe('Maximum context tokens for selected route'),
      state_hints: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe('Small bounded state hints'),
    },
    async ({ user_message, candidates, token_budget, state_hints }) => {
      try {
        const decision = await contextRouter.route({
          userMessage: user_message,
          candidates: candidates || discoverContextCandidates(user_message, workspaceDir),
          tokenBudget: token_budget,
          stateHints: state_hints,
        });
        return { content: [{ type: 'text', text: JSON.stringify(decision, null, 2) }] };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'reactive_context_prepare',
    'Route with Jev, then load only the selected skill context before prompt assembly',
    {
      user_message: z.string().min(1).describe('Current user task or message'),
      candidates: z.array(contextCandidateSchema).optional().describe('Optional skill metadata; omit to use local skill discovery'),
      token_budget: z.number().int().min(128).max(32768).optional().describe('Maximum context tokens for selected route'),
      state_hints: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe('Small bounded state hints'),
      job_id: z.string().optional().describe('Optional job/run ID for a selected reactive skill'),
    },
    async ({ user_message, candidates, token_budget, state_hints, job_id }) => {
      try {
        const decision = await contextRouter.route({
          userMessage: user_message,
          candidates: candidates || discoverContextCandidates(user_message, workspaceDir),
          tokenBudget: token_budget,
          stateHints: state_hints,
        });

        if (decision.route !== 'skill' || !decision.skill) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ context_route: decision, context: null }, null, 2),
            }],
          };
        }

        const skillDir = findSkillDir(decision.skill);
        if (!skillDir) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                context_route: decision,
                context: { status: 'unavailable', reason: 'skill_not_found' },
              }, null, 2),
            }],
          };
        }

        const metadata = readSkillMetadata(skillDir, decision.skill)
          ?? { skill: decision.skill, summary: `Instructions for ${decision.skill}` };
        if (decision.context_mode === 'metadata') {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                context_route: decision,
                context: {
                  status: 'ready',
                  source: 'skill_metadata',
                  skill: metadata.skill,
                  summary: metadata.summary,
                },
              }, null, 2),
            }],
          };
        }

        try {
          const hasReactiveManifest = ['skill.yaml', 'skill.yml']
            .some((fileName) => fs.existsSync(path.join(skillDir, fileName)));
          if (!hasReactiveManifest) throw new Error('No reactive skill manifest');

          const engine = getEngine(decision.skill, job_id, { autoRotateTerminal: true });
          if (engine.isBypassDetected()) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  context_route: decision,
                  context: {
                    status: 'unavailable',
                    source: 'reactive_state',
                    reason: 'bypass_detected',
                    recovery: `Run reactive-skills-axi reset ${engine.getManifest().name} then re-invoke.`,
                  },
                }, null, 2),
              }],
              isError: true,
            };
          }

          if (engine.isStrictExecution()) engine.recordTurnStart();
          const slice = engine.generatePromptSlice();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                context_route: decision,
                context: {
                  status: 'ready',
                  source: 'reactive_state',
                  skill: engine.getManifest().name,
                  job_id: engine.getJobName() || engine.getJobId(),
                  run_id: engine.getJobId(),
                  activeState: engine.getCurrentState(),
                  promptSlice: slice.rawPrompt,
                  formattedXml: slice.formattedXml,
                  allowedTools: slice.allowedTools,
                  scopedContext: slice.scopedContext,
                  contextDelta: slice.contextDelta,
                },
              }, null, 2),
            }],
          };
        } catch (reactiveError) {
          const skillMdPath = path.join(skillDir, 'SKILL.md');
          if (!fs.existsSync(skillMdPath)) throw reactiveError;

          const maxChars = Math.max(512, decision.context_budget_tokens * 4);
          const raw = fs.readFileSync(skillMdPath, 'utf8');
          const truncated = raw.length > maxChars;
          const content = truncated
            ? `${raw.slice(0, maxChars)}\n[context truncated at routed budget]`
            : raw;
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                context_route: decision,
                context: {
                  status: 'ready',
                  source: 'skill_markdown',
                  skill: metadata.skill,
                  content,
                  truncated,
                },
              }, null, 2),
            }],
          };
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  // 1. TOOL: reactive_state
  server.tool(
    'reactive_state',
    'Get current state, prompt slice, and allowed tools for the active reactive skill',
    {
      skill: z.string().optional().describe('Skill name (defaults to active skill)'),
      job_id: z.string().optional().describe('Optional job/run ID (defaults to active job)'),
    },
    async ({ skill, job_id }) => {
      try {
        const engine = getEngine(skill || defaultSkill, job_id, { autoRotateTerminal: true });

        if (engine.isBypassDetected()) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'BYPASS_DETECTED: The runtime has auto-aborted this skill. Agent exceeded idle turns without emitting a signal.',
                    recovery: 'Run reactive-skills-axi reset ' + engine.getManifest().name + ' then re-invoke.',
                    strict_execution: engine.isStrictExecution(),
                    turns_since_last_signal: engine.getTurnsSinceLastSignal(),
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        if (engine.isStrictExecution()) {
          engine.recordTurnStart();
        }
        const slice = engine.generatePromptSlice();
        const activeState = engine.getCurrentState();
        const isWaiting = engine.isWaitingForHuman();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                   skill: engine.getManifest().name,
                   job_id: engine.getJobName() || engine.getJobId(),
                   run_id: engine.getJobId(),
                   activeState,
                   isWaitingForHuman: isWaiting,
                   allowedTools: slice.allowedTools,
                   promptSlice: slice.rawPrompt,
                   formattedXml: slice.formattedXml,
                   context: engine.getContext(),
                   scopedContext: slice.scopedContext,
                   contextDelta: slice.contextDelta,
                   isRevisit: !!slice.contextDelta?.is_revisit,
                   strict_execution: engine.isStrictExecution(),
                   turns_since_last_signal: engine.getTurnsSinceLastSignal(),
                 },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        if (err.message?.startsWith('BYPASS_DETECTED')) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: err.message, recovery: 'Run reactive-skills-axi reset ' + (err.message.split('reset ')[1]?.split(' ')[0] || 'skill') + ' then re-invoke.' }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  // 2. TOOL: reactive_emit_signal
  server.tool(
    'reactive_emit_signal',
    'Emit an event signal into the reactive bus, evaluating transition guards and updating deliverable projections',
    {
      signal: z.string().describe('Signal name (e.g. CHECK_PASSED, CHARTER_DRAFTED)'),
      payload: z.record(z.any()).optional().describe('Signal payload data (e.g. exit_code, file_path)'),
      skill: z.string().optional().describe('Target skill name'),
      job_id: z.string().optional().describe('Optional job/run ID (defaults to active job)'),
      idempotency_key: z.string().optional().describe('Optional key that makes duplicate signal submission a no-op'),
    },
    async ({ signal, payload = {}, skill, job_id, idempotency_key }) => {
      try {
        const engine = getEngine(skill || defaultSkill, job_id);
        const result = await engine.handleSignal(signal, payload, { idempotencyKey: idempotency_key, source: 'mcp' });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  skill: engine.getManifest().name,
                  job_id: engine.getJobName() || engine.getJobId(),
                  run_id: engine.getJobId(),
                  transitioned: result.transitioned,
                  previousState: result.previousState,
                  newState: result.newState,
                  isWaitingForHuman: engine.isWaitingForHuman(),
                  projectionsWritten: result.deliverablesWritten,
                  refusalReason: result.refusalReason,
                  judgmentBasis: result.judgmentBasis,
                  warning: result.warning,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  // 3. TOOL: reactive_query (SQL on events.db)
  server.tool(
    'reactive_query',
    'Execute a read-only SQL query against the SQLite event store (.reactive/events.db)',
    {
      sql: z.string().describe('SQL query string (e.g. SELECT * FROM events ORDER BY seq DESC LIMIT 10)'),
      skill: z.string().optional().describe('Skill context for event store'),
      job_id: z.string().optional().describe('Optional job/run ID (defaults to active job)'),
    },
    async ({ sql, skill, job_id }) => {
      try {
        const engine = getEngine(skill || defaultSkill, job_id);
        const driver = engine.getEventStore().getSqliteDriver();
        if (!driver) {
          throw new Error('SQLite storage driver is not active.');
        }

        const rows = driver.querySql(sql);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(rows, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  // Typed query surface for normal event inspection; raw SQL remains a legacy read-only escape hatch.
  server.tool(
    'reactive_query_events',
    'Query events with bounded typed filters from the selected skill store',
    {
      type: z.string().optional().describe('Event type filter'),
      state: z.string().optional().describe('State filter'),
      sinceSeq: z.number().int().nonnegative().optional().describe('Return events after this sequence'),
      limit: z.number().int().positive().max(1000).optional().describe('Maximum number of events'),
      skill: z.string().optional().describe('Skill context for event store'),
      job_id: z.string().optional().describe('Optional job/run ID (defaults to active job)'),
    },
    async ({ type, state, sinceSeq, limit, skill, job_id }) => {
      try {
        const engine = getEngine(skill || defaultSkill, job_id);
        const rows = engine.getEventStore().query({ type, state, sinceSeq, limit });
        return {
          content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  // 4. TOOL: reactive_list_skills
  server.tool(
    'reactive_list_skills',
    'List all available reactive skills in the workspace and global registry',
    {},
    async () => {
      const skillsFound: Array<{ name: string; path: string; type: string; statesCount: number }> = [];

      const searchDirs = [
        path.resolve(workspaceDir, 'skills'),
        path.join(os.homedir(), '.agents', 'skills'),
        path.join(os.homedir(), '.gemini', 'config', 'skills'),
      ];

      const seen = new Set<string>();

      for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory() || seen.has(entry.name)) continue;

          const skillYamlPath = path.join(dir, entry.name, 'skill.yaml');
          if (fs.existsSync(skillYamlPath)) {
            try {
              const rawManifest = yaml.load(fs.readFileSync(skillYamlPath, 'utf8'));
              const manifest = SkillManifestSchema.parse(rawManifest);
              skillsFound.push({
                name: manifest.name,
                path: path.join(dir, entry.name),
                type: 'reactive',
                statesCount: Object.keys(manifest.states).length,
              });
              seen.add(entry.name);
            } catch {
              // Ignore invalid manifests
            }
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(skillsFound, null, 2),
          },
        ],
      };
    }
  );

  // 5. TOOL: reactive_inspect
  server.tool(
    'reactive_inspect',
    'Inspect the full statechart, transitions, and guard criteria of a reactive skill',
    {
      skill: z.string().optional().describe('Skill name to inspect'),
      job_id: z.string().optional().describe('Optional job/run ID (defaults to active job)'),
    },
    async ({ skill, job_id }) => {
      try {
        const engine = getEngine(skill || defaultSkill, job_id);
        const manifest = engine.getManifest();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(manifest, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  // 6. TOOL: reactive_invoke_skill
  server.tool(
    'reactive_invoke_skill',
    'Invoke a child reactive skill or legacy SKILL.md, recording parent/child event provenance',
    {
      skill: z.string().describe('Skill name or path to invoke'),
    },
    async ({ skill }) => {
      try {
        const engine = getEngine();
        const result = await engine.invokeSkill(skill);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  invoked: true,
                  skillId: result.skillId,
                  currentState: result.currentState,
                  promptSlice: result.promptSlice.rawPrompt,
                  allowedTools: result.promptSlice.allowedTools,
                  exitConditions: result.promptSlice.exitConditions,
                  eventId: result.event.id,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  // 7. TOOL: reactive_respond_human
  server.tool(
    'reactive_respond_human',
    'Submit user approval or feedback to unpause a Human-in-the-Loop (HITL) gate',
    {
      choice: z.string().describe('User selected choice (e.g. Approve Plan)'),
      approved: z.boolean().optional().describe('Explicit approval boolean flag'),
      feedback: z.string().optional().describe('Optional feedback text'),
      skill: z.string().optional().describe('Target skill name'),
      job_id: z.string().optional().describe('Optional job/run ID (defaults to active job)'),
    },
    async ({ choice, approved = true, feedback, skill, job_id }) => {
      try {
        const engine = getEngine(skill || defaultSkill, job_id);
        const signalsEmitted: string[] = [];
        let transitioned = false;
        let deliverablesWritten: string[] = [];

        if (feedback) {
          engine.updateContext({ user_feedback: feedback });
        }
        if (choice) {
          engine.updateContext({ user_choice: choice });
        }
        if (choice || feedback) {
          engine.recordDecision({
            choice: choice || '',
            feedback,
            approved,
          });
        }

        const dispatch = async (signalName: string, payload: Record<string, any>) => {
          signalsEmitted.push(signalName);
          const res = await engine.handleSignal(signalName, payload, { source: 'human_ingress' });
          if (res.transitioned) transitioned = true;
          if (res.deliverablesWritten.length > 0) deliverablesWritten.push(...res.deliverablesWritten);
        };

        const responseData = { choice, approved, feedback };
        await dispatch('USER_RESPONSE', responseData);

        if (approved === true || (choice && /approve|yes|accept|confirm|proceed/i.test(choice))) {
          await dispatch('USER_APPROVED', responseData);
        } else if (approved === false || (choice && /reject|no|abort|cancel/i.test(choice))) {
          await dispatch('USER_REJECTED', responseData);
        } else if (choice && /revision|change|modify|fix/i.test(choice)) {
          await dispatch('USER_REVISION_REQUESTED', responseData);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  unpaused: true,
                  transitioned,
                  currentState: engine.getCurrentState(),
                  projectionsWritten: deliverablesWritten,
                  signalsEmitted,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  // 7. TOOL: reactive_migrate
  server.tool(
    'reactive_migrate',
    'Retroactively upgrade an existing project workspace to the latest Event Modeling and CQRS schema standards',
    {
      targetDir: z.string().optional().describe('Project directory path (defaults to current workspace)'),
    },
    async ({ targetDir }) => {
      try {
        const resolved = targetDir ? path.resolve(workspaceDir, targetDir) : workspaceDir;
        const relative = path.relative(workspaceDir, resolved);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: `targetDir escapes workspace directory: ${targetDir}` }) }],
            isError: true,
          };
        }

        if (fs.existsSync(resolved)) {
          const realWorkspace = fs.existsSync(workspaceDir) ? fs.realpathSync(workspaceDir) : workspaceDir;
          const realResolved = fs.realpathSync(resolved);
          const realRel = path.relative(realWorkspace, realResolved);
          if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
            return {
              content: [{ type: 'text', text: JSON.stringify({ error: `targetDir escapes workspace directory: ${targetDir}` }) }],
              isError: true,
            };
          }
        }

        const { ProjectMigrator } = await import('../core/migration.js');
        const result = ProjectMigrator.migrate(resolved);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  // 9. TOOL: reactive_list_jobs
  server.tool(
    'reactive_list_jobs',
    'List all historical and active execution jobs for a skill with status metadata',
    {
      skill: z.string().optional().describe('Skill name (defaults to active skill)'),
    },
    async ({ skill }) => {
      try {
        const targetSkill = skill || defaultSkill;
        const jobManager = new JobManager(workspaceDir);
        const activeJobId = jobManager.getActiveJobId(targetSkill);
        const jobs = jobManager.listJobs(targetSkill).map(j => ({
          ...j,
          id: j.name,
          run_id: j.id,
          isActive: j.id === activeJobId,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  skill: targetSkill,
                  activeJobId,
                  jobs,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  // 10. TOOL: reactive_switch_job
  server.tool(
    'reactive_switch_job',
    'Switch the active execution job pointer for a reactive skill and synchronize deliverables',
    {
      skill: z.string().optional().describe('Name of the reactive skill (defaults to active skill)'),
      job_id: z.string().describe('Target job ID to set as active'),
    },
    async ({ skill, job_id }) => {
      try {
        const skillName = skill || defaultSkill;
        const jobManager = new JobManager(workspaceDir);
        const job = jobManager.getJob(skillName, job_id);
        if (!job) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: `Job '${job_id}' not found for skill '${skillName}'` }) }],
            isError: true,
          };
        }

        jobManager.setActiveJobId(skillName, job_id);

        // Re-mirror deliverables: copy archive deliverables to root if they exist
        const docsDir = path.join(workspaceDir, '.docs', skillName);
        const archiveDir = path.join(docsDir, 'jobs', job_id);
        let mirroredCount = 0;

        if (fs.existsSync(archiveDir)) {
          const files = fs.readdirSync(archiveDir);
          for (const file of files) {
            const src = path.join(archiveDir, file);
            if (fs.statSync(src).isFile()) {
              const dest = path.join(docsDir, file);
              fs.copyFileSync(src, dest);
              mirroredCount++;
            }
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  skill: skillName,
                  activeJobId: job_id,
                  status: job.status,
                  currentState: job.currentState,
                  mirroredDeliverables: mirroredCount,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  // 11. TOOL: reactive_archive_job
  server.tool(
    'reactive_archive_job',
    'Archive an execution job for a reactive skill and rotate active pointer if archived was active',
    {
      skill: z.string().optional().describe('Name of the reactive skill (defaults to active skill)'),
      job_id: z.string().optional().describe('Job ID to archive (defaults to active job)'),
    },
    async ({ skill, job_id }) => {
      try {
        const skillName = skill || defaultSkill;
        const jobManager = new JobManager(workspaceDir);
        const targetId = job_id || jobManager.getActiveJobId(skillName);
        const currentActive = jobManager.getActiveJobId(skillName);

        const job = jobManager.getJob(skillName, targetId);
        if (!job) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: `Job '${targetId}' not found for skill '${skillName}'` }) }],
            isError: true,
          };
        }

        jobManager.updateJob(skillName, targetId, {
          status: 'archived',
          completedAt: new Date().toISOString(),
        });

        let freshJobId = currentActive;
        if (currentActive === targetId) {
          const freshJob = jobManager.createJob(skillName, { setActive: true });
          freshJobId = freshJob.id;
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  skill: skillName,
                  archivedJobId: targetId,
                  status: 'archived',
                  activeJobId: freshJobId,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  // 12. TOOL: reactive_reset
  server.tool(
    'reactive_reset',
    'Reset a reactive skill session, archive completed/stuck jobs, and rotate to a fresh run',
    {
      skill: z.string().optional().describe('Skill name (defaults to active skill)'),
      purge: z.boolean().optional().describe('Permanently delete all events and jobs rather than archiving'),
    },
    async ({ skill, purge }) => {
      try {
        const skillName = skill || defaultSkill;
        const jobManager = new JobManager(workspaceDir);
        const reactiveDir = path.join(workspaceDir, '.reactive', 'skills', skillName);

        for (const [key] of engines.entries()) {
          if (key.startsWith(`${skillName}::`)) {
            engines.delete(key);
          }
        }

        if (purge) {
          if (fs.existsSync(reactiveDir)) {
            fs.rmSync(reactiveDir, { recursive: true, force: true });
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    skill: skillName,
                    status: 'purged',
                    message: `Purged all historical data for ${skillName}. Call reactive_state to start a fresh run.`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const activeJobId = jobManager.getActiveJobId(skillName);
        jobManager.updateJob(skillName, activeJobId, {
          status: 'archived',
          completedAt: new Date().toISOString(),
        });

        const freshJob = jobManager.createJob(skillName, { setActive: true });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  skill: skillName,
                  status: 'archived_and_rotated',
                  archived_job: activeJobId,
                  fresh_job: freshJob.id,
                  message: `Archived job '${activeJobId}' and rotated to fresh job '${freshJob.id}'. Call reactive_state to proceed.`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  // 13. TOOL: reactive_sync
  server.tool(
    'reactive_sync',
    'Copy skills from ordered sources into a physical central directory, then link or copy them to agent satellites',
    {
      skill: z.string().optional().describe('Skill name to sync (optional, syncs all skills if omitted)'),
      link: z.boolean().optional().describe('Use directory junctions / symlinks for zero-drift live editing (default: true)'),
      copy: z.boolean().optional().describe('Force physical copy instead of junctions (default: false)'),
      dryRun: z.boolean().optional().describe('Preview sync actions without touching disk (default: false)'),
      source: z.string().optional().describe('Custom source directory (optional)'),
      target: z.string().optional().describe('Custom target directory (optional)'),
      central: z.string().optional().describe('Physical central skill directory (optional)'),
      config: z.string().optional().describe('Sync config file (optional)'),
      physicalTargets: z.array(z.string()).optional().describe('Satellites that require physical copies'),
      showConfig: z.boolean().optional().describe('Show resolved sync configuration without writing'),
    },
    async ({ skill, link = true, copy = false, dryRun = false, source, target, central, config, physicalTargets, showConfig = false }) => {
      try {
        const syncArgs: string[] = [];
        if (skill) {
          syncArgs.push('--skill', skill);
        }
        if (copy) {
          syncArgs.push('--copy');
        } else if (link) {
          syncArgs.push('--link');
        }
        if (dryRun) {
          syncArgs.push('--dry-run');
        }
        if (source) {
          syncArgs.push('--source', source);
        }
        if (target) {
          syncArgs.push('--target', target);
        }
        if (central) syncArgs.push('--central', central);
        if (config) syncArgs.push('--config', config);
        for (const physicalTarget of physicalTargets ?? []) syncArgs.push('--physical-target', physicalTarget);
        if (showConfig) syncArgs.push('--show-config');
        syncArgs.push('--json');

        const { syncEngineCommand } = await import('../sync/cli.js');
        const jsonOutput = await syncEngineCommand(syncArgs);
        let report: any;
        try {
          report = JSON.parse(jsonOutput);
        } catch {
          report = { output: jsonOutput };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(report, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  // RESOURCE 1: reactive://events
  server.resource(
    'reactive-events',
    'reactive://events',
    async (uri) => {
      const store = new EventStore({ enableSqlite: true });
      const events = store.getAll();
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(events, null, 2),
            mimeType: 'application/json',
          },
        ],
      };
    }
  );

  // RESOURCE 2: reactive://deliverables/{name}
  server.resource(
    'reactive-deliverable',
    new ResourceTemplate('reactive://deliverables/{name}', { list: undefined }),
    async (uri, { name }) => {
      const rawName = Array.isArray(name) ? name[0] : name;
      const safeName = normalizeDeliverableName(rawName || '');
      if (!safeName) {
        return {
          contents: [
            {
              uri: uri.href,
              text: '# Invalid deliverable name',
              mimeType: 'text/markdown',
            },
          ],
        };
      }

      const docCandidates = [
        path.resolve(workspaceDir, '.docs', `${safeName}.md`),
        path.resolve(workspaceDir, `${safeName}.md`),
      ];

      const docPath = docCandidates.find(p => fs.existsSync(p));
      const content = docPath ? fs.readFileSync(docPath, 'utf8') : `# Deliverable ${safeName} Not Found`;

      return {
        contents: [
          {
            uri: uri.href,
            text: content,
            mimeType: 'text/markdown',
          },
        ],
      };
    }
  );

  return server;
}

export async function runMcpServer(options: ReactiveMcpServerOptions = {}): Promise<void> {
  const server = createReactiveMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Stdio transport handles process.stdin/stdout directly
}
