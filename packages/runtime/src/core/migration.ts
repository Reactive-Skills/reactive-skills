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

/**
 * Retroactive Migration Engine for Reactive Projects and Skills
 * Upgrades existing projects and skills to latest standards (bootloader, INIT states, event store).
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

    // 1. Generate GLOSSARY.md if missing
    const glossaryPath = path.join(docsDir, 'GLOSSARY.md');
    if (!fs.existsSync(glossaryPath)) {
      const initialGlossary = `# Ubiquitous Domain Glossary\n\n> Authoritative definitions for core business concepts and domain vocabulary.\n\n| Term | Definition & Context |\n| :--- | :--- |\n| **Session** | An active execution or domain workflow lifecycle. |\n| **Decider** | Pure business logic function validating commands and emitting events with zero I/O. |\n| **Projection** | Materialized read-model view updated asynchronously from domain events. |\n| **Command** | Intent to mutate state, validated by pure deciders. |\n`;
      fs.writeFileSync(glossaryPath, initialGlossary, 'utf8');
      filesUpdated.push(glossaryPath);
      notes.push('Generated missing GLOSSARY.md');
    }

    // 2. Generate PROGRESS.md if missing
    const progressPath = path.join(docsDir, 'PROGRESS.md');
    if (!fs.existsSync(progressPath)) {
      const initialProgress = `# Project Progress & MVP Status Tracker\n\n- **Project Status:** Active\n- **Last Migrated:** ${new Date().toISOString()}\n\n## Slice Completion by Priority (Eisenhower Matrix)\n\n### 🚀 Q1 / P0 (MVP / Walking Skeleton Slices)\n- [x] **[State Change] Core Domain Slices:** Verified\n\n### 🛠️ Q2 / P1 (Core Quality & Secondary Views)\n- [ ] Queued for next iteration\n\n### ⚡ Q3 / P2 (Ops, Metrics & Enhancements)\n- [ ] Queued for next iteration\n`;
      fs.writeFileSync(progressPath, initialProgress, 'utf8');
      filesUpdated.push(progressPath);
      notes.push('Generated missing PROGRESS.md');
    }

    // 3. Detect legacy workspace storage without mutating or guessing its skill ownership
    const reactiveDir = path.join(absDir, '.reactive');
    const legacyJsonlPath = path.join(reactiveDir, 'events.jsonl');
    const legacySqlitePath = path.join(reactiveDir, 'events.db');
    if (fs.existsSync(legacyJsonlPath) || fs.existsSync(legacySqlitePath)) {
      notes.push('Legacy workspace event store detected and preserved; skill ownership was not inferred.');
      notes.push('Create a skill-scoped store explicitly before resuming any skill run.');
    }

    // 4. Auto-migrate child skills if skills/ folder exists
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

  /**
   * Migrate a single skill package: inject bootloader in SKILL.md, INIT state in skill.yaml, and init.md / setup_mcp.md.
   */
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

    // 1. Update SKILL.md with bootloader if missing
    if (fs.existsSync(skillMdPath)) {
      const rawMd = fs.readFileSync(skillMdPath, 'utf8');
      if (!rawMd.includes('REACTIVE BOOTLOADER')) {
        const bootloaderBlock = `<!-- REACTIVE BOOTLOADER -->\n> **REACTIVE SKILL — STRICT RUNTIME EXECUTION**\n> This skill is an event-driven state machine. Manual execution without the runtime is FORBIDDEN.\n>\n> **PRIMARY EXECUTION (AXI CLI — Shell):**\n> 1. Run \`reactive-skills-axi state ${skillName}\` (or \`invoke ${skillName}\`) to read your current instructions.\n> 2. Complete the tasks described in the state prompt.\n> 3. Run \`reactive-skills-axi emit ${skillName} <signal>\` to advance to the next state.\n>\n> **ALTERNATIVE (MCP Mode):**\n> If the \`reactive_state\` MCP tool is present in your tool list, you may use \`reactive_state\` and \`reactive_emit_signal\`.\n>\n> **STRICT INVARIANT:**\n> Never manually author \`.docs/\` deliverables or guess next states. The runtime governs all transitions and projections.\n<!-- END REACTIVE BOOTLOADER -->\n\n`;

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
        const bootloaderBlock = `<!-- REACTIVE BOOTLOADER -->\n> **REACTIVE SKILL — STRICT RUNTIME EXECUTION**\n> This skill is an event-driven state machine. Manual execution without the runtime is FORBIDDEN.\n>\n> **PRIMARY EXECUTION (AXI CLI — Shell):**\n> 1. Run \`reactive-skills-axi state ${skillName}\` (or \`invoke ${skillName}\`) to read your current instructions.\n> 2. Complete the tasks described in the state prompt.\n> 3. Run \`reactive-skills-axi emit ${skillName} <signal>\` to advance to the next state.\n>\n> **ALTERNATIVE (MCP Mode):**\n> If the \`reactive_state\` MCP tool is present in your tool list, you may use \`reactive_state\` and \`reactive_emit_signal\`.\n>\n> **STRICT INVARIANT:**\n> Never manually author \`.docs/\` deliverables or guess next states. The runtime governs all transitions and projections.\n<!-- END REACTIVE BOOTLOADER -->\n\n`;
        const initialMd = `---\nname: ${skillName}\ndescription: Skill: ${skillName}\ntype: reactive\n---\n\n${bootloaderBlock}# ${skillName}\n\nSkill: ${skillName} governed by \`skill.yaml\`.\n`;
      fs.writeFileSync(skillMdPath, initialMd, 'utf8');
      filesUpdated.push(skillMdPath);
      notes.push('Created SKILL.md with reactive runtime bootloader');
    }

    // 2. Update skill.yaml with INIT and SETUP_MCP states and bump schema to 2.1.0
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
      } else {
        // INIT/SETUP_MCP already exist; still enforce strict_execution
        if (manifest.strict_execution !== true) {
          manifest.strict_execution = true;
          fs.writeFileSync(skillYamlPath, yaml.dump(manifest, { indent: 2 }), 'utf8');
          filesUpdated.push(skillYamlPath);
          notes.push('Set strict_execution: true on existing manifest');
        }
      }
    }

    // 2.5 Generate skill-release.json if missing
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

    // 3. Ensure states/init.md and states/setup_mcp.md exist
    const statesDir = path.join(absDir, 'states');
    if (!fs.existsSync(statesDir)) {
      fs.mkdirSync(statesDir, { recursive: true });
    }

    const initMdPath = path.join(statesDir, 'init.md');
    if (!fs.existsSync(initMdPath)) {
      const initContent = `---\nname: ${skillName}\ndescription: Bootloader - Verify reactive runtime\ntype: reactive\n---\n\n# ${skillName} - INIT\n\nVerify agent harness has access to reactive runtime.\n\n## Instructions\n1. Check if \`reactive_state\` MCP tool is available in active tool whitelist.\n2. If \`reactive_state\` tool is present, emit signal \`RUNTIME_READY\`.\n3. If \`reactive_state\` tool is absent, emit signal \`SETUP_REQUIRED\`.\n`;
      fs.writeFileSync(initMdPath, initContent, 'utf8');
      filesUpdated.push(initMdPath);
      notes.push('Created states/init.md');
    }

    const setupMcpMdPath = path.join(statesDir, 'setup_mcp.md');
    if (!fs.existsSync(setupMcpMdPath)) {
      const setupMcpContent = `---\nname: ${skillName}\ndescription: Auto-configure harness MCP server\ntype: reactive\n---\n\n# ${skillName} - SETUP_MCP\n\nConfigure host harness with \`reactive-skills-axi\` MCP server.\n\n## Instructions\n1. Run shell command via \`run_command\`:\n   \`npx -y reactive-skills-axi setup\`\n2. When command completes:\n   - If exit code 0, emit signal \`SETUP_COMPLETE\` with payload \`{\"exit_code\": 0}\`.\n   - If non-zero exit code, emit signal \`SETUP_FAILED\` with payload \`{\"exit_code\": 1}\`.\n`;
      fs.writeFileSync(setupMcpMdPath, setupMcpContent, 'utf8');
      filesUpdated.push(setupMcpMdPath);
      notes.push('Created states/setup_mcp.md');
    }

    // Create BYPASS_DETECTED template if missing
    const bypassDetectedMdPath = path.join(statesDir, 'bypass_detected.md');
    if (!fs.existsSync(bypassDetectedMdPath)) {
      const bypassContent = [
        '---',
        'name: ' + skillName,
        'description: Bypass detected - Agent operated outside signal contract',
        'type: reactive',
        '---',
        '',
        '# ' + skillName + ' - BYPASS_DETECTED',
        '',
        '**STRICT EXECUTION BYPASS DETECTED**',
        '',
        'The runtime detected that the agent operated outside the signal contract:',
        '- Fetched state without emitting a signal within the allowed turn budget.',
        '- Used tools not in the allowed_tools list (interceptor mode).',
        '- Attempted to read skill files directly instead of going through the runtime.',
        '',
        '## Recovery',
        '1. Run: `reactive-skills-axi reset ' + skillName + '`',
        '2. Then: `reactive-skills-axi invoke ' + skillName + '`',
        '3. Or re-invoke the skill through the MCP server.',
        '',
        '## Prevention',
        '- Use ONLY `reactive_state` to load your TODO card.',
        '- After each turn, emit a signal via `reactive_emit_signal`.',
        '- Do NOT read skill files directly.',
      ].join('\n') + '\n';
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
