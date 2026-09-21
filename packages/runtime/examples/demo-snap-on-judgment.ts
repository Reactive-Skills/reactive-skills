import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { EventStore } from '../src/core/event-store.js';

async function main() {
  console.log('\n================================================================');
  console.log('  🎯 Reactive Skills Architecture: Snap-On Judgment & Tiers Demo');
  console.log('================================================================\n');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-snap-on-demo-'));

  const skillYaml = `
schema_version: "2.0.2"
name: release-pipeline-demo
description: "End-to-end demo of model tiering, snap-on Jev judgment, and fallback routing"
initial_state: TRIAGE
states:
  TRIAGE:
    description: "Scan diffs and categorize scope"
    model:
      tier: fast
      suggested: "gemini-2.5-flash / haiku"
      temperature: 0.1
    transitions:
      DIFF_CATEGORIZED: IMPLEMENT

  IMPLEMENT:
    description: "Architect and implement requested functionality"
    model:
      tier: reasoning
      suggested: "claude-3-7-sonnet / o3-mini"
    transitions:
      CODE_READY: VERIFY

  VERIFY:
    description: "Evaluate build invariants and test contracts"
    model:
      tier: decision
    transitions:
      RUN_VERIFICATION:
        target: PROD_DEPLOYED
        judgment:
          type: predicate
          criterion: "Did the test suite pass with zero errors and clean invariants?"
          min_confidence: 0.80
          fallback_target: MANUAL_REVIEW_GATE

  PROD_DEPLOYED:
    description: "Release successfully verified and promoted to production"

  MANUAL_REVIEW_GATE:
    description: "Human-in-the-Loop review gate for unverified or low-confidence releases"
    human_gate:
      type: approval
      prompt: "Automatic verification failed or confidence was below 80%. Approve release manually?"
      options: ["Approve", "Reject"]
`;

  fs.writeFileSync(path.join(tmpDir, 'skill.yaml'), skillYaml, 'utf8');

  const eventStore = new EventStore({ inMemory: true });
  const engine = new FSMEngine({
    skillDir: tmpDir,
    eventStore,
  });

  // -------------------------------------------------------------
  // Step 1: Inspecting Model Contracts in Prompt Slices
  // -------------------------------------------------------------
  console.log('📍 [STEP 1] Inspecting State Model Contracts\n');

  const triageSlice = engine.generatePromptSlice();
  console.log(`Current State: ${triageSlice.state}`);
  console.log(`Model Tier:    ${triageSlice.modelContract?.tier}`);
  console.log(`Suggested:     ${triageSlice.modelContract?.suggested}`);
  console.log('Formatted XML Envelope snippet:');
  console.log('  ' + triageSlice.formattedXml.split('\n')[1]);

  // Transition to IMPLEMENT
  await engine.handleSignal('DIFF_CATEGORIZED');
  const implementSlice = engine.generatePromptSlice();
  console.log(`\nTransitioned -> State: ${implementSlice.state}`);
  console.log(`Model Tier:    ${implementSlice.modelContract?.tier}`);
  console.log(`Suggested:     ${implementSlice.modelContract?.suggested}`);
  console.log('Formatted XML Envelope snippet:');
  console.log('  ' + implementSlice.formattedXml.split('\n')[1]);

  // -------------------------------------------------------------
  // Step 2: Transitioning to VERIFY state
  // -------------------------------------------------------------
  await engine.handleSignal('CODE_READY');
  const verifySlice = engine.generatePromptSlice();
  console.log(`\nTransitioned -> State: ${verifySlice.state}`);
  console.log('Exit Contracts:');
  for (const cond of verifySlice.exitConditions) {
    console.log(`  • ${cond}`);
  }

  // -------------------------------------------------------------
  // Step 3: Positive Verification (Passing Build)
  // -------------------------------------------------------------
  console.log('\n📍 [STEP 2] Dispatching Positive Verification Event');
  console.log('Emitting: RUN_VERIFICATION with exit_code: 0, tests_passed: 42, lint_clean: true');
  console.log('Evaluating via snap-on JevAdapter in background...\n');

  const t0 = performance.now();
  const passResult = await engine.handleSignal('RUN_VERIFICATION', {
    exit_code: 0,
    tests_passed: 42,
    lint_clean: true,
    summary: 'All 42 unit and integration tests passed with 100% assertions verified.',
  });
  const passDuration = (performance.now() - t0).toFixed(1);

  const evalEvents = eventStore.query({ type: 'GUARD_EVALUATED' });
  const latestEval = evalEvents[evalEvents.length - 1];

  console.log(`⚡ Transition Result: VERIFY -> ${passResult.newState} (${passDuration}ms)`);
  console.log(`   Adapter:    ${latestEval.payload.judgment?.adapterName}`);
  console.log(`   Verdict:    ${latestEval.payload.judgment?.verdict}`);
  console.log(`   Confidence: ${latestEval.payload.judgment?.confidence}`);
  console.log(`   Passed:     ${latestEval.payload.passed}`);

  // -------------------------------------------------------------
  // Step 4: Negative Verification (Failing Build & Fallback Target)
  // -------------------------------------------------------------
  console.log('\n📍 [STEP 3] Simulating Failing Build (Testing Fallback Routing)');
  
  // Re-initialize engine to VERIFY state to test failure
  const engine2 = new FSMEngine({
    skillDir: tmpDir,
    eventStore: new EventStore({ inMemory: true }),
    initialContext: {},
  });
  await engine2.handleSignal('DIFF_CATEGORIZED');
  await engine2.handleSignal('CODE_READY');

  console.log(`Current State: ${engine2.getCurrentState()}`);
  console.log('Emitting: RUN_VERIFICATION with exit_code: 1, errors: ["NullPointerException"]');
  console.log('Evaluating via Jev...');

  const t1 = performance.now();
  const failResult = await engine2.handleSignal('RUN_VERIFICATION', {
    exit_code: 1,
    errors: ['NullPointerException in AuthGateway.ts:142'],
    summary: 'Test run failed with 1 unhandled exception and 3 broken assertions.',
  });
  const failDuration = (performance.now() - t1).toFixed(1);

  const fallbackEvents = engine2.getEventStore().query({ type: 'GUARD_FALLBACK_TRIGGERED' });
  console.log(`\n⚡ Fallback Transition: VERIFY -> ${failResult.newState} (${failDuration}ms)`);
  if (fallbackEvents.length > 0) {
    console.log(`   Original Target:  ${fallbackEvents[0].payload.originalTarget}`);
    console.log(`   Fallback Target:  ${fallbackEvents[0].payload.to}`);
    console.log(`   Reason:           ${fallbackEvents[0].payload.reason}`);
  }

  // Cleanup temp dir
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}

  console.log('\n================================================================');
  console.log('  ✅ Demo Concluded: Model Tiers, Snap-On Jev & Fallbacks Proven');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
