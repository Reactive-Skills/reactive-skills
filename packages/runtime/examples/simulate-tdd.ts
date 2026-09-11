import fs from 'node:fs';
import path from 'node:path';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { EventStore } from '../src/core/event-store.js';

async function runSimulation() {
  console.log('\n🚀 Starting Reactive Skills Simulator: Advanced FSM/HSM Execution & Bubbling\n');

  const workspaceRoot = fs.existsSync(path.resolve(process.cwd(), 'skills'))
    ? process.cwd()
    : path.resolve(process.cwd(), '../..');
  const skillDir = path.resolve(workspaceRoot, 'skills', '_test_fsm_skill');
  const eventStore = new EventStore({ inMemory: true });
  const engine = new FSMEngine({
    skillDir,
    eventStore,
    initialContext: {
      target_file: 'src/calc.ts',
      test_file: 'tests/calc.test.ts',
    },
  });

  console.log(`[BOOT] Initial State: ${engine.getCurrentState()}`);

  // 0. Runtime initialization
  await engine.handleSignal('RUNTIME_READY');
  console.log(`⚡ [INIT] Runtime Ready -> State: ${engine.getCurrentState()}`);

  // 1. Pre-Turn Hook (Red Phase)
  let preTurn = engine.generatePromptSlice();
  console.log(`\n🤖 [PRE-TURN] Active State: ${preTurn.state}`);

  // 2. Agent writes failing test
  console.log('📝 [AGENT] Wrote failing test in tests/calc.test.ts');
  let postTurn = await engine.handleSignal('TEST_RAN', {
    command: 'npm test',
    exit_code: 1,
    output: 'FAIL - Expected 42 received undefined',
  });
  console.log(`⚡ [TRANSITION] State changed: RED_SPEC -> ${postTurn.newState}`);

  // 3. Agent writes passing code
  console.log('\n🔨 [AGENT] Minimal fix applied in src/calc.ts');
  postTurn = await engine.handleSignal('TEST_RAN', {
    command: 'npm test',
    exit_code: 0,
    output: 'PASS - 1 passed',
  });
  console.log(`⚡ [TRANSITION] State changed: GREEN_CODE -> ${postTurn.newState} (Auto-entered substate!)`);

  // 4. In Substate CLEAN_CODE -> moves to PERF_AUDIT
  console.log('\n🧹 [AGENT] Cleaning up code & extracting helpers...');
  const cleanRes = await engine.handleSignal('CLEANING_DONE');
  console.log(`⚡ [TRANSITION] Sibling substate changed: REFACTOR.CLEAN_CODE -> ${cleanRes.newState}`);

  // 5. In PERF_AUDIT, an aggressive allocation optimization causes tests to fail!
  console.log('\n⚠️ [AGENT] Refactoring memory allocations... Oops, test failed!');
  postTurn = await engine.handleSignal('TEST_RAN', {
    command: 'npm test',
    exit_code: 1,
    output: 'FAIL - Regression detected in PERF_AUDIT',
  });
  console.log(`⚡ [POST-TURN] Regression caught & bubbled to parent! State rolled back: ${postTurn.newState}`);

  // 6. Fix regression -> Back to REFACTOR.CLEAN_CODE
  console.log('\n🔨 [AGENT] Fixed regression, tests passing again.');
  postTurn = await engine.handleSignal('TEST_RAN', {
    command: 'npm test',
    exit_code: 0,
    output: 'PASS - All tests green',
  });
  console.log(`⚡ [TRANSITION] State changed back to: ${postTurn.newState}`);

  // 7. Progress through clean code and perf audit
  await engine.handleSignal('CLEANING_DONE');
  const perfRes = await engine.handleSignal('AUDIT_PASSED');
  console.log(`⚡ [TRANSITION] Exited REFACTOR composite state -> ${perfRes.newState}`);

  // 8. Final Audit Verification
  const finalRes = await engine.handleSignal('ALL_CHECKS_PASSED', { exit_code: 0 });
  console.log(`🎯 [FINAL] Skill completed! State: ${finalRes.newState}`);
  console.log(`📦 [DELIVERABLES] Written: ${finalRes.deliverablesWritten.join(', ')}`);

  // 9. Inspect Event Store
  const events = eventStore.getAll();
  console.log(`\n📜 [EVENT STORE] Total Events Recorded: ${events.length}`);
  for (const e of events) {
    console.log(`  🔹 [#${e.seq}] ${e.type.padEnd(25)} | state: ${(e.state || '-').padEnd(20)} | payload: ${JSON.stringify(e.payload)}`);
  }
}

runSimulation().catch(console.error);
