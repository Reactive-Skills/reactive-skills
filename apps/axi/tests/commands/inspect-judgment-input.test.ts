import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { inspectCommand } from '../../src/commands/inspect.js';

describe('inspect --judgment-input', () => {
  let directory: string;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'inspect-input-'));
    fs.writeFileSync(path.join(directory, 'skill.yaml'), yaml.dump({
      schema_version: '2.0.0', name: 'inspection', description: 'Dry input inspection', initial_state: 'ACTIVE',
      runtime_requirements: { required_capabilities: ['judgment.payload_selection'] },
      states: { ACTIVE: { substates: { REVIEW: { transitions: { CHECK: { target: 'ACTIVE', judgment: {
        type: 'predicate', criterion: 'Is the evidence adequate?', adapter_hint: 'jev', fallback_adapter: 'script',
        payload_paths: ['check.text'], context_paths: ['rubric'], required_context_paths: ['rubric'],
      } } } } } } },
    }));
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  it('prints adapter, destination, paths, missing evidence and byte count without opening a run', async () => {
    const output = await inspectCommand([directory, '--judgment-input', JSON.stringify({ payload: { check: { text: 'selected evidence' }, excluded: 'unrelated' } })]);
    const [inspection] = JSON.parse(output).judgment_inputs;
    expect(inspection).toMatchObject({
      adapter: 'jev', destinationClass: 'remote', fallbackAdapter: 'script', fallbackDestinationClass: 'local',
      contextPaths: ['rubric'], payloadPaths: ['check.text'], fullEvent: false, missingRequired: ['context.rubric'],
    });
    expect(inspection.byteCount).toBeGreaterThan(0);
    expect(inspection.transition).toContain('ACTIVE.REVIEW');
    expect(output).not.toMatch(/selected evidence|unrelated/);
    expect(fs.readdirSync(directory)).toEqual(['skill.yaml']);
  });

  it('accepts @file and reports invalid candidate data', async () => {
    const candidate = path.join(directory, 'candidate.json');
    fs.writeFileSync(candidate, JSON.stringify({ context: { rubric: 'rules' }, payload: { check: { text: 'text' } } }));
    expect(JSON.parse(await inspectCommand([directory, '--judgment-input', `@${candidate}`])).judgment_inputs[0].errors).toEqual([]);
    expect(await inspectCommand([directory, '--judgment-input', '[]'])).toContain('Judgment input must be an object');
    expect(await inspectCommand([directory, '--judgment-input', '{"context":null}'])).toContain('must be objects');
    expect(await inspectCommand([directory, '--judgment-input'])).toContain('Usage: inspect');
  });

  it('does not copy malformed candidate content into an inspection error', async () => {
    const output = await inspectCommand([directory, '--judgment-input', 'confidential-evidence']);
    expect(output).toContain('Judgment input must be valid JSON');
    expect(output).not.toContain('confidential-evidence');
  });
});
