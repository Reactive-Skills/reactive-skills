import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createReactiveMcpServer } from '../src/mcp/server.js';
import { JudgmentEngine } from '../src/core/judgment-engine.js';

const sdkMock = vi.hoisted(() => ({
  systemOne: vi.fn(),
  choice: vi.fn((instructions: unknown, criteria: unknown) => ({ type: 'choice', instructions, criteria })),
}));

vi.mock('@typesafe-ai/sdk', () => ({
  TypeSafeClient: class {
    public systemOne(...args: unknown[]) {
      return sdkMock.systemOne(...args);
    }
  },
  choice: sdkMock.choice,
}));

describe('reactive_context_prepare', () => {
  let tempDir: string;
  let originalApiKey: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-context-prepare-test-'));
    fs.cpSync(path.resolve(process.cwd(), 'skills'), path.join(tempDir, 'skills'), { recursive: true });
    originalApiKey = process.env.TYPESAFE_API_KEY;
    process.env.TYPESAFE_API_KEY = 'test-key';
    sdkMock.systemOne.mockReset();
    sdkMock.systemOne.mockResolvedValue({
      model: 'jev-test',
      answers: { judgment: { type: 'choice', choice: 'route_0_active_state_standard', confidence: 0.94 } },
      usage: { input_tokens: 42, output_tokens: 0 },
    });
    JudgmentEngine.reset();
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore Windows cleanup locks held by the cached engine.
    }
    if (originalApiKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalApiKey;
  });

  it('loads only the selected reactive active-state slice', async () => {
    const server = createReactiveMcpServer({ workspaceDir: tempDir, defaultSkill: 'test-fsm' });
    const tools = (server as any)._registeredTools;

    const result = await tools['reactive_context_prepare'].handler({
      user_message: 'Run the state machine test',
      candidates: [{ id: 'test', skill: 'test-fsm', summary: 'Run a state machine test' }],
    }, {} as any);
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.context_route.route).toBe('skill');
    expect(parsed.context_route.skill).toBe('test-fsm');
    expect(parsed.context.source).toBe('reactive_state');
    expect(parsed.context.activeState).toBe('INIT');
    expect(parsed.context.promptSlice).toEqual(expect.any(String));
    expect(sdkMock.systemOne).toHaveBeenCalledOnce();
  });
});
