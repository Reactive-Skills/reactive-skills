import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractMermaid, measureInstructionBytes } from '../../../scripts/sync-registry.js';

describe('measureInstructionBytes', () => {
  let tmp;
  afterEach(() => {
    vi.restoreAllMocks();
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('orders nested state files by forward-slash path regardless of OS separator', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-registry-'));
    const statesDir = path.join(tmp, 'states');
    fs.mkdirSync(path.join(statesDir, 'a'), { recursive: true });
    fs.writeFileSync(path.join(statesDir, 'a', 'x.md'), '1');
    fs.writeFileSync(path.join(statesDir, 'a0.md'), '22');

    // '0' sorts between '/' and '\\', so raw paths order differently per OS.
    const linux = measureInstructionBytes(tmp).stateBytes;

    const realReaddir = fs.readdirSync;
    vi.spyOn(fs, 'readdirSync').mockImplementation((dir, opts) =>
      realReaddir(dir, opts).map((entry) => String(entry).split('/').join('\\')),
    );
    vi.spyOn(path, 'sep', 'get').mockReturnValue('\\');
    const windows = measureInstructionBytes(tmp).stateBytes;

    expect(linux).toEqual([1, 2]);
    expect(windows).toEqual(linux);
  });
});

describe('extractMermaid', () => {
  it('returns identical charts for LF and CRLF statecharts', () => {
    const lf = '# Chart\n\n```mermaid\nstateDiagram-v2\n  [*] --> INIT\n  INIT --> DONE\n```\n';
    const crlf = lf.replace(/\n/g, '\r\n');
    expect(extractMermaid(crlf)).toBe(extractMermaid(lf));
    expect(extractMermaid(crlf)).not.toContain('\r');
  });
});
