import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'js-yaml';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { EvidenceMediaTypeSchema, EvidenceReceiptSchema } from '../core/evidence-store.js';
import { EvidenceBindingsSchema, importEvidence, inlineEvidenceBindings, readEvidence, submitEvidenceSignal } from '../core/evidence-submission.js';
import { FSMEngine } from '../core/fsm-engine.js';
import { EventStore } from '../core/event-store.js';
import { JobManager } from '../core/job-manager.js';
import { SkillManifestSchema } from '../core/types.js';
import { inspectTransitionGuard } from '../core/payload-contract.js';
import { ContextRouter } from '../core/context-router.js';
import { discoverContextCandidates, readSkillMetadata } from '../core/context-candidate-discovery.js';
import {
  getRuntimeCapabilities,
  RUNTIME_VERSION,
} from '../core/runtime-capabilities.js';
import { getReactiveBootloader } from '../core/bootloader.js';
import { createStateResponse, serializeStateResponse } from './state-response.js';
import { createDeltaView } from '../core/state-view.js';
import { submitHumanResponse } from './human-response.js';
import { continuationResponse, retrySignalResponse, signalReceipt, unavailableReceipt, withMcpRun } from './continuation-response.js';

export interface ReactiveMcpServerOptions {
  workspaceDir?: string;
  defaultSkill?: string;
}

