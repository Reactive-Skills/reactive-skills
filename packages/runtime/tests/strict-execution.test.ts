import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { EventStore } from '../src/core/event-store.js';
import { createReactiveMcpServer } from '../src/mcp/server.js';

describe('Strict Execution Mode', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-exec-test-'));
    const srcSkills = path.resolve(process.cwd(), 'skills');
    const destSkills = path.join(tempDir, 'skills');
    fs.cpSync(srcSkills, destSkills, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup locks on Windows
    }
  });

  describe('FSMEngine turn tracking', () => {
    it('should auto-abort after max_idle_turns consecutive recordTurnStart() calls without a signal', async () => {
      const skillDir = path.resolve(tempDir, 'skills', '_test_fsm_skill');
      const eventStore = new EventStore({ inMemory: true });
      const engine = new FSMEngine({ skillDir, eventStore });

      expect(engine.isStrictExecution()).toBe(true);

      // First turn start
      engine.recordTurnStart();
      expect(engine.getTurnsSinceLastSignal()).toBe(1);
      expect(engine.isBypassDetected()).toBe(false);

      // Second turn start
      engine.recordTurnStart();
      expect(engine.getTurnsSinceLastSignal()).toBe(2);
      expect(engine.isBypassDetected()).toBe(false);

      // Third turn start -> bypass
      expect(() => engine.recordTurnStart()).toThrow('BYPASS_DETECTED');
      expect(engine.isBypassDetected()).toBe(true);
    });

    it('should reset turn counter when emitting any signal', async () => {
      const skillDir = path.resolve(tempDir, 'skills', '_test_fsm_skill');
      const eventStore = new EventStore({ inMemory: true });
      const engine = new FSMEngine({ skillDir, eventStore });

      engine.recordTurnStart();
      engine.recordTurnStart();
      expect(engine.getTurnsSinceLastSignal()).toBe(2);

      // Emit signal resets counter
      await engine.handleSignal('RUNTIME_READY');
      expect(engine.getTurnsSinceLastSignal()).toBe(0);

      // Can do more turns after reset
      engine.recordTurnStart();
      expect(engine.getTurnsSinceLastSignal()).toBe(1);
    });

    it('should never auto-abort in non-strict mode', async () => {
      const skillDir = path.resolve(tempDir, 'skills', '_test_hitl_skill');
      const eventStore = new EventStore({ inMemory: true });
      const engine = new FSMEngine({ skillDir, eventStore });

      expect(engine.isStrictExecution()).toBe(false);

      for (let i = 0; i < 10; i++) {
        engine.recordTurnStart();
      }
      expect(engine.isBypassDetected()).toBe(false);
    });

    it('should treat BYPASS_DETECTED state as terminal', async () => {
      const skillDir = path.resolve(tempDir, 'skills', '_test_fsm_skill');
      const eventStore = new EventStore({ inMemory: true });
      const engine = new FSMEngine({ skillDir, eventStore });

      // Trigger bypass
      engine.recordTurnStart();
      engine.recordTurnStart();
      expect(() => engine.recordTurnStart()).toThrow('BYPASS_DETECTED');
      expect(engine.isBypassDetected()).toBe(true);
      expect(engine.getCurrentState()).toBe('BYPASS_DETECTED');

      // Emitting signals should not transition out of BYPASS_DETECTED
      const res = await engine.handleSignal('RUNTIME_READY');
      expect(res.transitioned).toBe(false);
      expect(engine.getCurrentState()).toBe('BYPASS_DETECTED');
    });

    it('should not call recordTurnStart when already in bypass state', () => {
      const skillDir = path.resolve(tempDir, 'skills', '_test_fsm_skill');
      const eventStore = new EventStore({ inMemory: true });
      const engine = new FSMEngine({ skillDir, eventStore });

      // Trigger bypass
      engine.recordTurnStart();
      engine.recordTurnStart();
      expect(() => engine.recordTurnStart()).toThrow('BYPASS_DETECTED');

      // Should not increment further or throw again
      engine.recordTurnStart(); // Should be a no-op
      expect(engine.isBypassDetected()).toBe(true);
    });
  });

  describe('Rehydration', () => {
    it('should restore turnsSinceLastSignal from event history', () => {
      const skillDir = path.resolve(tempDir, 'skills', '_test_fsm_skill');
      const eventStore = new EventStore({ inMemory: true });
      const engine1 = new FSMEngine({ skillDir, eventStore });

      engine1.recordTurnStart();
      engine1.recordTurnStart();
      expect(engine1.getTurnsSinceLastSignal()).toBe(2);

      // Create a new engine with the same event store - should rehydrate
      const engine2 = new FSMEngine({ skillDir, eventStore });
      expect(engine2.getTurnsSinceLastSignal()).toBe(2);
      expect(engine2.isBypassDetected()).toBe(false);
    });

    it('should restore inBypassState from event history', () => {
      const skillDir = path.resolve(tempDir, 'skills', '_test_fsm_skill');
      const eventStore = new EventStore({ inMemory: true });
      const engine1 = new FSMEngine({ skillDir, eventStore });

      engine1.recordTurnStart();
      engine1.recordTurnStart();
      expect(() => engine1.recordTurnStart()).toThrow('BYPASS_DETECTED');
      expect(engine1.isBypassDetected()).toBe(true);

      // Create a new engine with the same event store
      const engine2 = new FSMEngine({ skillDir, eventStore });
      expect(engine2.isBypassDetected()).toBe(true);
      expect(engine2.getCurrentState()).toBe('BYPASS_DETECTED');
    });
  });

  describe('MCP server integration', () => {
    it('reactive_state response includes strict_execution and turns_since_last_signal', async () => {
      const server = createReactiveMcpServer({ workspaceDir: tempDir, defaultSkill: 'test-fsm' });
      const tools = (server as any)._registeredTools;

      const handler = tools['reactive_state'];
      const result = await handler.handler({ skill: 'test-fsm' }, {} as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.strict_execution).toBe(true);
      expect(typeof parsed.turns_since_last_signal).toBe('number');
    });

    it('calling reactive_state twice without emitting a signal does NOT bypass (strict mode tracks turns, not calls)', async () => {
      const server = createReactiveMcpServer({ workspaceDir: tempDir, defaultSkill: '_test_fsm_skill' });
      const tools = (server as any)._registeredTools;

      const handler = tools['reactive_state'];

      // First call
      const res1 = await handler.handler({}, {} as any);
      const parsed1 = JSON.parse(res1.content[0].text);
      expect(parsed1.strict_execution).toBe(true);
      expect(parsed1.turns_since_last_signal).toBe(1);

      // Second call
      const res2 = await handler.handler({}, {} as any);
      const parsed2 = JSON.parse(res2.content[0].text);
      expect(parsed2.turns_since_last_signal).toBe(2);

      // Third call -> bypass (max_idle_turns = 2, 3 > 2)
      const res3 = await handler.handler({}, {} as any);
      const parsed3 = JSON.parse(res3.content[0].text);
      expect(res3.isError).toBe(true);
      expect(parsed3.error).toContain('BYPASS_DETECTED');
    });

    it('reactive_state returns error with recovery instructions when in bypass state', async () => {
      const server = createReactiveMcpServer({ workspaceDir: tempDir, defaultSkill: '_test_fsm_skill' });
      const tools = (server as any)._registeredTools;

      const handler = tools['reactive_state'];

      // Trigger bypass by calling 3 times
      await handler.handler({}, {} as any);
      await handler.handler({}, {} as any);
      const res3 = await handler.handler({}, {} as any);

      expect(res3.isError).toBe(true);
      const parsed = JSON.parse(res3.content[0].text);
      expect(parsed.error).toContain('BYPASS_DETECTED');
      expect(parsed.recovery).toContain('reset');
    });
  });

  describe('Prompt slice strict_execution block', () => {
    it('should contain <strict_execution> block with TODO Card contract in strict mode', async () => {
      const server = createReactiveMcpServer({ workspaceDir: tempDir, defaultSkill: 'test-fsm' });
      const tools = (server as any)._registeredTools;

      const handler = tools['reactive_state'];
      const result = await handler.handler({ skill: 'test-fsm' }, {} as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.formattedXml).toContain('<strict_execution');
      expect(parsed.formattedXml).toContain('TODO Card');
      expect(parsed.formattedXml).toContain('Load -> Execute -> Emit');
      expect(parsed.formattedXml).toContain('reactive-skills-axi reset');
    });
  });

});
