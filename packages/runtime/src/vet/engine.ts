import fs from 'node:fs';
import path from 'node:path';
import { compileAllowlist, type CompiledAllowlistEntry } from './allowlist.js';
import { compilesAsExpression, findSandboxEscape, relativeModuleSpecifiers, scanCode, type CodeLanguage } from './code-rules.js';
import { readSkillManifest } from './manifest.js';
import { getVetRule, meetsThreshold, severityRank } from './rules.js';
import { LineIndex, type VetHit } from './source.js';
import {
  classifyBinary,
  inspectOtherManifest,
  inspectPackageJson,
  isUnsupportedScript,
  shebangLanguage,
  VENDORED_DIRECTORIES,
} from './supply-rules.js';
import {
  classifyComment,
  findHiddenComments,
  scanDownloadExec,
  scanEncodedBlobs,
  scanHiddenCharacters,
  scanInstructionsWithin,
  scanLongLines,
  scanWhitespaceRuns,
} from './text-rules.js';
import type {
  VetAllowlist,
  VetFinding,
  VetOptions,
  VetReport,
  VetSeverity,
  VetSkillReport,
  VetSuppressedFinding,
} from './types.js';

/** Files larger than this are reported as not scanned, so padding cannot hide content. */
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_FILES = 20_000;
const MAX_DEPTH = 40;
const MAX_GUARD_CLOSURE = 200;
/** Time one file may spend in the prompt-injection patterns before it is reported as not scanned. */
const INSTRUCTION_SCAN_BUDGET_MS = 3000;

const SKIPPED_DIRECTORIES = new Set(['.git', '.reactive']);

type FileKind = 'js' | 'py' | 'sh' | 'go' | 'prose' | 'yaml' | 'json' | 'text';

const EXTENSION_KINDS: Record<string, FileKind> = {
  '.js': 'js', '.cjs': 'js', '.mjs': 'js', '.jsx': 'js', '.ts': 'js', '.tsx': 'js', '.mts': 'js', '.cts': 'js',
  '.py': 'py', '.pyw': 'py',
  '.sh': 'sh', '.bash': 'sh', '.zsh': 'sh', '.fish': 'sh', '.ksh': 'sh', '.ps1': 'sh', '.psm1': 'sh', '.bat': 'sh', '.cmd': 'sh',
  '.go': 'go',
  '.md': 'prose', '.mdx': 'prose', '.markdown': 'prose', '.txt': 'prose', '.hbs': 'prose', '.handlebars': 'prose', '.mustache': 'prose',
  '.rst': 'prose', '.adoc': 'prose', '.mdoc': 'prose',
  '.yaml': 'yaml', '.yml': 'yaml',
  '.json': 'json', '.jsonc': 'json', '.json5': 'json',
};

const toPosix = (value: string): string => value.split(path.sep).join('/');

function decodeText(bytes: Buffer): string | undefined {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.subarray(2).toString('utf16le');
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = Buffer.from(bytes.subarray(2));
    swapped.swap16();
    return swapped.toString('utf16le');
  }
  return bytes.subarray(0, 8192).includes(0) ? undefined : bytes.toString('utf8');
}

interface FindingBuilder {
  rule: string;
  file: string;
  line: number;
  count: number;
  details: Set<string>;
  guard: boolean;
}

class FindingSet {
  private readonly byKey = new Map<string, FindingBuilder>();

  add(rule: string, file: string, line: number, guard: boolean, detail?: string): void {
    const key = `${rule}\0${file}`;
    const existing = this.byKey.get(key);
    if (existing) {
      existing.count++;
      existing.line = Math.min(existing.line, line);
      if (detail && existing.details.size < 3) existing.details.add(detail);
      return;
    }
    this.byKey.set(key, { rule, file, line, count: 1, details: new Set(detail ? [detail] : []), guard });
  }

  addHits(hits: VetHit[], file: string, lines: LineIndex, guard: boolean): void {
    for (const hit of hits) this.add(hit.rule, file, lines.lineAt(hit.index), guard, hit.detail);
  }

  toFindings(): VetFinding[] {
    const findings: VetFinding[] = [];
    for (const builder of this.byKey.values()) {
      const rule = getVetRule(builder.rule);
      if (!rule) continue;
      const details = [...builder.details].join(', ');
      findings.push({
        rule: rule.id,
        severity: rule.severity,
        file: builder.file,
        line: builder.line,
        message: details ? `${rule.summary} (${details})` : rule.summary,
        count: builder.count,
        ...(builder.guard ? { guard: true } : {}),
      });
    }
    return findings.sort(compareFindings);
  }
}