/**
 * Register MCP tools and resources with lazy per-run engines.
 *
 * # Performance & Risk Budget
 * - Tier: P2 (< 100ms)
 * - Complexity: O(u), registered tool and resource schemas; no eager replay
 * - Cyclomatic Complexity (CC): target <= 15 for registration
 * - Branch Coverage: target >= 70%
 * - CRAP Score: target <= 25.0
 */
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

  /**
   * Pin the selected run before queuing, then refresh it without terminal rotation.
   * # Performance & Risk Budget
   * - Tier: P2 (<100ms cold load; queued work additional)
   * - Complexity: O(r), cold replay delta; O(1) cached selection
   * - Cyclomatic Complexity (CC): target <=8
   * - Branch Coverage: target >=90%
   * - CRAP Score: target <=10
   */
  // Last view sequence this session delivered per run. A run without one is a resume
  // (new session after a crash, or a job switch), so it receives the complete view.
  const deliveredViews = new Map<string, number>();
  function rememberView(engine: FSMEngine): void {
    deliveredViews.set(engine.getJobId() || 'default', engine.getStateViewSeq());
  }
  function deltaAnchor(engine: FSMEngine, returnView: string | undefined, sinceSeq: number | undefined): number | undefined {
    return returnView === 'delta-v1' ? sinceSeq ?? deliveredViews.get(engine.getJobId() || 'default') : undefined;
  }

  function onRun<T>(skill: string, job: string | undefined, work: (engine: FSMEngine) => Promise<T>): Promise<T> {
    const selected = getEngine(skill, job);
    return withMcpRun(workspaceDir, selected, () => selected.hasExternalChanges() ? getEngine(skill, selected.getJobId()) : selected, work);
  }

  server.tool(
    'reactive_capabilities',
    'Runtime version and capabilities, once at INIT',
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
    'Runtime bootloader for a skill',
    {
      skill_name: z.string().min(1).regex(/^[A-Za-z0-9._-]+$/).describe('Skill'),
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
    'Route to the smallest useful skill and context',
    {
      user_message: z.string().min(1).describe('Current user message'),
      candidates: z.array(contextCandidateSchema).optional().describe('Skill metadata; omit to discover'),
      token_budget: z.number().int().min(128).max(32768).optional().describe('Max context tokens'),
      state_hints: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe('Bounded state hints'),
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
    'Route, then load only the selected skill context',
    {
      user_message: z.string().min(1).describe('Current user message'),
      candidates: z.array(contextCandidateSchema).optional().describe('Skill metadata; omit to discover'),
      token_budget: z.number().int().min(128).max(32768).optional().describe('Max context tokens'),
      state_hints: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe('Bounded state hints'),
      job_id: z.string().optional().describe('Run ID for the selected skill'),
      output: z.enum(['legacy', 'compact-v1']).optional().describe('Default compact-v1; legacy for one release'),
    },
    /**
     * Prepare the routed state with compact transport accounting.
     * # Performance & Risk Budget
     * - Tier: P2 for local preparation (< 100ms, excluding remote routing)
     * - Complexity: O(b + r), response bytes plus cold replay delta
     * - Cyclomatic Complexity (CC): target <= 15
     * - Branch Coverage: target >= 70%
     * - CRAP Score: target <= 25.0
     */
    async ({ user_message, candidates, token_budget, state_hints, job_id, output }) => {
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
                    recovery: `Run reactive-skills-axi reset ${engine.cliSkillReference()} then re-invoke.`,
                  },
                }, null, 2),
              }],
              isError: true,
            };
          }

          await engine.resumeRuntimeActions();
          engine.recordStateDelivery();
          const slice = engine.generatePromptSlice();
          const state = createStateResponse(engine, slice, false, output ?? 'compact-v1');
          rememberView(engine);
          const payload = {
            context_route: decision,
            context: {
              status: 'ready',
              source: 'reactive_state',
              ...state,
            },
          };
          return {
            content: [{ type: 'text', text: serializeStateResponse(payload, slice.metrics!) }],
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
    'Current state view; complete unless since_seq is given',
    {
      skill: z.string().optional().describe('Skill; default active'),
      job_id: z.string().optional().describe('Run ID; default active'),
      include_full_context: z.boolean().optional().describe('Full recorded context instead of scoped'),
      output: z.enum(['legacy', 'compact-v1']).optional().describe('Default compact-v1; legacy for one release'),
      since_seq: z.number().int().nonnegative().optional().describe('Return delta-v1 since this view seq; omit after resume or compaction'),
    },
    /**
     * Fetch scoped state, including after a host transcript is compacted.
     * # Performance & Risk Budget
     * - Tier: P2 cold bootstrap (< 100ms), P0 cached serialization (< 5ms)
     * - Complexity: O(b + r), response bytes plus cold replay delta
     * - Cyclomatic Complexity (CC): target <= 12
     * - Branch Coverage: target >= 80%
     * - CRAP Score: target <= 15.0
     */
    async ({ skill, job_id, include_full_context, output, since_seq }) => {
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
                    recovery: 'Run reactive-skills-axi reset ' + engine.cliSkillReference() + ' then re-invoke.',
                    strict_execution: engine.isStrictExecution(),
                    turns_since_last_signal: engine.getTurnsSinceLastSignal(),
                  }
                ),
              },
            ],
            isError: true,
          };
        }

        await engine.resumeRuntimeActions();
        engine.recordStateDelivery();
        const slice = engine.generatePromptSlice();
        const payload = since_seq === undefined || include_full_context
          ? createStateResponse(engine, slice, include_full_context, output ?? 'compact-v1')
          : createDeltaView(engine, since_seq, slice);
        rememberView(engine);
        return {
          content: [{ type: 'text', text: serializeStateResponse(payload, slice.metrics!) }],
        };
      } catch (err: any) {
        if (err.message?.startsWith('BYPASS_DETECTED')) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: err.message, recovery: 'Run reactive-skills-axi reset ' + (err.message.match(/reset (.+) then re-invoke/)?.[1] || 'skill') + ' then re-invoke.' }) }],
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

  server.tool(
    'reactive_import_evidence',
    'Import a workspace file as evidence; returns its receipt',
    {
      path: z.string().min(1).max(4096),
      media_type: EvidenceMediaTypeSchema,
      skill: z.string().optional(),
      job_id: z.string().optional(),
    },
    /**
     * # Performance & Risk Budget
     * - Tier: P2 cold engine (<100ms); P1 evidence IO (<25ms per <=1MiB)
     * - Complexity: O(cold replay delta + evidence bytes + path depth)
     * - Cyclomatic Complexity (CC): target <=8
     * - Branch Coverage: target >=90%
     * - CRAP Score: target <=10
     */
    async ({ path: source, media_type, skill, job_id }) => {
      try {
        const engine = getEngine(skill || defaultSkill, job_id);
        const reference = importEvidence(engine, source, media_type);
        return { content: [{ type: 'text', text: JSON.stringify({ reference }) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }], isError: true };
      }
    }
  );

  server.tool(
    'reactive_read_evidence',
    'Read registered evidence content by receipt',
    { reference: EvidenceReceiptSchema, skill: z.string().optional(), job_id: z.string().optional() },
    /**
     * # Performance & Risk Budget
     * - Tier: P2 cold engine (<100ms); P1 evidence IO (<25ms per <=1MiB)
     * - Complexity: O(cold replay delta + evidence bytes)
     * - Cyclomatic Complexity (CC): target <=8
     * - Branch Coverage: target >=90%
     * - CRAP Score: target <=10
     */
    async ({ reference, skill, job_id }) => {
      try {
        const output = readEvidence(getEngine(skill || defaultSkill, job_id), reference);
        return { content: [{ type: 'text', text: JSON.stringify(output) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }], isError: true };
      }
    }
  );

  // 2. TOOL: reactive_emit_signal
  server.tool(
    'reactive_emit_signal',
    'Emit a signal; returns the receipt and next view',
    {
      signal: z.string().describe('Signal name'),
      payload: z.record(z.any()).optional().describe('Signal payload'),
      evidence: EvidenceBindingsSchema.optional().describe('Declared pointer to {reference} or {path, media_type}'),
      skill: z.string().optional().describe('Skill'),
      job_id: z.string().optional().describe('Run ID; default active'),
      idempotency_key: z.string().optional().describe('Retry key; duplicates are no-ops'),
      return_view: z.enum(['delta-v1', 'compact-v1', 'none']).optional().describe('Default delta-v1; compact-v1 complete; none legacy receipt (one release)'),
      since_seq: z.number().int().nonnegative().optional().describe('Last view seq seen; default: last one this session delivered, else complete view'),
    },
    /**
     * # Performance & Risk Budget
     * - Tier: P2 cold engine (<100ms); P1 evidence IO (<25ms per <=1MiB), judgments additional
     * - Complexity: O(cold replay delta + selected evidence bytes + response bytes)
     * - Cyclomatic Complexity (CC): target <=8
     * - Branch Coverage: target >=90%
     * - CRAP Score: target <=10
     */
    async ({ signal, payload = {}, evidence, skill, job_id, idempotency_key, return_view: requested, since_seq }) => {
      const return_view = requested === 'none' ? undefined : requested ?? 'delta-v1';
      try {
        return await onRun(skill || defaultSkill, job_id, async engine => {
          const anchor = deltaAnchor(engine, return_view, since_seq);
          const metadata = { idempotencyKey: idempotency_key, source: 'mcp' };
          const retry = retrySignalResponse(engine, idempotency_key, !!return_view);
          if (retry) return { content: [{ type: 'text', text: retry }] };
          const automatic = evidence === undefined ? inlineEvidenceBindings(engine, signal, payload, idempotency_key) : undefined;
          const submission = automatic ? await submitEvidenceSignal(engine, signal, automatic.payload, automatic.bindings, metadata)
            : evidence === undefined ? undefined
            : await submitEvidenceSignal(engine, signal, payload, evidence, metadata);
          const result = submission?.result ?? await engine.handleSignal(signal, payload, metadata);
          const receipt = {
            ...signalReceipt(engine, result),
            // An automatic reference keeps the inline receipt; the recovery view carries its receipt.
            ...(submission && !automatic ? { event_id: result.event.id, evidence: submission.evidence } : {}),
          };
          const original = result.replayed ? unavailableReceipt(result.event) : { ...receipt, event_id: result.event.id };
          const text = return_view
            ? continuationResponse(engine, original, result.event, anchor)
            : JSON.stringify(receipt, null, 2);
          if (return_view) rememberView(engine);
          return { content: [{ type: 'text', text }] };
        });
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
    'Read-only SQL over the event store',
    {
      sql: z.string().describe('Read-only SQL over events'),
      skill: z.string().optional().describe('Skill'),
      job_id: z.string().optional().describe('Run ID; default active'),
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
    'Query run events by type, state or seq',
    {
      type: z.string().optional().describe('Event type'),
      state: z.string().optional().describe('State'),
      sinceSeq: z.number().int().nonnegative().optional().describe('Events after this seq'),
      limit: z.number().int().positive().max(1000).optional().describe('Max events'),
      skill: z.string().optional().describe('Skill'),
      job_id: z.string().optional().describe('Run ID; default active'),
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
    'List available skills',
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

  /**
   * Inspect manifest declarations without opening a run or executing lifecycle hooks.
   * # Performance & Risk Budget
   * - Tier: P2 (< 100ms); Complexity: O(m + d + b), manifest bytes, state depth and guard source bytes
   * - Cyclomatic Complexity (CC): 2 (measured with ESLint)
   * - Branch Coverage: 100% (measured with V8 acceptance tests)
   * - CRAP Score: 2.0 (Threshold <= 25)
   * - Measured: 1.258469ms p95 for the containing targeted MCP handler; Node 22.23.3/Linux, 100 samples after 10 warmups.
   */
  function inspectSelectedGuard(skillName: string, state: string, signal: string): string {
    const skillDir = findSkillDir(skillName);
    if (!skillDir) throw new Error(`Skill '${skillName}' not found in workspace or global registry.`);
    const manifest = SkillManifestSchema.parse(yaml.load(fs.readFileSync(path.join(skillDir, 'skill.yaml'), 'utf8')));
    return JSON.stringify(inspectTransitionGuard(manifest, skillDir, state, signal));
  }

  // 5. TOOL: reactive_inspect
  server.tool(
    'reactive_inspect',
    'Inspect the statechart, or exact guards for one state and signal',
    {
      skill: z.string().optional().describe('Skill'),
      job_id: z.string().optional().describe('Run ID; default active'),
      state: z.string().optional().describe('Owning state path; needs signal'),
      signal: z.string().optional().describe('Signal owned by state; needs state'),
    },
    /**
     * # Performance & Risk Budget
     * - Tier: P2 (< 100ms local); Complexity: O(m + d + b), manifest bytes, state depth and source bytes; existing whole-skill engine lookup additional
     * - Cyclomatic Complexity (CC): 7 (measured with ESLint)
     * - Branch Coverage: 100% (measured with V8 acceptance tests)
     * - CRAP Score: 7.0 (Threshold <= 25)
     * - Measured targeted MCP call: 1.258469ms p95, Node 22.23.3/Linux, 100 samples after 10 warmups.
     */
    async ({ skill, job_id, state, signal }) => {
      try {
        if ((state === undefined) !== (signal === undefined)) throw new Error('Guard inspection requires both state and signal');
        return {
          content: [
            {
              type: 'text',
              text: state !== undefined && signal !== undefined
                ? inspectSelectedGuard(skill || defaultSkill, state, signal)
                : JSON.stringify(getEngine(skill || defaultSkill, job_id).getManifest(), null, 2),
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
    'Invoke a child skill with provenance',
    {
      skill: z.string().describe('Skill name or path'),
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
    'Submit a human decision at a gate',
    {
      choice: z.string().describe('Selected choice'),
      approved: z.boolean().optional().describe('Approved'),
      feedback: z.string().optional().describe('Feedback'),
      skill: z.string().optional().describe('Skill'),
      job_id: z.string().optional().describe('Run ID; default active'),
      idempotency_key: z.string().optional().describe('Retry key; no repeated decision'),
      return_view: z.enum(['delta-v1', 'compact-v1', 'none']).optional().describe('Default delta-v1; compact-v1 complete; none legacy receipt (one release)'),
      since_seq: z.number().int().nonnegative().optional().describe('Last view seq seen; default: last one this session delivered, else complete view'),
    },
    /**
     * Submit a complete human response batch before optional current-view delivery.
     * # Performance & Risk Budget
     * - Tier: P2 (<100ms local work; adapters additional)
     * - Complexity: O(b + r + k), response bytes, cold replay and indexed request children
     * - Cyclomatic Complexity (CC): target <=8
     * - Branch Coverage: target >=90%
     * - CRAP Score: target <=10
     */
    async ({ choice, approved = true, feedback, skill, job_id, idempotency_key, return_view: requested, since_seq }) => {
      const return_view = requested === 'none' ? undefined : requested ?? 'delta-v1';
      try {
        return await onRun(skill || defaultSkill, job_id, async engine => {
          const anchor = deltaAnchor(engine, return_view, since_seq);
          const response = await submitHumanResponse(engine, { choice, approved, feedback }, idempotency_key, !!return_view);
          const text = return_view
            ? continuationResponse(engine, response.receipt, response.event, anchor)
            : JSON.stringify(response.receipt, null, 2);
          if (return_view) rememberView(engine);
          return { content: [{ type: 'text', text }] };
        });
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
    'Migrate a workspace to the current schema',
    {
      targetDir: z.string().optional().describe('Project dir; default workspace'),
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
    'List jobs for a skill',
    {
      skill: z.string().optional().describe('Skill; default active'),
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
    'Switch the active job',
    {
      skill: z.string().optional().describe('Skill; default active'),
      job_id: z.string().describe('Job ID to activate'),
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
    'Archive a job',
    {
      skill: z.string().optional().describe('Skill; default active'),
      job_id: z.string().optional().describe('Job ID; default active'),
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
    'Archive the run and start a fresh one',
    {
      skill: z.string().optional().describe('Skill; default active'),
      purge: z.boolean().optional().describe('Delete events and jobs instead of archiving'),
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
    'Sync skills to the central directory and satellites',
    {
      skill: z.string().optional().describe('Skill; all if omitted'),
      link: z.boolean().optional().describe('Link instead of copy (default true)'),
      copy: z.boolean().optional().describe('Copy instead of link'),
      dryRun: z.boolean().optional().describe('Preview without writing'),
      source: z.string().optional().describe('Source directory'),
      target: z.string().optional().describe('Target directory'),
      central: z.string().optional().describe('Central skill directory'),
      config: z.string().optional().describe('Sync config file'),
      physicalTargets: z.array(z.string()).optional().describe('Satellites needing copies'),
      showConfig: z.boolean().optional().describe('Show resolved config only'),
      ref: z.string().optional().describe('Git ref to read sources from instead of working tree'),
      allowDowngrade: z.boolean().optional().describe('Replace even if source version is older'),
    },
    async ({ skill, link = true, copy = false, dryRun = false, source, target, central, config, physicalTargets, showConfig = false, ref, allowDowngrade = false }) => {
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
        if (ref) syncArgs.push('--ref', ref);
        if (allowDowngrade) syncArgs.push('--allow-downgrade');
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
