import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export interface MigrationResult {
  migrated: boolean;
  projectDir: string;
  filesUpdated: string[];
  schemaVersion: string;
  notes: string[];
}

function createReactiveBootloader(skillName: string): string {
  return `<!-- REACTIVE BOOTLOADER -->
> **REACTIVE SKILL: STRICT RUNTIME EXECUTION**
> This skill is an event-driven state machine. Manual execution is forbidden.
>
> **LOCAL-FIRST RUNTIME SELECTION**
> Select one compatible runtime during INIT, then reuse it for the full run.
> - To start a new task, use selected runtime \`invoke ${skillName} [--payload JSON]\`.
> - To resume an active task, use selected runtime \`state ${skillName}\`.
> - For named or parallel work, keep the same \`--job <alias>\` flag on every command.
> - The runtime resolves aliases to immutable UUID-backed \`run_id\` values.
> - To advance state, use selected runtime \`emit ${skillName} <signal>\`.
>
> **SELECTED RUNTIME COMMANDS**
> First check \`reactive_capabilities\` when this MCP tool is available.
> Otherwise check \`reactive-skills-axi capabilities --json\`, then use direct AXI.
> Otherwise use \`npx -y @reactive-skills/axi capabilities --json\`, then use zero-install AXI.
> MCP uses \`reactive_state\` and \`reactive_emit_signal\`.
> Direct AXI uses \`reactive-skills-axi state|emit ${skillName}\`.
> Zero-install AXI uses \`npx -y @reactive-skills/axi state|emit ${skillName}\`.
> Emit \`RUNTIME_READY\` with transport, launcher, versions, compatibility, and capabilities.
> Persist selected runtime in \`payload.contextUpdates\` so later states reuse it.
> AXI remains the runtime interface. \`npx\` is only its zero-install launcher.
> Do not repeat version or capability checks after INIT.
>
> **TERMINAL STATE RECOVERY**
> If the current job is terminal, run selected runtime \`reset ${skillName}\` or \`invoke ${skillName}\`.
>
> **STRICT INVARIANT**
> Do not manually author \`.docs/\` deliverables or guess next states.
> The runtime governs all transitions and projections.
<!-- END REACTIVE BOOTLOADER -->`;
}

function createAxiFirstInitState(skillName: string): string {
  return `---
name: ${skillName}
description: Bootloader - Verify reactive runtime
type: reactive
---

# ${skillName} - INIT

Verify reactive runtime compatibility and select lowest-latency local access.

## Instructions
1. If \`reactive_capabilities\` is available, call it once.
2. Otherwise run \`reactive-skills-axi capabilities --json\` once when direct AXI exists.
3. Otherwise run \`npx -y @reactive-skills/axi capabilities --json\` once.
4. Check reported \`runtime_version\` and \`capabilities\` against this skill's \`runtime_requirements\`, when declared.
5. Select compatible MCP or direct AXI before zero-install AXI. Use \`npx\` only when no compatible direct path exists.
6. Emit \`RUNTIME_READY\` with selected transport, launcher, versions, capabilities, \`compatible: true\`, and \`contextUpdates\` for reuse.
7. If no compatible runtime exists, emit \`SETUP_REQUIRED\` with \`compatible: false\` and diagnostic details.
`;
}

function createAxiFirstBypassState(skillName: string): string {
  return `---
name: ${skillName}
description: Bypass detected - Agent operated outside signal contract
type: reactive
---

# ${skillName} - BYPASS_DETECTED

The runtime detected work outside the signal contract.

## Recovery
1. Run selected runtime \`reset ${skillName}\`.
2. Run selected runtime \`invoke ${skillName}\` to start a fresh isolated job.
3. Use selected runtime \`state ${skillName} --job <job-id>\` only when resuming a known job.

## Prevention
- Use selected runtime \`state\` to load the TODO card.
- Use selected runtime \`emit\` after each completed state task.
- Keep \`--job <alias>\` on every command for named or parallel work.
`;
}

/**
 * Retroactive Migration Engine for Reactive Projects and Skills.
 * Upgrades existing projects and skills to latest standards.
 */