function compareFindings(a: VetFinding, b: VetFinding): number {
  return (
    severityRank(a.severity) - severityRank(b.severity) ||
    (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) ||
    a.line - b.line ||
    (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0)
  );
}

interface GuardFiles {
  /** Skill-relative paths of files loaded as guardFunctions or required by one. */
  files: Set<string>;
}

function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

const RESOLVE_SUFFIXES = ['', '.js', '.cjs', '.mjs', '.json', '/index.js', '/index.cjs', '/index.mjs'];

function resolveRelativeModule(realRoot: string, fromFile: string, specifier: string): string | undefined {
  const base = path.resolve(path.dirname(fromFile), specifier);
  for (const suffix of RESOLVE_SUFFIXES) {
    const candidate = base + suffix.replace('/', path.sep);
    try {
      if (!fs.statSync(candidate).isFile()) continue;
      const real = fs.realpathSync(candidate);
      return isInside(realRoot, real) ? real : undefined;
    } catch {
      // Try the next suffix.
    }
  }
  return undefined;
}

/** Find the guardFunction files a manifest names, then the relative modules they load. */
function collectGuardFiles(skillRoot: string, realRoot: string, guards: ReturnType<typeof readSkillManifest>['guards'], manifestFile: string | undefined, findings: FindingSet): GuardFiles {
  const files = new Set<string>();
  const queue: string[] = [];

  for (const guard of guards) {
    if (guard.guardFunction === undefined) continue;
    const full = path.resolve(skillRoot, guard.guardFunction);
    let outside = !isInside(skillRoot, full);
    let real: string | undefined;
    if (!outside) {
      try {
        real = fs.realpathSync(full);
        outside = !isInside(realRoot, real);
      } catch {
        real = undefined;
      }
    }
    if (outside) {
      findings.add('guard/path-escape', manifestFile ?? 'skill.yaml', guard.line, false);
      continue;
    }
    if (real) queue.push(real);
  }

  while (queue.length > 0 && files.size < MAX_GUARD_CLOSURE) {
    const file = queue.shift()!;
    const rel = toPosix(path.relative(realRoot, file));
    if (files.has(rel)) continue;
    files.add(rel);
    if (!['.js', '.cjs', '.mjs'].includes(path.extname(file).toLowerCase())) continue;
    let source: string;
    try {
      if (fs.statSync(file).size > MAX_FILE_BYTES) continue;
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const specifier of relativeModuleSpecifiers(source)) {
      const next = resolveRelativeModule(realRoot, file, specifier);
      if (next) queue.push(next);
    }
  }
  return { files };
}

interface WalkResult {
  files: Array<{ rel: string; abs: string }>;
}

function walk(realRoot: string, findings: FindingSet): WalkResult {
  const files: WalkResult['files'] = [];
  let truncated = false;

  const visit = (dir: string, depth: number): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      findings.add('scan/not-scanned', toPosix(path.relative(realRoot, dir)) || '.', 1, false);
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = toPosix(path.relative(realRoot, abs));
      if (entry.isSymbolicLink()) {
        try {
          const real = fs.realpathSync(abs);
          if (isInside(realRoot, real)) continue;
        } catch {
          // A link that cannot be resolved is reported below.
        }
        findings.add('supply/symlink', rel, 1, false);
        continue;
      }
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
        if (VENDORED_DIRECTORIES.has(entry.name)) {
          findings.add('supply/vendored-dependencies', rel, 1, false);
          continue;
        }
        if (depth >= MAX_DEPTH) {
          findings.add('scan/not-scanned', rel, 1, false);
          continue;
        }
        visit(abs, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      if (files.length >= MAX_FILES) {
        truncated = true;
        continue;
      }
      files.push({ rel, abs });
    }
  };

  visit(realRoot, 0);
  if (truncated) findings.add('scan/not-scanned', '.', 1, false);
  return { files };
}

function classify(rel: string, text: string): FileKind | 'limited' {
  const ext = path.extname(rel).toLowerCase();
  const head = text.slice(0, 200);
  if (ext in EXTENSION_KINDS) return EXTENSION_KINDS[ext];
  if (isUnsupportedScript(rel, head)) return 'limited';
  const language = shebangLanguage(head);
  return language ?? 'text';
}

