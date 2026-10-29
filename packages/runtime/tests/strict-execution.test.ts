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
      const engine = new FSMEngine({ skillDir, eventStore, workspaceDir: tempDir });

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

    it('names the skill directory in the recovery command, which can differ from the manifest name (#65)', () => {
      const skillDir = path.resolve(tempDir, 'skills', '_test_fsm_skill');
      const eventStore = new EventStore({ inMemory: true });
      const engine = new FSMEngine({ skillDir, eventStore, workspaceDir: tempDir });

      engine.recordTurnStart();
      engine.recordTurnStart();

      expect(() => engine.recordTurnStart()).toThrow('To recover, run: reactive-skills-axi reset _test_fsm_skill then re-invoke.');
    });

    it('should reset turn counter when emitting any signal', async () => {
      const skillDir = path.resolve(tempDir, 'skills', '_test_fsm_skill');
      const eventStore = new EventStore({ inMemory: true });
      const engine = new FSMEngine({ skillDir, eventStore, workspaceDir: tempDir });

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
      const engine = new FSMEngine({ skillDir, eventStore, workspaceDir: tempDir });

      expect(engine.isStrictExecution()).toBe(false);

      for (let i = 0; i < 10; i++) {
        engine.recordTurnStart();
      }
      expect(engine.isBypassDetected()).toBe(false);
    });

    it('should treat BYPASS_DETECTED state as terminal', async () => {
      const skillDir = path.resolve(tempDir, 'skills', '_test_fsm_skill');
      const eventStore = new EventStore({ inMemory: true });
      const engine = new FSMEngine({ skillDir, eventStore, workspaceDir: tempDir });

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
      const engine = new FSMEngine({ skillDir, eventStore, workspaceDir: tempDir });

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
      const engine1 = new FSMEngine({ skillDir, eventStore, workspaceDir: tempDir });

      engine1.recordTurnStart();
      engine1.recordTurnStart();
      expect(engine1.getTurnsSinceLastSignal()).toBe(2);

      // Create a new engine with the same event store - should rehydrate
      const engine2 = new FSMEngine({ skillDir, eventStore, workspaceDir: tempDir });
      expect(engine2.getTurnsSinceLastSignal()).toBe(2);
      expect(engine2.isBypassDetected()).toBe(false);
    });

    it('should restore inBypassState from event history', () => {
      const skillDir = path.resolve(tempDir, 'skills', '_test_fsm_skill');
      const eventStore = new EventStore({ inMemory: true });
      const engine1 = new FSMEngine({ skillDir, eventStore, workspaceDir: tempDir });

      engine1.recordTurnStart();
      engine1.recordTurnStart();
      expect(() => engine1.recordTurnStart()).toThrow('BYPASS_DETECTED');
      expect(engine1.isBypassDetected()).toBe(true);

      // Create a new engine with the same event store
      const engine2 = new FSMEngine({ skillDir, eventStore, workspaceDir: tempDir });
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

    const appendIdleEvent = (jobId: string, skillDir = path.join(tempDir, 'skills', '_test_fsm_skill'), workspaceDir = tempDir) => {
      const engine = new FSMEngine({ skillDir, workspaceDir, jobId });
      engine.getEventStore().append('IDLE_NOTE', {});
      engine.close();
    };

    it('does not count repeat reactive_state fetches of the same run/seq after compaction', async () => {
      const server = createReactiveMcpServer({ workspaceDir: tempDir, defaultSkill: '_test_fsm_skill' });
      const handler = (server as any)._registeredTools['reactive_state'];
      const fetch = async () => JSON.parse((await handler.handler({ job_id: 'refetch', output: 'compact-v1' }, {} as any)).content[0].text);

      const first = await fetch();
      const second = await fetch();
      const third = await fetch();
      const fourth = await fetch();

      expect(first.strict).toEqual(expect.objectContaining({ idle_limit: 2, turns_since_signal: 1 }));
      for (const view of [second, third, fourth]) {
        expect(view.error).toBeUndefined();
        expect(view.seq).toBe(first.seq);
        expect(view.strict.turns_since_signal).toBe(1);
      }
      const events = new FSMEngine({ skillDir: path.join(tempDir, 'skills', '_test_fsm_skill'), workspaceDir: tempDir, jobId: 'refetch' }).getEventStore().getAll();
      expect(events.filter(event => event.type === 'AGENT_TURN_STARTED')).toHaveLength(1);
      expect(events.some(event => event.type === 'BYPASS_DETECTED')).toBe(false);
    });

    it('counts each new idle delivery and bypasses past max_idle_turns', async () => {
      const server = createReactiveMcpServer({ workspaceDir: tempDir, defaultSkill: '_test_fsm_skill' });
      const handler = (server as any)._registeredTools['reactive_state'];
      const fetch = async () => handler.handler({ job_id: 'idle' }, {} as any);

      const parsed1 = JSON.parse((await fetch()).content[0].text);
      expect(parsed1.strict_execution).toBe(true);
      expect(parsed1.turns_since_last_signal).toBe(1);

      appendIdleEvent('idle');
      const parsed2 = JSON.parse((await fetch()).content[0].text);
      expect(parsed2.turns_since_last_signal).toBe(2);

      appendIdleEvent('idle');
      const res3 = await fetch();
      expect(res3.isError).toBe(true);
      const parsed3 = JSON.parse(res3.content[0].text);
      expect(parsed3.error).toContain('BYPASS_DETECTED');
      expect(parsed3.recovery).toBe('Run reactive-skills-axi reset _test_fsm_skill then re-invoke.');
    });

    it('keeps a quoted skill path whole in the recovery command, during and after bypass (#65)', async () => {
      const workspaceDir = path.join(tempDir, 'my workspace');
      const skillDir = path.join(workspaceDir, 'rooted');
      fs.mkdirSync(workspaceDir);
      fs.cpSync(path.join(tempDir, 'skills', '_test_fsm_skill'), skillDir, { recursive: true });
      const server = createReactiveMcpServer({ workspaceDir, defaultSkill: 'rooted' });
      const handler = (server as any)._registeredTools['reactive_state'];
      const call = async () => JSON.parse((await handler.handler({ job_id: 'stuck' }, {} as any)).content[0].text);

      await call();
      appendIdleEvent('stuck', skillDir, workspaceDir);
      await call();
      appendIdleEvent('stuck', skillDir, workspaceDir);
      const bypassed = await call();
      const stillBypassed = await call();

      const recovery = `Run reactive-skills-axi reset "${skillDir}" then re-invoke.`;
      expect(bypassed.error).toContain('BYPASS_DETECTED');
      expect(bypassed.recovery).toBe(recovery);
      expect(stillBypassed.recovery).toBe(recovery);
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