export class ProjectMigrator {
  public static migrate(targetDir: string): MigrationResult {
    const absDir = path.resolve(targetDir);
    const filesUpdated: string[] = [];
    const notes: string[] = [];

    if (!fs.existsSync(absDir)) {
      throw new Error(`Target project directory does not exist: ${absDir}`);
    }

    const docsDir = path.join(absDir, '.docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    const glossaryPath = path.join(docsDir, 'GLOSSARY.md');
    if (!fs.existsSync(glossaryPath)) {
      const initialGlossary = `# Ubiquitous Domain Glossary

> Authoritative definitions for core business concepts and domain vocabulary.

| Term | Definition & Context |
| :--- | :--- |
| **Session** | An active execution or domain workflow lifecycle. |
| **Decider** | Pure business logic function validating commands and emitting events with zero I/O. |
| **Projection** | Materialized read-model view updated asynchronously from domain events. |
| **Command** | Intent to mutate state, validated by pure deciders. |
`;
      fs.writeFileSync(glossaryPath, initialGlossary, 'utf8');
      filesUpdated.push(glossaryPath);
      notes.push('Generated missing GLOSSARY.md');
    }

    const progressPath = path.join(docsDir, 'PROGRESS.md');
    if (!fs.existsSync(progressPath)) {
      const initialProgress = `# Project Progress & MVP Status Tracker

- **Project Status:** Active
- **Last Migrated:** ${new Date().toISOString()}

## Slice Completion by Priority

### Q1 / P0: MVP / Walking Skeleton Slices
- [x] **[State Change] Core Domain Slices:** Verified

### Q2 / P1: Core Quality & Secondary Views
- [ ] Queued for next iteration

### Q3 / P2: Ops, Metrics & Enhancements
- [ ] Queued for next iteration
`;
      fs.writeFileSync(progressPath, initialProgress, 'utf8');
      filesUpdated.push(progressPath);
      notes.push('Generated missing PROGRESS.md');
    }

    const reactiveDir = path.join(absDir, '.reactive');
    const legacyJsonlPath = path.join(reactiveDir, 'events.jsonl');
    const legacySqlitePath = path.join(reactiveDir, 'events.db');
    if (fs.existsSync(legacyJsonlPath) || fs.existsSync(legacySqlitePath)) {
      notes.push('Legacy workspace event store detected and preserved; skill ownership was not inferred.');
      notes.push('Create a skill-scoped store explicitly before resuming any skill run.');
    }

    const skillsFolder = path.join(absDir, 'skills');
    if (fs.existsSync(skillsFolder)) {
      const entries = fs.readdirSync(skillsFolder, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const childDir = path.join(skillsFolder, entry.name);
          if (fs.existsSync(path.join(childDir, 'skill.yaml'))) {
            const skillResult = ProjectMigrator.migrateSkill(childDir);
            if (skillResult.migrated) {
              filesUpdated.push(...skillResult.filesUpdated);
              notes.push(`Migrated skill '${entry.name}' with bootloader and INIT state`);
            }
          }
        }
      }
    }

    return {
      migrated: true,
      projectDir: absDir,
      filesUpdated,
      schemaVersion: 'reactive/v2',
      notes,
    };
  }

