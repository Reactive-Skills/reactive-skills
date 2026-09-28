import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as runtime from '@reactive-skills/runtime';
import { contextRouteCommand } from '../../src/commands/context-route.js';

describe('context-route command', () => {
  const originalApiKey = process.env.TYPESAFE_API_KEY;

  beforeEach(() => {
    delete process.env.TYPESAFE_API_KEY;
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it('discovers local skill candidates when --candidates is omitted', async () => {
    const message = 'Build package release gates';
    const discovered = [{ id: 'ci-gates', skill: 'ci-gates', summary: 'Build package release gates' }];
    const discoverySpy = vi.spyOn(runtime, 'discoverContextCandidates').mockReturnValue(discovered);
    const routeSpy = vi.spyOn(runtime.ContextRouter.prototype, 'route');

    await contextRouteCommand(['--message', message, '--json']);

    expect(discoverySpy).toHaveBeenCalledWith(message, process.cwd());
    expect(routeSpy).toHaveBeenCalledWith(expect.objectContaining({ candidates: discovered }));
  });

  it('uses an explicit skill list instead of auto-discovery', async () => {
    const explicit = [{ id: 'honcho', skill: 'honcho-axi', summary: 'Operate the Honcho AXI command' }];
    const discoverySpy = vi.spyOn(runtime, 'discoverContextCandidates');
    const routeSpy = vi.spyOn(runtime.ContextRouter.prototype, 'route');

    await contextRouteCommand([
      '--message', 'Operate Honcho AXI',
      '--candidates', JSON.stringify(explicit),
      '--json',
    ]);

    expect(discoverySpy).not.toHaveBeenCalled();
    expect(routeSpy).toHaveBeenCalledWith(expect.objectContaining({ candidates: explicit }));
  });

  it('treats an explicit empty skill list as no candidates', async () => {
    const discoverySpy = vi.spyOn(runtime, 'discoverContextCandidates');
    const routeSpy = vi.spyOn(runtime.ContextRouter.prototype, 'route');

    const result = JSON.parse(await contextRouteCommand([
      '--message', 'Choose a skill',
      '--candidates', '[]',
      '--json',
    ]));

    expect(result.adapter_selection_reason).toBe('no_candidates');
    expect(discoverySpy).not.toHaveBeenCalled();
    expect(routeSpy).toHaveBeenCalledWith(expect.objectContaining({ candidates: [] }));
  });

  it('shows candidate meaning and automatic discovery in command help', async () => {
    const result = await contextRouteCommand(['--help']);

    expect(result).toContain('Omit to discover workspace and agent skill metadata');
    expect(result).toContain('JSON array of skill metadata records');
    expect(result).toContain('not arbitrary task labels');
    expect(result).toContain('Each record requires id, skill, and summary');
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
    expect(result).toContain('Each candidate must describe one skill and include id, skill, and summary');
    expect(result).toContain('Candidates must be a JSON array of skill metadata records');
  });

  it('rejects non-array candidate input with skill-specific guidance', async () => {
    const result = await contextRouteCommand([
      '--message', 'Help me choose a next step',
      '--candidates', '{"id":"synthesis","skill":"synthesis","summary":"Turn ambiguity into a decision"}',
      '--json',
    ]);

    expect(result).toContain('Candidates must be a JSON array of skill metadata records');
    expect(result).toContain('not arbitrary task labels or data');
  });

  it('rejects candidate values that do not describe skills', async () => {
    const result = await contextRouteCommand([
      '--message', 'Help me choose a next step',
      '--candidates', '[null]',
      '--json',
    ]);

    expect(result).toContain('Each candidate must describe one skill and include id, skill, and summary');
    expect(result).toContain('not arbitrary task labels or data');
  });
});