/** Read a whole file with one open, refusing files over the size limit before reading them. */
function readBounded(abs: string): Buffer {
  const fd = fs.openSync(abs, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    if (size > MAX_FILE_BYTES) throw new Error('file too large');
    const bytes = Buffer.allocUnsafe(size);
    let offset = 0;
    while (offset < size) {
      const read = fs.readSync(fd, bytes, offset, size - offset, offset);
      if (read === 0) break;
      offset += read;
    }
    return offset === size ? bytes : bytes.subarray(0, offset);
  } finally {
    fs.closeSync(fd);
  }
}

function scanFile(rel: string, abs: string, guard: boolean, findings: FindingSet): void {
  let bytes: Buffer;
  try {
    bytes = readBounded(abs);
  } catch {
    // Too large, or not readable: either way the content was not checked, and that is a finding.
    findings.add('scan/not-scanned', rel, 1, guard);
    return;
  }

  const text = decodeText(bytes);
  if (text === undefined) {
    const kind = classifyBinary(rel, bytes);
    if (kind === 'executable') findings.add('supply/binary-executable', rel, 1, guard);
    else if (kind === 'archive' || kind === 'unknown') findings.add('supply/binary-unknown', rel, 1, guard);
    return;
  }

  const lines = new LineIndex(text);
  const add = (hits: VetHit[]): void => findings.addHits(hits, rel, lines, guard);
  const kind = classify(rel, text);

  add(scanHiddenCharacters(text));
  add(scanWhitespaceRuns(text));
  add(scanEncodedBlobs(text));

  if (kind === 'limited') {
    findings.add('scan/limited-analysis', rel, 1, guard);
    add(scanDownloadExec(text));
    return;
  }
  if (kind !== 'json') add(scanLongLines(text));

  if (kind === 'js' || kind === 'py' || kind === 'sh' || kind === 'go') {
    add(scanCode(kind as CodeLanguage, text));
    add(scanDownloadExec(text));
    return;
  }

  if (kind === 'prose' || kind === 'yaml') {
    const instructions = scanInstructionsWithin(text, INSTRUCTION_SCAN_BUDGET_MS);
    add(instructions.hits);
    if (instructions.timedOut) findings.add('scan/not-scanned', rel, 1, guard);
    add(scanDownloadExec(text));
    if (kind === 'prose') {
      const hidden = findHiddenComments(text);
      if (hidden.truncated) findings.add('scan/not-scanned', rel, 1, guard);
      for (const comment of hidden.comments) {
        const verdict = classifyComment(comment);
        if (verdict === 'instruction') add([{ rule: 'hidden/comment-instruction', index: comment.index }]);
        else if (verdict === 'prose') add([{ rule: 'hidden/comment-prose', index: comment.index }]);
      }
    }
    return;
  }

  if (kind === 'json' && path.basename(rel).toLowerCase() === 'package.json') {
    const pkg = inspectPackageJson(text);
    if (pkg) {
      for (const hit of pkg.hits) findings.add(hit.rule, rel, 1, guard, hit.detail);
      for (const script of pkg.scripts) {
        for (const hit of scanDownloadExec(script)) findings.add(hit.rule, rel, 1, guard, hit.detail);
      }
    }
    return;
  }

  add(inspectOtherManifest(rel, text));
}

/**
 * Statically vet one skill directory. Files are read as text or bytes and matched against the
 * rule catalog; no skill file is imported, required or executed.
 */
