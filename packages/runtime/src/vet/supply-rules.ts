import path from 'node:path';
import type { VetHit } from './source.js';

export type BinaryClass = 'executable' | 'archive' | 'media' | 'unknown';

const EXECUTABLE_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.node', '.wasm', '.class', '.jar', '.war', '.msi', '.scr', '.com', '.pyc', '.pyd', '.o', '.a', '.lib',
  '.apk', '.ipa', '.dmg', '.deb', '.rpm', '.docm', '.xlsm', '.pptm',
]);
const ARCHIVE_EXTENSIONS = new Set(['.zip', '.tar', '.tgz', '.gz', '.bz2', '.xz', '.7z', '.rar', '.zst']);
/** Formats that cannot run code. A signature of an executable under one of these names is still reported. */
const MEDIA_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.ico', '.icns', '.tif', '.tiff', '.pdf',
  '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp3', '.mp4', '.m4a', '.wav', '.ogg', '.webm', '.mov', '.flac',
  '.docx', '.xlsx', '.pptx', '.odt', '.ods', '.odp', '.epub',
]);

const startsWith = (bytes: Buffer, ...signature: number[]): boolean => signature.every((value, i) => bytes[i] === value);

/** Classify a binary file from its name and signature. Nothing is parsed beyond the first bytes. */
export function classifyBinary(fileName: string, bytes: Buffer): BinaryClass {
  const ext = path.extname(fileName).toLowerCase();
  const executableSignature =
    startsWith(bytes, 0x7f, 0x45, 0x4c, 0x46) ||
    startsWith(bytes, 0x4d, 0x5a) ||
    startsWith(bytes, 0x00, 0x61, 0x73, 0x6d) ||
    startsWith(bytes, 0xfe, 0xed, 0xfa) ||
    startsWith(bytes, 0xcf, 0xfa, 0xed, 0xfe) ||
    startsWith(bytes, 0xce, 0xfa, 0xed, 0xfe) ||
    startsWith(bytes, 0xca, 0xfe, 0xba, 0xbe);
  if (executableSignature || EXECUTABLE_EXTENSIONS.has(ext)) return 'executable';

  const archiveSignature =
    startsWith(bytes, 0x1f, 0x8b) ||
    startsWith(bytes, 0x50, 0x4b, 0x03, 0x04) ||
    startsWith(bytes, 0x42, 0x5a, 0x68) ||
    startsWith(bytes, 0x37, 0x7a, 0xbc, 0xaf) ||
    startsWith(bytes, 0xfd, 0x37, 0x7a, 0x58, 0x5a) ||
    startsWith(bytes, 0x52, 0x61, 0x72, 0x21) ||
    bytes.subarray(257, 262).toString('latin1') === 'ustar';
  if (ARCHIVE_EXTENSIONS.has(ext)) return 'archive';
  if (MEDIA_EXTENSIONS.has(ext)) {
    // Office documents are zip containers by design; only other media with an archive signature is odd.
    return archiveSignature && !['.docx', '.xlsx', '.pptx', '.odt', '.ods', '.odp', '.epub'].includes(ext) ? 'archive' : 'media';
  }
  return archiveSignature ? 'archive' : 'unknown';
}

/** Extensions of scripts in languages with no code rules. */
const UNSUPPORTED_SCRIPT_EXTENSIONS = new Set(['.rb', '.pl', '.pm', '.php', '.lua', '.tcl', '.vbs', '.wsf', '.awk', '.groovy', '.r']);
const UNSUPPORTED_INTERPRETERS = /^#!\s*(?:\/usr\/bin\/env\s+)?(?:\S*\/)?(?:ruby|perl|php|lua|tclsh|wish|awk|gawk|groovy|Rscript)\b/;

export function isUnsupportedScript(fileName: string, head: string): boolean {
  return UNSUPPORTED_SCRIPT_EXTENSIONS.has(path.extname(fileName).toLowerCase()) || UNSUPPORTED_INTERPRETERS.test(head);
}

