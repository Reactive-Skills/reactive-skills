import { describe, expect, it } from 'vitest';
import { axi } from '@/infrastructure/content/docs/axi';
import { ERROR_CODES, exitCodeForError } from '../../axi/src/errors.ts';

const table = axi.sections.flatMap((section) => section.blocks || []).find((block) => block.caption === 'AXI Exit Code Contract');
const rows = table.rows.map(([code, errors]) => ({ exit: Number(code), named: errors.match(/\b[A-Z][A-Z_]+\b/g) || [] }));

describe('AXI exit code table', () => {
  it('lists exactly the exit codes the CLI can return', () => {
    const cliExits = new Set([0, ...ERROR_CODES.map(exitCodeForError)]);
    expect(rows.map((row) => row.exit).sort()).toEqual([...cliExits].sort());
  });

  it('names every real error code once, on the row of its exit code', () => {
    const named = rows.flatMap((row) => row.named.map((code) => [code, row.exit]));
    expect(named.map(([code]) => code).sort()).toEqual([...ERROR_CODES].sort());
    for (const [code, exit] of named) expect(exitCodeForError(code)).toBe(exit);
  });
});
