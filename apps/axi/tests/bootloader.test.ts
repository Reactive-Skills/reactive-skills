import { describe, expect, it } from 'vitest';
import { createAxiFirstInitState, createReactiveBootloader } from '../src/bootloader.js';

describe('reactive bootloader context routing', () => {
  it('instructs agents to prepare bounded context before prompt assembly', () => {
    const bootloader = createReactiveBootloader('example-skill');
    const initState = createAxiFirstInitState('example-skill');

    expect(bootloader).toContain('reactive_context_prepare');
    expect(bootloader).toContain('context_budget_tokens');
    expect(bootloader).toContain('without preloading unrelated skills');
    expect(initState).toContain('reactive_context_prepare');
  });
});
