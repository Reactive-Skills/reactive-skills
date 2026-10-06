import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { inspectGuardModuleFormat, sniffGuardSyntax } from '../src/core/guard-module-format.js';

// Issue #10: a guard file in the wrong module format is reported before, and diagnosed at, load time.

const esmGuard = `export default function guard() { return true; }\n`;
const cjsGuard = `module.exports = function guard() { return true; };\n`;

describe('Guard module format (#10)', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-guard-format-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const write = (name: string, content: string) => {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    return file;
  };

  describe('inspectGuardModuleFormat', () => {
    it('accepts ESM in a .mjs file', () => {
      expect(inspectGuardModuleFormat(write('g.mjs', esmGuard)).problem).toBeUndefined();
    });

    it('accepts CommonJS in a .cjs file', () => {
      expect(inspectGuardModuleFormat(write('g.cjs', cjsGuard)).problem).toBeUndefined();
    });

    it('accepts CommonJS in a .js file under a commonjs package scope', () => {
      write('package.json', '{"type":"commonjs"}');
      expect(inspectGuardModuleFormat(write('guards/g.js', cjsGuard)).problem).toBeUndefined();
    });

    it('accepts ESM in a .js file under a module package scope', () => {
      write('package.json', '{"type":"module"}');
      expect(inspectGuardModuleFormat(write('guards/g.js', esmGuard)).problem).toBeUndefined();
    });

    it('reports ESM in a .js file under a commonjs package scope, naming the file and the fix', () => {
      write('package.json', '{"type":"commonjs"}');
      const { problem } = inspectGuardModuleFormat(write('guards/g.js', esmGuard), 'guards/g.js');
      expect(problem).toContain('guards/g.js');
      expect(problem).toContain('"type": "commonjs"');
      expect(problem).toContain('.mjs');
      expect(problem).toContain('"type": "module"');
    });

    it('uses the nearest package.json, not the outermost', () => {
      write('package.json', '{"type":"commonjs"}');
      write('guards/package.json', '{"type":"module"}');
      expect(inspectGuardModuleFormat(write('guards/g.js', esmGuard)).problem).toBeUndefined();
    });

    it('reports ESM in a .js file with no type only on Node without module-syntax detection', () => {
      const file = write('g.js', esmGuard);
      expect(inspectGuardModuleFormat(file, 'g.js', '22.7.0').problem).toBeUndefined();
      expect(inspectGuardModuleFormat(file, 'g.js', '22.6.0').problem).toContain('does not detect module syntax');
    });

    it('reports mismatched syntax in .mjs, .cjs, and module-scope .js files', () => {
      expect(inspectGuardModuleFormat(write('a.mjs', cjsGuard)).problem).toContain('rename it to .cjs');
      expect(inspectGuardModuleFormat(write('b.cjs', esmGuard)).problem).toContain('Rename it to .mjs');
      write('m/package.json', '{"type":"module"}');
      expect(inspectGuardModuleFormat(write('m/c.js', cjsGuard)).problem).toContain('"type": "module"');
    });

    it('does not execute the guard while inspecting it', () => {
      const marker = path.join(dir, 'ran');
      const file = write(
        'guards/g.js',
        `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'x');\nexport default () => true;\n`
      );
      inspectGuardModuleFormat(file);
      expect(fs.existsSync(marker)).toBe(false);
    });
  });

  describe('sniffGuardSyntax', () => {
    it('ignores module keywords inside comments and strings', () => {
      expect(sniffGuardSyntax(`// export default x\nconst s = "import x from 'y'";\n`)).toBe('unknown');
    });

    it('treats dynamic import() as neutral and import.meta as ESM', () => {
      expect(sniffGuardSyntax(`const m = await import('node:fs');\nmodule.exports = m;`)).toBe('cjs');
      expect(sniffGuardSyntax(`const u = import.meta.url;`)).toBe('esm');
    });
  });

  describe('runtime diagnostic', () => {
    let engine: FSMEngine | undefined;

    afterEach(() => {
      engine?.close();
      engine = undefined;
    });

    // vitest's module loader ignores package.json scopes, so this uses a guard Node rejects at parse
    // time; the scope-specific hint is covered by the inspectGuardModuleFormat tests above.
    it('blocks the transition with an actionable message when a guard fails to load', async () => {
      const workspaceDir = dir;
      const skillDir = path.join(workspaceDir, 'skills', 'fmt-skill');
      write('skills/fmt-skill/skill.yaml', `schema_version: "2.0.0"
name: fmt-skill
description: "Guard format fixture"
initial_state: REVIEW
states:
  REVIEW:
    description: "Review"
    transitions:
      GO:
        target: DONE
        guardFunction: guards/esm.js
  DONE:
    description: "Done"
`);
      write('skills/fmt-skill/guards/esm.js', 'export default function (\n');

      engine = new FSMEngine({ skillDir, workspaceDir });
      const result = await engine.handleSignal('GO', {});

      expect(result.transitioned).toBe(false);
      expect(result.refusalReason).toContain('guards/esm.js');
      expect(result.refusalReason).toContain('failed to load');
      expect(result.refusalReason).toContain('module format');
    });
  });
});