export function vetSkill(skillDir: string, options: VetOptions = {}): VetSkillReport {
  const skillRoot = path.resolve(skillDir);
  const skill = path.basename(skillRoot);
  const findings = new FindingSet();

  let realRoot: string;
  try {
    realRoot = fs.realpathSync(skillRoot);
  } catch {
    throw new Error(`Skill directory not found: ${skillDir}`);
  }
  if (!fs.statSync(realRoot).isDirectory()) throw new Error(`Not a directory: ${skillDir}`);

  let filesScanned = 0;
  if (fs.lstatSync(skillRoot).isSymbolicLink()) {
    // A link found while listing a catalog could point anywhere, so it is reported and not walked.
    // A caller that was told to vet one link resolves it first, as the AXI command does.
    findings.add('supply/symlink', '.', 1, false, 'skill directory');
  } else {
    const manifest = readSkillManifest(realRoot);
    if (manifest.problem) findings.add('scan/invalid-manifest', manifest.file ?? 'skill.yaml', 1, false);

    for (const guard of manifest.guards) {
      const expression = guard.expression ?? (guard.criterion !== undefined && compilesAsExpression(guard.criterion) ? guard.criterion : undefined);
      if (expression === undefined) continue;
      const escape = findSandboxEscape(expression);
      if (escape) findings.add('guard/sandbox-escape', manifest.file ?? 'skill.yaml', guard.line, false, escape.detail);
    }
    const guardFiles = collectGuardFiles(realRoot, realRoot, manifest.guards, manifest.file, findings);

    const { files } = walk(realRoot, findings);
    for (const file of files) scanFile(file.rel, file.abs, guardFiles.files.has(file.rel), findings);
    filesScanned = files.length;
  }

  const all = findings.toFindings();
  const { active, suppressed } = applyAllowlist(skill, all, options.allowlist ? compileAllowlist(options.allowlist) : [], options.usedEntries);
  return { skill, path: realRoot, filesScanned, findings: active, suppressed };
}

function applyAllowlist(
  skill: string,
  findings: VetFinding[],
  entries: CompiledAllowlistEntry[],
  used?: Set<string>
): { active: VetFinding[]; suppressed: VetSuppressedFinding[] } {
  if (entries.length === 0) return { active: findings, suppressed: [] };
  const active: VetFinding[] = [];
  const suppressed: VetSuppressedFinding[] = [];
  for (const finding of findings) {
    const entry = entries.find((candidate) => candidate.skill === skill && candidate.rule === finding.rule && candidate.matcher.test(finding.file));
    if (entry) {
      used?.add(`${entry.skill}\0${entry.rule}\0${entry.path}`);
      suppressed.push({ ...finding, reason: entry.reason });
    } else {
      active.push(finding);
    }
  }
  return { active, suppressed };
}

const SKILL_MARKERS = ['skill.yaml', 'skill.yml', 'SKILL.md'];

/** True when the directory has a manifest or a SKILL.md, which is what makes it a skill. */
export function isSkillDirectory(dir: string): boolean {
  return SKILL_MARKERS.some((marker) => fs.existsSync(path.join(dir, marker)));
}

/**
 * Resolve a vet target to the skill directories under it: the directory itself when it is a skill,
 * otherwise each immediate subdirectory that is one. Returns an empty list when there are none.
 */
export function discoverVetTargets(root: string): string[] {
  const resolved = path.resolve(root);
  if (!fs.statSync(resolved).isDirectory()) throw new Error(`Not a directory: ${root}`);
  if (isSkillDirectory(resolved)) return [resolved];
  const skills: string[] = [];
  for (const entry of fs.readdirSync(resolved, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const child = path.join(resolved, entry.name);
    const isDirectory = entry.isDirectory() || (entry.isSymbolicLink() && fs.statSync(child, { throwIfNoEntry: false })?.isDirectory());
    if (isDirectory && isSkillDirectory(child)) skills.push(child);
  }
  return skills.sort();
}

export interface VetRunOptions extends VetOptions {
  /** Findings at or above this severity fail the run. Defaults to high. */
  failOn?: VetSeverity;
}

/** Vet several skill directories and summarize the result against a failure threshold. */
export function vetSkills(skillDirs: string[], options: VetRunOptions = {}): VetReport {
  const failOn = options.failOn ?? 'high';
  const used = new Set<string>();
  const skills = skillDirs.map((dir) => vetSkill(dir, { allowlist: options.allowlist, usedEntries: used }));
  return buildReport(skills, failOn, options.allowlist, used);
}

function buildReport(skills: VetSkillReport[], failOn: VetSeverity, allowlist: VetAllowlist | undefined, used: Set<string>): VetReport {
  const summary = { skills: skills.length, filesScanned: 0, high: 0, medium: 0, low: 0, suppressed: 0 };
  let failed = false;
  for (const report of skills) {
    summary.filesScanned += report.filesScanned;
    summary.suppressed += report.suppressed.length;
    for (const finding of report.findings) {
      summary[finding.severity]++;
      if (meetsThreshold(finding.severity, failOn)) failed = true;
    }
  }
  const unusedAllowlist = (allowlist?.entries ?? []).filter((entry) => !used.has(`${entry.skill}\0${entry.rule}\0${entry.path}`));
  return { failOn, failed, summary, skills, unusedAllowlist };
}
