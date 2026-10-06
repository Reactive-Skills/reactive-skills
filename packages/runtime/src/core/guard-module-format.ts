import fs from 'node:fs';
import path from 'node:path';

export type GuardModuleFormat = 'esm' | 'cjs' | 'unknown';

export interface GuardModuleFormatReport {
  /** Module format Node will use for the file, from its extension and nearest package.json. */
  declared: 'esm' | 'cjs' | 'detect';
  /** Module syntax found in the source. `unknown` when neither style is recognised. */
  syntax: GuardModuleFormat;
  /** Actionable description when Node will not load the file. Absent when it should load. */
  problem?: string;
}

/** Node enabled `import`/`export` syntax detection for ambiguous `.js` files by default in 22.7. */
function nodeDetectsModuleSyntax(nodeVersion: string): boolean {
  const [major = 0, minor = 0] = nodeVersion.split('.').map(Number);
  if (major === 20) return minor >= 19;
  return major > 22 || (major === 22 && minor >= 7);
}

/** Remove comments and string/template literals so keywords inside them are not mistaken for syntax. */
function stripNonCode(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1')
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``')
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''");
}

const ESM_SYNTAX = /^[ \t]*(?:import\s*(?:[\w$*{]|"|')|export\s+(?:default\b|const\b|let\b|var\b|function\b|async\b|class\b|[{*]))|\bimport\.meta\b/m;
const CJS_SYNTAX = /\bmodule\.exports\b|\bexports\.[\w$]+\s*=|\brequire\s*\(/;

/** Sniff module syntax from source text. Never imports, requires, or evaluates the file. */
export function sniffGuardSyntax(source: string): GuardModuleFormat {
  const code = stripNonCode(source);
  if (ESM_SYNTAX.test(code)) return 'esm';
  if (CJS_SYNTAX.test(code)) return 'cjs';
  return 'unknown';
}

/** Read the `type` field of the nearest package.json at or above `dir`, as Node's scope lookup does. */
function nearestPackageType(dir: string): { type?: string; packageJson?: string } {
  let current = dir;
  for (;;) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        return { type: typeof parsed?.type === 'string' ? parsed.type : undefined, packageJson: candidate };
      } catch {
        return { packageJson: candidate };
      }
    }
    const parent = path.dirname(current);
    if (parent === current) return {};
    current = parent;
  }
}

/**
 * Statically check that a guard file's syntax matches the module format Node will load it as.
 * Reads the file as text and the package.json scope only; guard code is never executed.
 */
export function inspectGuardModuleFormat(
  filePath: string,
  displayPath: string = filePath,
  nodeVersion: string = process.versions.node
): GuardModuleFormatReport {
  const ext = path.extname(filePath).toLowerCase();
  const syntax = sniffGuardSyntax(fs.readFileSync(filePath, 'utf8'));

  if (ext === '.mjs') {
    const problem =
      syntax === 'cjs'
        ? `Guard function ${displayPath} is an ES module (.mjs) but uses CommonJS syntax (require/module.exports). Use import/export, or rename it to .cjs.`
        : undefined;
    return { declared: 'esm', syntax, problem };
  }

  if (ext === '.cjs') {
    const problem =
      syntax === 'esm'
        ? `Guard function ${displayPath} is CommonJS (.cjs) but uses ESM syntax (import/export). Rename it to .mjs, or use require/module.exports.`
        : undefined;
    return { declared: 'cjs', syntax, problem };
  }

  const { type, packageJson } = nearestPackageType(path.dirname(filePath));
  if (type === 'module') {
    const problem =
      syntax === 'cjs'
        ? `Guard function ${displayPath} uses CommonJS syntax (require/module.exports) but ${packageJson} sets "type": "module". Rename it to .cjs, or use import/export.`
        : undefined;
    return { declared: 'esm', syntax, problem };
  }
  if (type === 'commonjs') {
    const problem =
      syntax === 'esm'
        ? `Guard function ${displayPath} uses ESM syntax (import/export) but ${packageJson} sets "type": "commonjs". Rename it to .mjs, or set "type": "module" in that package.json.`
        : undefined;
    return { declared: 'cjs', syntax, problem };
  }

  const problem =
    syntax === 'esm' && !nodeDetectsModuleSyntax(nodeVersion)
      ? `Guard function ${displayPath} uses ESM syntax (import/export) in a .js file with no "type" in its nearest package.json, and Node ${nodeVersion} does not detect module syntax. Rename it to .mjs, or set "type": "module" in a package.json at or above the guards directory.`
      : undefined;
  return { declared: 'detect', syntax, problem };
}
