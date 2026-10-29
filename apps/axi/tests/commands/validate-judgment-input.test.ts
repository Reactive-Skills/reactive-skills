import { describe, expect, it } from 'vitest';
import { lintJudgmentThresholds } from '../../src/commands/judgment-contracts.js';

describe('Input-selection authoring diagnostics', () => {
  it('recognizes engine-enforced scoping for an opt-in script judgment', () => {
    const lint = lintJudgmentThresholds({
      runtime_requirements: { required_capabilities: ['judgment.payload_selection'] },
      states: { REVIEW: { transitions: { CHECK: { target: 'REVIEW', judgment: {
        type: 'predicate', criterion: 'payload.exit_code === 0', adapter_hint: 'script',
        context_paths: [], payload_paths: ['exit_code'],
      } } } } },
    });
    expect(lint).toEqual({ errors: [], warnings: [] });
  });
});
