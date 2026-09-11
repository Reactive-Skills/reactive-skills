#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FSMEngine } from '../core/fsm-engine.js';
import { EventStore } from '../core/event-store.js';

const args = process.argv.slice(2);
const command = args[0];
const isJson = args.includes('--json');

function printHelp() {
  console.log(`
⚡ reactive-skills: Agent Experience Interface for Reactive Skills

Usage:
  reactive-skills mcp                 Run the stdio Model Context Protocol (MCP) server
  reactive-skills install <skill>     Install skill globally and sync
  reactive-skills migrate [path]      Retroactively migrate project to latest schema
  reactive-skills state [skill]       Get active state slice and prompt
  reactive-skills emit <signal>       Emit signal and step state machine
  reactive-skills query "<sql>"       Query SQLite event store
  reactive-skills inspect <skill>     Inspect statechart and transitions
  reactive-skills events [limit]      Tail event store ledger
  reactive-skills sync                Sync skills across agent platforms
  reactive-skills init <name>         Scaffold new reactive skill
  reactive-skills upgrade <path>      Upgrade legacy SKILL.md
  `);
}

async function main() {
  if (!command || command === 'help' || command === '--help') {
    printHelp();
    return;
  }

  // 0. RUN MCP SERVER
  if (command === 'mcp') {
    const { runMcpServer } = await import('../mcp/server.js');
    await runMcpServer();
    return;
  }

  // 0.5 MIGRATE PROJECT RETROACTIVELY
  if (command === 'migrate') {
    const targetPath = args[1] || process.cwd();
    const { ProjectMigrator } = await import('../core/migration.js');
    const result = ProjectMigrator.migrate(targetPath);
    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`\n🔄 Project Migrated to ${result.schemaVersion}:`);
      console.log(`📁 Directory: ${result.projectDir}`);
      for (const note of result.notes) {
        console.log(`  • ${note}`);
      }
    }
    return;
  }

  // 1. INSTALL SKILL GLOBALLY (delegated to sync engine for the sync step)
  if (command === 'install') {
    const skillName = args[1];
    if (!skillName) {
      console.error(JSON.stringify({ error: 'Skill name required. Usage: reactive-skills install <skill-name>' }));
      process.exit(1);
    }

    const homeDir = os.homedir();
    const sourceCandidates = [
      path.resolve(process.cwd(), 'skills', skillName),
      path.resolve(process.cwd(), skillName),
      path.resolve(import.meta.dirname, '..', '..', 'skills', skillName),
    ];

    const sourceDir = sourceCandidates.find(d => fs.existsSync(d));
    if (!sourceDir) {
      console.error(JSON.stringify({ error: `Skill '${skillName}' not found in local workspace.` }));
      process.exit(1);
    }

    const destAgent = path.join(homeDir, '.agents', 'skills', skillName);
    fs.mkdirSync(path.dirname(destAgent), { recursive: true });
    fs.mkdirSync(destAgent, { recursive: true });

    // Copy skill using the canonical engine's copySkillDir (via runSync with single target)
    const { runSync } = await import('../sync/engine.js');
    const report = runSync({
      sourceDir: path.dirname(sourceDir),
      targetDirs: [path.join(homeDir, '.agents', 'skills')],
      targetSkill: skillName,
      dryRun: false,
      backup: false,
    });

    if (report.errors.length > 0) {
      console.error(JSON.stringify({ error: report.errors.join('; ') }));
      process.exit(1);
    }

    if (isJson) {
      console.log(JSON.stringify({ ok: true, skill: skillName, installedTo: [destAgent], synced: true }));
    } else {
      console.log(`✅ Skill '${skillName}' installed to ${destAgent} and synced globally.`);
    }
    return;
  }

  // 2. GET ACTIVE STATE SLICE
  if (command === 'state') {
    const skillPath = args[1] && !args[1].startsWith('--') ? args[1] : '';
    if (!skillPath) {
      console.error(JSON.stringify({ error: 'Skill path or name required. Usage: reactive-skills state <skill-path>' }));
      process.exit(1);
    }
    const targetDir = path.resolve(process.cwd(), skillPath);
    
    if (!fs.existsSync(targetDir)) {
      console.error(JSON.stringify({ error: `Skill path not found: ${targetDir}` }));
      process.exit(1);
    }

    const engine = new FSMEngine({ skillDir: targetDir });
    if (engine.isStrictExecution()) {
      engine.recordTurnStart();
    }
    const slice = engine.generatePromptSlice();

    if (isJson) {
      console.log(JSON.stringify(slice, null, 2));
    } else {
      console.log(slice.formattedXml);
    }
    return;
  }

  // 3. EMIT SIGNAL
  if (command === 'emit') {
    const signalName = args[1];
    if (!signalName) {
      console.error(JSON.stringify({ error: 'Signal name required. Usage: reactive-skills emit <SIGNAL> [--skill path] [--payload JSON]' }));
      process.exit(1);
    }

    const skillArg = args[2] && !args[2].startsWith('--') ? args[2] : (args.find(a => a.startsWith('--skill='))?.split('=')[1] || '');

    let payload: Record<string, any> = {};
    const payloadIdx = args.indexOf('--payload');
    if (payloadIdx !== -1 && args[payloadIdx + 1]) {
      try {
        payload = JSON.parse(args[payloadIdx + 1]);
      } catch {
        payload = { raw: args[payloadIdx + 1] };
      }
    }

    const skillPath = skillArg ? path.resolve(process.cwd(), skillArg) : process.cwd();
    const skillId = path.basename(skillPath);
    const store = new EventStore({ enableSqlite: true, skillId });
    const engine = new FSMEngine({ skillDir: skillPath, eventStore: store });

    const result = await engine.handleSignal(signalName, payload);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // 4. SQL QUERY ON EVENTS.DB
  if (command === 'query') {
    const sql = args[1];
    if (!sql) {
      console.error(JSON.stringify({ error: 'SQL query required. Usage: reactive-skills query "SELECT * FROM events"' }));
      process.exit(1);
    }

    const store = new EventStore({ enableSqlite: true });
    const driver = store.getSqliteDriver();
    if (!driver) {
      console.error(JSON.stringify({ error: 'SQLite driver not enabled in active event store.' }));
      process.exit(1);
    }

    const rows = driver.querySql(sql);
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  // 5. INSPECT SKILL
  if (command === 'inspect') {
    const skillPath = args[1] && !args[1].startsWith('--') ? args[1] : '';
    if (!skillPath) {
      console.error(JSON.stringify({ error: 'Skill path required. Usage: reactive-skills inspect <skill-path>' }));
      process.exit(1);
    }
    const targetDir = path.resolve(process.cwd(), skillPath);
    const engine = new FSMEngine({ skillDir: targetDir });
    const manifest = engine.getManifest();

    if (isJson) {
      console.log(JSON.stringify(manifest, null, 2));
    } else {
      console.log(`\n⚡ Reactive Skill: ${manifest.name} (v${manifest.version || '1.0.0'})`);
      console.log(`📖 Description: ${manifest.description}`);
      console.log(`🏁 Initial State: ${manifest.initial_state}`);
      console.log(`\n📋 States & Transitions:`);
      for (const [sName, sDef] of Object.entries(manifest.states)) {
        console.log(`  [State: ${sName}]`);
        if (sDef.transitions) {
          for (const [sig, trans] of Object.entries(sDef.transitions)) {
            const t = typeof trans === 'string' ? { target: trans } : trans;
            console.log(`    • on '${sig}' -> ${t.target}${t.guard ? ` [guard: ${t.guard}]` : ''}`);
          }
        }
      }
    }
    return;
  }

  // 6. SYNC SKILLS (delegated to canonical sync engine)
  if (command === 'sync') {
    const { syncEngineCommand } = await import('../sync/cli.js');
    const output = await syncEngineCommand(args.slice(1));
    console.log(output);
    return;
  }

  // 7. EVENTS
  if (command === 'events') {
    const limit = parseInt(args[1] || '20', 10);
    const store = new EventStore();
    const events = store.getAll();
    const slice = events.slice(-limit);

    if (isJson) {
      console.log(JSON.stringify(slice, null, 2));
    } else {
      console.log(`\n📜 Event Store Ledger (.reactive/events.jsonl) - Showing last ${slice.length} events:`);
      for (const e of slice) {
        console.log(`[#${e.seq}] ${e.timestamp} | ${e.type.padEnd(18)} | State: ${(e.state || '-').padEnd(14)} | ${JSON.stringify(e.payload)}`);
      }
    }
    return;
  }

  printHelp();
}

main().catch(err => {
  console.error('Error running reactive-skills:', err);
  process.exit(1);
});
