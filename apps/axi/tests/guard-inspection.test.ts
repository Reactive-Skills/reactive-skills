import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectCommand } from '../src/commands/inspect.js';

let root: string;
afterEach(() => { if (root) fs.rmSync(root, { recursive: true, force: true }); });
it('inspects nested owning guards and module source without opening a run', async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'axi-guard-inspection-'));
  fs.writeFileSync(path.join(root, 'check.cjs'), 'throw new Error("Do not execute inspection source");');
  fs.writeFileSync(path.join(root, 'skill.yaml'), JSON.stringify({
    schema_version: '1', name: 'inspection', description: 'Inspection fixture', initial_state: 'WORK',
    states: { WORK: { initial_substate: 'LEAF', substates: { LEAF: { transitions: {
      CHECK: { target: 'DONE', guard: 'event.payload.ok === true', guardFunction: 'check.cjs' },
    } } } }, DONE: {} },
  }));
  const output = await inspectCommand([root, '--state', 'WORK.LEAF', '--signal', 'CHECK']);
  expect(JSON.parse(output)).toMatchObject({ state: 'WORK.LEAF', signal: 'CHECK', guard: 'event.payload.ok === true', guard_source: fs.readFileSync(path.join(root, 'check.cjs'), 'utf8') });
  expect(fs.readdirSync(root).sort()).toEqual(['check.cjs', 'skill.yaml']);
  for (const args of [ ['--state', 'WORK'], ['--signal', 'CHECK'], ['--state', '--signal', 'CHECK'], ['--state', 'WORK', '--signal', '--invalid'] ]) {
    expect(await inspectCommand([root, ...args])).toContain('Usage: inspect');
  }
});
