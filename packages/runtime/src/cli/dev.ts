#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
reactive-skills-dev: Developer CLI for Reactive Skills Architecture

Usage:
  reactive-skills-dev init <name>         Scaffold new reactive skill in skills/<name>/
  reactive-skills-dev upgrade <path>      Convert legacy SKILL.md to reactive format
  reactive-skills-dev inspect <skill>     Print statechart, transitions, and guards
  reactive-skills-dev migrate [path]      Retroactively migrate project to latest schema
  reactive-skills-dev sync               Sync skills to all agent config directories
  `);
}

async function main() {
  if (!command || command === 'help' || command === '--help') {
    printHelp();
    return;
  }

  // INIT
  if (command === 'init') {
    const name = args[1];
    if (!name) {
      console.error(JSON.stringify({ error: 'Skill name required. Usage: reactive-skills-dev init <name>' }));
      process.exit(1);
    }
    const skillDir = path.resolve(process.cwd(), 'skills', name);
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });
    fs.mkdirSync(path.join(skillDir, 'guards'), { recursive: true });
    fs.mkdirSync(path.join(skillDir, 'templates'), { recursive: true });
    const manifest = `name: ${name}\nversion: "1.0.0"\ndescription: "${name} reactive skill"\ninitial_state: INITIAL\nstates:\n  INITIAL:\n    description: "Starting state"\n    transitions: {}\n`;
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), manifest, 'utf8');
    fs.writeFileSync(path.join(skillDir, 'states', 'INITIAL.md'), `# State: INITIAL\n\nDescribe what the agent should do in this state.\n`, 'utf8');
    console.log(`Scaffolded reactive skill '${name}' at skills/${name}/`);
    return;
  }

  // UPGRADE
  if (command === 'upgrade') {
    const skillPath = args[1];
    if (!skillPath) {
      console.error(JSON.stringify({ error: 'Path required. Usage: reactive-skills-dev upgrade <path>' }));
      process.exit(1);
    }
    const { LegacySkillAdapter } = await import('../core/legacy-adapter.js');
    const targetDir = path.resolve(process.cwd(), skillPath);
    const result = LegacySkillAdapter.upgradeToModular(targetDir);
    console.log(`Upgraded legacy SKILL.md at ${targetDir}`);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // INSPECT
  if (command === 'inspect') {
    const skillPath = args[1] && !args[1].startsWith('--') ? args[1] : '';
    if (!skillPath) {
      console.error('Skill path required. Usage: reactive-skills-dev inspect <skill-path>');
      process.exit(1);
    }
    const targetDir = path.resolve(process.cwd(), skillPath);
    const { FSMEngine } = await import('../core/fsm-engine.js');
    const engine = new FSMEngine({ skillDir: targetDir });
    const manifest = engine.getManifest();

    const isJson = args.includes('--json');
    if (isJson) {
      console.log(JSON.stringify(manifest, null, 2));
    } else {
      console.log(`\nReactive Skill: ${manifest.name} (v${manifest.version || '1.0.0'})`);
      console.log(`Description: ${manifest.description}`);
      console.log(`Initial State: ${manifest.initial_state}`);
      console.log(`\nStates & Transitions:`);
      for (const [sName, sDef] of Object.entries(manifest.states)) {
        console.log(`  [${sName}]`);
        if (sDef.transitions) {
          for (const [sig, trans] of Object.entries(sDef.transitions)) {
            const t = typeof trans === 'string' ? { target: trans } : trans;
            console.log(`    on '${sig}' -> ${t.target}${t.guard ? ` [guard: ${t.guard}]` : ''}`);
          }
        }
      }
    }
    return;
  }

  // MIGRATE
  if (command === 'migrate') {
    const targetPath = args[1] || process.cwd();
    const { ProjectMigrator } = await import('../core/migration.js');
    const result = ProjectMigrator.migrate(targetPath);
    const isJson = args.includes('--json');
    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`\nProject Migrated to ${result.schemaVersion}:`);
      console.log(`Directory: ${result.projectDir}`);
      for (const note of result.notes) {
        console.log(`  - ${note}`);
      }
    }
    return;
  }

  // SYNC (delegated to canonical sync engine)
  if (command === 'sync') {
    const { syncEngineCommand } = await import('../sync/cli.js');
    const output = await syncEngineCommand(args.slice(1));
    console.log(output);
    return;
  }

  console.error(JSON.stringify({ error: `Unknown command: ${command}` }));
  printHelp();
  process.exit(1);
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
