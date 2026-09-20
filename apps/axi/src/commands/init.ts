import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { AxiError } from '../errors.js';
import { renderError, renderHelp, renderOutput } from '../toon.js';
import { getSuggestions } from '../suggestions.js';
import { createAxiFirstBypassState, createAxiFirstInitState, createReactiveBootloader } from '../bootloader.js';

const SKILLS_DIR = path.resolve(process.cwd(), 'skills');

function createSkillManifest(name: string) {
  return {
    schema_version: '2.1.0',
    name,
    description: 'Skill: ' + name,
    initial_state: 'INIT',
    strict_execution: true,
    states: {
      INIT: {
        description: 'Bootloader: Verify reactive runtime environment',
        prompt_template: 'states/init.md',
        transitions: {
          RUNTIME_READY: { target: 'START' },
          SETUP_REQUIRED: { target: 'SETUP_MCP' },
        },
      },
      SETUP_MCP: {
        description: 'Auto-configure harness MCP server',
        prompt_template: 'states/setup_mcp.md',
        tools: ['run_command'],
        transitions: {
          SETUP_COMPLETE: { target: 'START', guard: 'payload.exit_code == 0' },
          SETUP_FAILED: { target: 'ERROR', guard: 'payload.exit_code != 0' },
        },
      },
      START: {
        description: 'Initial execution state',
        prompt_template: 'states/start.md',
        transitions: {
          DONE: { target: 'DONE' },
        },
      },
      DONE: {
        description: 'Skill execution completed',
        prompt_template: 'states/done.md',
      },
      ERROR: {
        description: 'Runtime setup failed',
      },
      BYPASS_DETECTED: {
        description: 'Bypass detected: Agent operated outside the signal contract',
        prompt_template: 'states/bypass_detected.md',
      },
    },
  };
}

function createSkillMarkdown(name: string): string {
  return `---
name: ${name}
description: Skill: ${name}
type: reactive
---

${createReactiveBootloader(name)}

# ${name}

Skill: ${name} governed by \`skill.yaml\`.
`;
}

function createStatechartMarkdown(name: string): string {
  return `# Statechart: ${name}\n\n` +
    '```mermaid\n' +
    'stateDiagram-v2\n' +
    '    [*] --> INIT\n' +
    '    INIT --> START : RUNTIME_READY\n' +
    '    INIT --> SETUP_MCP : SETUP_REQUIRED\n' +
    '    SETUP_MCP --> START : SETUP_COMPLETE [exit_code == 0]\n' +
    '    SETUP_MCP --> ERROR : SETUP_FAILED [exit_code != 0]\n' +
    '    START --> DONE : DONE\n' +
    '    DONE --> [*]\n' +
    '```\n';
}

function createInitStateMarkdown(name: string): string {
  return createAxiFirstInitState(name);
}

function createSetupMcpStateMarkdown(name: string): string {
  return `---
name: ${name}
description: Auto-configure harness MCP server
type: reactive
---

# ${name} - SETUP_MCP

Configure host harness with the \`@reactive-skills/axi\` MCP server only when AXI CLI is unavailable.

## Instructions
1. Run shell command via \`run_command\`:
   \`npx -y @reactive-skills/axi setup\`
2. When command completes:
   - If exit code 0, emit signal \`SETUP_COMPLETE\` with payload \`{"exit_code": 0}\`.
   - If non-zero exit code, emit signal \`SETUP_FAILED\` with payload \`{"exit_code": 1}\`.
`;
}

function createStartStateMarkdown(name: string): string {
  return `---
name: ${name}
description: Skill: ${name}
type: reactive
---

# ${name} - START

Execute skill work here.

## Transitions

- On \`DONE\` to completed
`;
}

function createDoneStateMarkdown(name: string): string {
  return `---
name: ${name}
description: Skill: ${name}
type: reactive
---

# ${name} - DONE

Skill execution completed.
`;
}

function createBypassDetectedStateMarkdown(name: string): string {
  return createAxiFirstBypassState(name);
}

function createSkillReleaseJson(name: string): string {
  return JSON.stringify({
    schemaVersion: 1,
    skillId: name,
    channel: 'stable',
    version: '2.1.0',
    type: 'reactive',
    reactiveSchemaVersion: '2.1.0',
  }, null, 2) + '\n';
}

export async function initCommand(args: string[]): Promise<string> {
  const name = args[0];

  if (!name) {
    const error = new AxiError(
      'Missing skill name',
      'VALIDATION_ERROR',
      ['Usage: reactive-skills-axi init <name>', 'Example: reactive-skills-axi init my-skill']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }

  const skillPath = path.join(SKILLS_DIR, name);

  if (fs.existsSync(skillPath)) {
    const error = new AxiError(
      'Skill already exists: ' + name,
      'ALREADY_EXISTS',
      ['Path already exists: ' + skillPath, 'Choose a different name or remove the existing skill']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }

  fs.mkdirSync(skillPath, { recursive: true });
  fs.mkdirSync(path.join(skillPath, 'states'), { recursive: true });

  const manifest = createSkillManifest(name);
  fs.writeFileSync(
    path.join(skillPath, 'skill.yaml'),
    yaml.dump(manifest, { indent: 2 }),
    'utf8'
  );

  fs.writeFileSync(
    path.join(skillPath, 'SKILL.md'),
    createSkillMarkdown(name),
    'utf8'
  );

  fs.writeFileSync(
    path.join(skillPath, 'STATECHART.md'),
    createStatechartMarkdown(name),
    'utf8'
  );

  fs.writeFileSync(
    path.join(skillPath, 'states', 'init.md'),
    createInitStateMarkdown(name),
    'utf8'
  );

  fs.writeFileSync(
    path.join(skillPath, 'states', 'setup_mcp.md'),
    createSetupMcpStateMarkdown(name),
    'utf8'
  );

  fs.writeFileSync(
    path.join(skillPath, 'states', 'start.md'),
    createStartStateMarkdown(name),
    'utf8'
  );

  fs.writeFileSync(
    path.join(skillPath, 'states', 'done.md'),
    createDoneStateMarkdown(name),
    'utf8'
  );

  fs.writeFileSync(
    path.join(skillPath, 'states', 'bypass_detected.md'),
    createBypassDetectedStateMarkdown(name),
    'utf8'
  );

  fs.writeFileSync(
    path.join(skillPath, 'skill-release.json'),
    createSkillReleaseJson(name),
    'utf8'
  );

  const suggestions = getSuggestions({ domain: 'init', action: 'create', skillName: name });
  const okLine = 'ok: created skill ' + name + ' at skills/' + name + '/';

  return renderOutput([
    okLine,
    renderHelp(suggestions),
  ]);
}