  public static migrateSkill(skillDir: string): MigrationResult {
    const absDir = path.resolve(skillDir);
    const filesUpdated: string[] = [];
    const notes: string[] = [];

    if (!fs.existsSync(absDir)) {
      throw new Error(`Target skill directory does not exist: ${absDir}`);
    }

    const skillYamlPath = path.join(absDir, 'skill.yaml');
    const skillMdPath = path.join(absDir, 'SKILL.md');

    if (!fs.existsSync(skillYamlPath)) {
      throw new Error(`skill.yaml not found in ${absDir}`);
    }

    const skillName = path.basename(absDir);

    if (fs.existsSync(skillMdPath)) {
      const rawMd = fs.readFileSync(skillMdPath, 'utf8');
      if (!rawMd.includes('REACTIVE BOOTLOADER')) {
        const bootloaderBlock = createReactiveBootloader(skillName) + '\n\n';
        let updatedMd: string;

        if (rawMd.startsWith('---')) {
          const secondYamlMarker = rawMd.indexOf('---', 3);
          if (secondYamlMarker !== -1) {
            const frontmatter = rawMd.slice(0, secondYamlMarker + 3);
            const rest = rawMd.slice(secondYamlMarker + 3).trimStart();
            updatedMd = `${frontmatter}\n\n${bootloaderBlock}${rest}`;
          } else {
            updatedMd = `${bootloaderBlock}${rawMd}`;
          }
        } else {
          updatedMd = `${bootloaderBlock}${rawMd}`;
        }

        fs.writeFileSync(skillMdPath, updatedMd, 'utf8');
        filesUpdated.push(skillMdPath);
        notes.push('Injected reactive runtime bootloader into SKILL.md');
      }
    } else {
      const bootloaderBlock = createReactiveBootloader(skillName) + '\n\n';
      const initialMd = `---
name: ${skillName}
description: Skill: ${skillName}
type: reactive
---

${bootloaderBlock}# ${skillName}

Skill: ${skillName} governed by \`skill.yaml\`.
`;
      fs.writeFileSync(skillMdPath, initialMd, 'utf8');
      filesUpdated.push(skillMdPath);
      notes.push('Created SKILL.md with reactive runtime bootloader');
    }

    const rawYaml = fs.readFileSync(skillYamlPath, 'utf8');
    const manifest = yaml.load(rawYaml) as any;
    let yamlModified = false;

    if (manifest && typeof manifest === 'object') {
      manifest.states = manifest.states || {};

      if (manifest.schema_version !== '2.1.0') {
        manifest.schema_version = '2.1.0';
        yamlModified = true;
      }

      if (!manifest.states.INIT || !manifest.states.SETUP_MCP) {
        const previousInitial = manifest.initial_state || Object.keys(manifest.states)[0] || 'READY';

        manifest.initial_state = 'INIT';
        manifest.states = {
          INIT: {
            description: 'Bootloader: Verify reactive runtime environment',
            prompt_template: 'states/init.md',
            transitions: {
              RUNTIME_READY: { target: previousInitial },
              SETUP_REQUIRED: { target: 'SETUP_MCP' },
            },
          },
          SETUP_MCP: {
            description: 'Auto-configure harness MCP server',
            prompt_template: 'states/setup_mcp.md',
            tools: ['run_command'],
            transitions: {
              SETUP_COMPLETE: { target: previousInitial, guard: 'payload.exit_code == 0' },
              SETUP_FAILED: { target: 'ERROR', guard: 'payload.exit_code != 0' },
            },
          },
          ...manifest.states,
        };

        if (!manifest.states.ERROR) {
          manifest.states.ERROR = {
            description: 'Runtime setup failed',
          };
        }

        if (!manifest.states.BYPASS_DETECTED) {
          manifest.states.BYPASS_DETECTED = {
            description: 'Bypass detected: Agent operated outside the signal contract',
            prompt_template: 'states/bypass_detected.md',
          };
        }

        yamlModified = true;
        notes.push('Injected INIT and SETUP_MCP states into skill.yaml');
      }

      if (yamlModified) {
        if (manifest.strict_execution !== true) {
          manifest.strict_execution = true;
        }
        fs.writeFileSync(skillYamlPath, yaml.dump(manifest, { indent: 2 }), 'utf8');
        filesUpdated.push(skillYamlPath);
      } else if (manifest.strict_execution !== true) {
        manifest.strict_execution = true;
        fs.writeFileSync(skillYamlPath, yaml.dump(manifest, { indent: 2 }), 'utf8');
        filesUpdated.push(skillYamlPath);
        notes.push('Set strict_execution: true on existing manifest');
      }
    }

    const releaseJsonPath = path.join(absDir, 'skill-release.json');
    if (!fs.existsSync(releaseJsonPath)) {
      const releaseData = {
        schemaVersion: 1,
        skillId: skillName,
        channel: 'stable',
        version: manifest?.version || '2.1.0',
        type: 'reactive',
        reactiveSchemaVersion: '2.1.0',
      };
      fs.writeFileSync(releaseJsonPath, JSON.stringify(releaseData, null, 2) + '\n', 'utf8');
      filesUpdated.push(releaseJsonPath);
      notes.push('Created skill-release.json (v2.1.0)');
    }

    const statesDir = path.join(absDir, 'states');
    if (!fs.existsSync(statesDir)) {
      fs.mkdirSync(statesDir, { recursive: true });
    }

    const initMdPath = path.join(statesDir, 'init.md');
    if (!fs.existsSync(initMdPath)) {
      const initContent = createAxiFirstInitState(skillName);
      fs.writeFileSync(initMdPath, initContent, 'utf8');
      filesUpdated.push(initMdPath);
      notes.push('Created states/init.md');
    }

    const setupMcpMdPath = path.join(statesDir, 'setup_mcp.md');
    if (!fs.existsSync(setupMcpMdPath)) {
      const setupMcpContent = `---
name: ${skillName}
description: Auto-configure harness MCP server
type: reactive
---

# ${skillName} - SETUP_MCP

Configure host harness with \`@reactive-skills/axi\` MCP server when no compatible local runtime is available.

## Instructions
1. Run shell command via \`run_command\`:
   \`npx -y @reactive-skills/axi setup\`
2. When command completes:
   - If exit code 0, emit signal \`SETUP_COMPLETE\` with payload \`{"exit_code": 0}\`.
   - If non-zero exit code, emit signal \`SETUP_FAILED\` with payload \`{"exit_code": 1}\`.
`;
      fs.writeFileSync(setupMcpMdPath, setupMcpContent, 'utf8');
      filesUpdated.push(setupMcpMdPath);
      notes.push('Created states/setup_mcp.md');
    }

    const bypassDetectedMdPath = path.join(statesDir, 'bypass_detected.md');
    if (!fs.existsSync(bypassDetectedMdPath)) {
      const bypassContent = createAxiFirstBypassState(skillName);
      fs.writeFileSync(bypassDetectedMdPath, bypassContent, 'utf8');
      filesUpdated.push(bypassDetectedMdPath);
      notes.push('Created states/bypass_detected.md');
    }

    return {
      migrated: filesUpdated.length > 0,
      projectDir: absDir,
      filesUpdated,
      schemaVersion: 'reactive/v2.0.0',
      notes,
    };
  }
}
