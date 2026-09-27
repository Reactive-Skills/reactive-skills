import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contextRouteCommand } from '../../src/commands/context-route.js';

describe('context-route command', () => {
  const originalApiKey = process.env.TYPESAFE_API_KEY;

  beforeEach(() => {
    delete process.env.TYPESAFE_API_KEY;
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalApiKey;
  });

  it('returns machine-readable fail-closed routing', async () => {
    const result = JSON.parse(await contextRouteCommand([
      '--message', 'Help me choose a next step',
      '--candidates', '[{"id":"synthesis","skill":"synthesis","summary":"Turn ambiguity into a decision"}]',
      '--json',
    ]));

    expect(result.route).toBe('none');
    expect(result.adapter).toBe('script');
  });

  it('explains the required fields when candidate metadata is malformed', async () => {
    const result = await contextRouteCommand([
      '--message', 'Help me choose a next step',
      '--candidates', '[{"name":"synthesis","description":"Turn ambiguity into a decision"}]',
      '--json',
    ]);

    expect(result).toContain('code: VALIDATION_ERROR');
    expect(result).toContain('Each context route candidate needs id, skill, and summary');
    expect(result).toContain('Use candidate entries shaped like {"id":"...","skill":"...","summary":"..."}');
  });
});