/** The interpreter named on a shebang line, which classifies extensionless scripts. */
export function shebangLanguage(head: string): 'js' | 'py' | 'sh' | undefined {
  const m = /^#!\s*(?:\/usr\/bin\/env\s+(?:-\S+\s+)*)?(?:\S*\/)?(\w+)/.exec(head);
  if (!m) return undefined;
  if (/^(?:sh|bash|zsh|dash|ksh|fish|ash)$/.test(m[1])) return 'sh';
  if (/^python\d*$/.test(m[1])) return 'py';
  if (/^(?:node|bun|deno|tsx|ts-node)$/.test(m[1])) return 'js';
  return undefined;
}

const INSTALL_LIFECYCLE = ['preinstall', 'install', 'postinstall', 'prepare'];
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'bundledDependencies'];
const REMOTE_SPEC = /^(?:https?:|git\+|git:|ssh:|github:|gitlab:|bitbucket:|gist:|file:|link:|portal:|[\w.-]+\/[\w.-]+(?:#.*)?$)/i;

export interface PackageJsonFindings {
  hits: Array<{ rule: string; detail?: string }>;
  /** Script bodies, so the download-and-execute scan can read them. */
  scripts: string[];
}

/** Read a package.json as data. The file is parsed, never required. */
export function inspectPackageJson(text: string): PackageJsonFindings | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
  const pkg = parsed as Record<string, unknown>;
  const result: PackageJsonFindings = { hits: [], scripts: [] };

  const scripts = pkg.scripts;
  if (scripts !== null && typeof scripts === 'object' && !Array.isArray(scripts)) {
    for (const [name, body] of Object.entries(scripts as Record<string, unknown>)) {
      if (typeof body !== 'string') continue;
      result.scripts.push(body);
      if (INSTALL_LIFECYCLE.includes(name)) result.hits.push({ rule: 'supply/install-script', detail: name });
    }
  }

  let dependencyCount = 0;
  for (const field of DEPENDENCY_FIELDS) {
    const block = pkg[field];
    const entries: Array<[string, unknown]> = Array.isArray(block)
      ? block.map((name): [string, unknown] => [String(name), '*'])
      : block !== null && typeof block === 'object'
        ? Object.entries(block as Record<string, unknown>)
        : [];
    for (const [, spec] of entries) {
      dependencyCount++;
      if (typeof spec === 'string' && REMOTE_SPEC.test(spec.trim())) {
        result.hits.push({ rule: 'supply/remote-dependency', detail: field });
      }
    }
  }
  if (dependencyCount > 0) result.hits.push({ rule: 'supply/dependency-manifest', detail: `${dependencyCount} in package.json` });
  return result;
}

const MANIFEST_FILES = new Set(['pyproject.toml', 'pipfile', 'cargo.toml', 'gemfile', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'composer.json']);

/** Hits for dependency manifests other than package.json. */
export function inspectOtherManifest(fileName: string, text: string): VetHit[] {
  const lower = path.basename(fileName).toLowerCase();
  const hit = (detail: string): VetHit[] => [{ rule: 'supply/dependency-manifest', index: 0, detail }];
  if (lower === 'go.mod') {
    return /^\s*require\b/m.test(text) ? hit('go.mod') : [];
  }
  if (/^requirements[\w.-]*\.txt$/.test(lower)) {
    const lines = text.split('\n').filter((line) => /^\s*[A-Za-z0-9@.\-_[]/.test(line) && !line.trim().startsWith('#'));
    const hits = lines.length > 0 ? hit(lower) : [];
    if (lines.some((line) => /(?:git\+|https?:\/\/|\s@\s)/.test(line))) hits.push({ rule: 'supply/remote-dependency', index: 0, detail: lower });
    return hits;
  }
  if (MANIFEST_FILES.has(lower) || lower.endsWith('.csproj')) return hit(lower);
  return [];
}

/** Directories that hold an installed dependency tree. Vet reports them and does not scan inside. */
export const VENDORED_DIRECTORIES = new Set(['node_modules', '.venv', 'venv', 'site-packages']);
