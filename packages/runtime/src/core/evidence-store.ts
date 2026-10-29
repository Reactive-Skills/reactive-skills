import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

export const EvidenceMediaTypeSchema = z.enum(['text/plain', 'text/markdown', 'application/json']);
export type EvidenceMediaType = z.infer<typeof EvidenceMediaTypeSchema>;
export const EvidenceReceiptSchema = z.object({
  version: z.literal('rsa-evidence/v1'),
  run_id: z.string().min(1).max(128),
  id: z.string().regex(/^[a-f0-9]{64}$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  byte_length: z.number().int().nonnegative().max(16 * 1024 * 1024),
  media_type: EvidenceMediaTypeSchema,
  canonicalization: z.literal('rsa-json/v1').optional(),
}).strict().refine(receipt => (receipt.media_type === 'application/json') === (receipt.canonicalization === 'rsa-json/v1'), {
  message: 'Only JSON receipts require canonicalization rsa-json/v1.',
});
export type EvidenceReceipt = z.infer<typeof EvidenceReceiptSchema>;
export interface EvidenceReference { $evidence: EvidenceReceipt }
export interface EvidenceBundle {
  version: 'rsa-evidence-bundle/v1';
  run_id: string;
  entries: Array<{ receipt: EvidenceReceipt; bytes_base64: string }>;
  /** Unreferenced registrations that failed verification and were left out of a referenced export. */
  skipped?: Array<{ id: string; error: string }>;
}

/** Selected-run port. Implementations must verify registration, identity and bytes on every read. */
export interface EvidenceStore {
  readonly runId: string;
  importFile(relativePath: string, mediaType: EvidenceMediaType): EvidenceReceipt;
  registerJson(value: unknown): EvidenceReceipt;
  read(receipt: EvidenceReceipt): Buffer;
  exportBundle(referenced?: readonly EvidenceReceipt[]): EvidenceBundle;
  restoreBundle(bundle: EvidenceBundle): void;
}

export interface LocalEvidenceStoreOptions {
  workspaceDir: string;
  artifactsDir: string;
  runId: string;
  /** Default 1 MiB; hard ceiling 16 MiB per blob. */
  maxBytes?: number;
  allowedMediaTypes?: EvidenceMediaType[];
  readOnly?: boolean;
}

/**
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms target)
 * - Complexity: O(b)
 * - Cyclomatic Complexity (CC): target <=12
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=15
 */
function digest(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Sorted UTF-16 keys, finite JSON numbers, JSON.stringify strings, no whitespace or normalization.
 *
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms target)
 * - Complexity: O(b + k log k)
 * - Cyclomatic Complexity (CC): target <=12
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=15
 */
export function canonicalEvidenceJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) throw new Error('Evidence JSON must not contain sparse arrays or extra properties.');
    return `[${value.map(canonicalEvidenceJson).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalEvidenceJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  throw new Error('Evidence JSON requires finite JSON values and plain objects.');
}

/**
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms target)
 * - Complexity: O(b)
 * - Cyclomatic Complexity (CC): target <=12
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=15
 */
function validateContent(bytes: Buffer, mediaType: EvidenceMediaType): void {
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  if (mediaType === 'application/json' && canonicalEvidenceJson(JSON.parse(text)) !== text) {
    throw new Error('Structured evidence must use canonical rsa-json/v1 bytes; use registerJson().');
  }
}

/**
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms target)
 * - Complexity: O(p)
 * - Cyclomatic Complexity (CC): target <=12
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=15
 */
function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/**
 * Reject every symlink component, including an importer parent.
 *
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms target)
 * - Complexity: O(d)
 * - Cyclomatic Complexity (CC): target <=12
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=15
 */
function assertNoSymlinks(root: string, candidate: string): void {
  if (!inside(root, candidate)) throw new Error('Evidence path escapes the workspace.');
  let current = root;
  for (const segment of path.relative(root, candidate).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Evidence paths must not contain symlinks.');
  }
}

/**
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms target)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=12
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=15
 */
function assertStableSource(before: fs.BigIntStats, after: fs.BigIntStats, current: fs.BigIntStats, length: number): void {
  if (before.ctimeNs !== after.ctimeNs || before.mtimeNs !== after.mtimeNs || before.size !== after.size
    || current.dev !== after.dev || current.ino !== after.ino || BigInt(length) !== after.size) {
    throw new Error('Evidence source changed during capture.');
  }
}

/**
 * Sync directory entries after publication on filesystems that support it.
 *
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms target)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=12
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=15
 */
function syncDirectory(directory: string): void {
  let fd: number | undefined;
  try {
    fd = fs.openSync(directory, 'r');
    fs.fsyncSync(fd);
  } catch (error) {
    if (!['EINVAL', 'ENOTSUP', 'EPERM', 'EISDIR'].includes((error as NodeJS.ErrnoException).code || '')) throw error;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/** Filesystem adapter. Content and registration files are immutable, published independently of the source.
 * No content is garbage-collected, including after snapshots, refused signals, or ledger compaction.
 */
export class LocalEvidenceStore implements EvidenceStore {
  public readonly runId: string;
  private readonly workspace: string;
  private readonly directory: string;
  private readonly maxBytes: number;
  private readonly allowedTypes: Set<EvidenceMediaType>;
  private readonly readOnly: boolean;

  /**
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target)
   * - Complexity: O(d)
   * - Cyclomatic Complexity (CC): target <=12
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=15
   */
  constructor(options: LocalEvidenceStoreOptions) {
    this.runId = options.runId;
    this.readOnly = options.readOnly === true;
    this.workspace = fs.realpathSync(options.workspaceDir);
    this.maxBytes = options.maxBytes ?? 1024 * 1024;
    if (!Number.isSafeInteger(this.maxBytes) || this.maxBytes < 1 || this.maxBytes > 16 * 1024 * 1024) {
      throw new Error('Evidence maxBytes must be between 1 and 16777216.');
    }
    this.allowedTypes = new Set((options.allowedMediaTypes ?? EvidenceMediaTypeSchema.options).map(type => EvidenceMediaTypeSchema.parse(type)));
    this.directory = path.join(this.workspace, path.relative(path.resolve(options.workspaceDir), path.resolve(options.artifactsDir)), 'evidence-v1');
    // No directory is created until a registration succeeds. Inline-only replay has no registry dependency.
    if (!inside(this.workspace, this.directory)) throw new Error('Evidence artifacts must be inside the workspace.');
  }

  /**
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target for <=1MiB)
   * - Complexity: O(b + d)
   * - Cyclomatic Complexity (CC): target <=12
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=15
   */
  public importFile(relativePath: string, mediaType: EvidenceMediaType): EvidenceReceipt {
    this.checkType(mediaType);
    if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes('..')) {
      throw new Error('Evidence import requires a workspace-relative path without traversal.');
    }
    const source = path.resolve(this.workspace, relativePath);
    assertNoSymlinks(this.workspace, source);
    const before = fs.statSync(source, { bigint: true });
    if (!before.isFile() || before.size > BigInt(this.maxBytes)) throw new Error('Evidence source must be a bounded regular file.');
    const fd = fs.openSync(source, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    try {
      const captured = fs.fstatSync(fd, { bigint: true });
      if (before.dev !== captured.dev || before.ino !== captured.ino) throw new Error('Evidence source changed during capture.');
      const bytes = this.readDescriptor(fd);
      const after = fs.fstatSync(fd, { bigint: true });
      assertNoSymlinks(this.workspace, source);
      const final = fs.statSync(source, { bigint: true });
      assertStableSource(before, after, final, bytes.length);
      return this.registerBytes(bytes, mediaType);
    } finally {
      fs.closeSync(fd);
    }
  }

  /**
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target for <=1MiB)
   * - Complexity: O(b + k log k)
   * - Cyclomatic Complexity (CC): target <=12
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=15
   */
  public registerJson(value: unknown): EvidenceReceipt {
    return this.registerBytes(Buffer.from(canonicalEvidenceJson(value), 'utf8'), 'application/json');
  }

  /**
   * Read through a captured descriptor with a hard allocation/read ceiling, even if the file grows.
   *
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target for <=1MiB)
   * - Complexity: O(b)
   * - Cyclomatic Complexity (CC): target <=12
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=15
   */
  private readDescriptor(fd: number, limit = this.maxBytes): Buffer {
    const chunks: Buffer[] = [];
    let length = 0;
    while (length <= limit) {
      const chunk = Buffer.alloc(Math.min(64 * 1024, limit + 1 - length));
      const count = fs.readSync(fd, chunk, 0, chunk.length, null);
      if (count === 0) return Buffer.concat(chunks, length);
      chunks.push(chunk.subarray(0, count));
      length += count;
    }
    throw new Error('Evidence exceeds maxBytes.');
  }

  /**
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target)
   * - Complexity: O(1)
   * - Cyclomatic Complexity (CC): target <=12
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=15
   */
  private checkType(mediaType: EvidenceMediaType): void {
    if (!this.allowedTypes.has(mediaType)) throw new Error(`Evidence media type is not allowed: ${mediaType}`);
  }

  /**
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target)
   * - Complexity: O(d)
   * - Cyclomatic Complexity (CC): target <=12
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=15
   */
  private prepareDirectory(): void {
    // Validate existing parents before mkdir; never create directories through a symlink.
    let existing = this.directory;
    while (!fs.existsSync(existing)) existing = path.dirname(existing);
    assertNoSymlinks(this.workspace, existing);
    fs.mkdirSync(this.directory, { recursive: true });
    assertNoSymlinks(this.workspace, this.directory);
  }

  /**
   * Atomically publish without replacing another registrar's complete file. Receipt publication is the commit point.
   *
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target for <=1MiB)
   * - Complexity: O(b + d)
   * - Cyclomatic Complexity (CC): target <=12
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=15
   */
  private publish(name: string, bytes: Buffer): void {
    this.prepareDirectory();
    const temporary = path.join(this.directory, `.pending-${randomUUID()}`);
    const destination = path.join(this.directory, name);
    try {
      const fd = fs.openSync(temporary, 'wx', 0o600);
      try {
        fs.writeFileSync(fd, bytes);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      try {
        fs.linkSync(temporary, destination);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        if (!this.readFile(name).equals(bytes)) throw new Error('Evidence immutable file mismatch.');
      }
      syncDirectory(this.directory);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  }

  /**
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target for <=1MiB)
   * - Complexity: O(b + d)
   * - Cyclomatic Complexity (CC): target <=12
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=15
   */
  private readFile(name: string): Buffer {
    const file = path.join(this.directory, name);
    assertNoSymlinks(this.workspace, file);
    const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    try {
      if (!fs.fstatSync(fd).isFile()) throw new Error('Evidence registry entry is not a regular file.');
      return this.readDescriptor(fd, name.endsWith('.receipt.json') ? 4096 : this.maxBytes);
    } finally {
      fs.closeSync(fd);
    }
  }

  /**
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target for <=1MiB)
   * - Complexity: O(b)
   * - Cyclomatic Complexity (CC): target <=12
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=15
   */
  private registerBytes(bytes: Buffer, mediaType: EvidenceMediaType): EvidenceReceipt {
    if (this.readOnly) throw new Error('Evidence store is read-only.');
    this.checkType(mediaType);
    if (bytes.length > this.maxBytes) throw new Error('Evidence exceeds maxBytes.');
    validateContent(bytes, mediaType);
    const sha256 = digest(bytes);
    const receipt: EvidenceReceipt = {
      version: 'rsa-evidence/v1', run_id: this.runId,
      id: digest(JSON.stringify([this.runId, sha256, mediaType])),
      sha256, byte_length: bytes.length, media_type: mediaType,
      ...(mediaType === 'application/json' ? { canonicalization: 'rsa-json/v1' as const } : {}),
    };
    EvidenceReceiptSchema.parse(receipt);
    this.publish(`${sha256}.blob`, bytes);
    this.publish(`${receipt.id}.receipt.json`, Buffer.from(JSON.stringify(receipt)));
    // Read the published copy and hash it, never the original mutable source, before returning a receipt.
    this.read(receipt);
    return Object.freeze(receipt);
  }

  /**
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target for <=1MiB)
   * - Complexity: O(b + d)
   * - Cyclomatic Complexity (CC): target <=12
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=15
   */
  public read(input: EvidenceReceipt): Buffer {
    const receipt = EvidenceReceiptSchema.parse(input);
    if (receipt.run_id !== this.runId) throw new Error('Evidence reference belongs to another run.');
    this.checkType(receipt.media_type);
    if (receipt.byte_length > this.maxBytes) throw new Error('Evidence exceeds maxBytes.');
    const registered = EvidenceReceiptSchema.parse(JSON.parse(this.readFile(`${receipt.id}.receipt.json`).toString('utf8')));
    if (JSON.stringify(registered) !== JSON.stringify(receipt)) throw new Error('Evidence registration mismatch.');
    const bytes = this.readFile(`${receipt.sha256}.blob`);
    if (bytes.length !== receipt.byte_length || digest(bytes) !== receipt.sha256) throw new Error('Evidence digest or byte length mismatch.');
    validateContent(bytes, receipt.media_type);
    return bytes;
  }

  /**
   * Without `referenced`, bundles every registration and fails on any damage.
   * With `referenced`, bundles exactly those receipts (failing on damage) and reports damaged unreferenced registrations.
   *
   * # Performance & Risk Budget
   * - Tier: P3 (<2000ms target)
   * - Complexity: O(total registered bytes)
   * - Cyclomatic Complexity (CC): target <=20
   * - Branch Coverage: target >=60%
   * - CRAP Score: target <=30
   */
  public exportBundle(referenced?: readonly EvidenceReceipt[]): EvidenceBundle {
    const entries = new Map<string, EvidenceBundle['entries'][number]>();
    for (const receipt of referenced ?? []) entries.set(receipt.id, { receipt, bytes_base64: this.read(receipt).toString('base64') });
    const skipped: NonNullable<EvidenceBundle['skipped']> = [];
    if (fs.existsSync(this.directory)) {
      assertNoSymlinks(this.workspace, this.directory);
      for (const name of fs.readdirSync(this.directory).filter(name => /^[a-f0-9]{64}\.receipt\.json$/.test(name))) {
        const id = name.slice(0, 64);
        if (entries.has(id)) continue;
        try {
          const receipt = EvidenceReceiptSchema.parse(JSON.parse(this.readFile(name).toString('utf8')));
          const bytes = this.read(receipt);
          if (!referenced) entries.set(id, { receipt, bytes_base64: bytes.toString('base64') });
        } catch (error) {
          if (!referenced) throw error;
          skipped.push({ id, error: (error as Error).message });
        }
      }
    }
    const bundled = [...entries.keys()].sort().map(id => entries.get(id)!);
    return { version: 'rsa-evidence-bundle/v1', run_id: this.runId, entries: bundled, skipped: skipped.sort((a, b) => a.id.localeCompare(b.id)) };
  }

  /**
   * Restore explicitly into the selected run, validating all entries before publishing any.
   *
   * # Performance & Risk Budget
   * - Tier: P3 (<2000ms target)
   * - Complexity: O(total bundled bytes)
   * - Cyclomatic Complexity (CC): target <=20
   * - Branch Coverage: target >=60%
   * - CRAP Score: target <=30
   */
  public restoreBundle(bundle: EvidenceBundle): void {
    if (this.readOnly) throw new Error('Evidence store is read-only.');
    if (bundle.version !== 'rsa-evidence-bundle/v1' || bundle.run_id !== this.runId || !Array.isArray(bundle.entries)) {
      throw new Error('Evidence bundle version or run mismatch.');
    }
    const entries = bundle.entries.map(entry => {
      const receipt = EvidenceReceiptSchema.parse(entry.receipt);
      this.checkType(receipt.media_type);
      if (receipt.run_id !== this.runId || typeof entry.bytes_base64 !== 'string'
        || entry.bytes_base64.length > Math.ceil(this.maxBytes / 3) * 4) throw new Error('Invalid or oversized evidence bundle entry.');
      const bytes = Buffer.from(entry.bytes_base64, 'base64');
      if (bytes.length > this.maxBytes || bytes.toString('base64') !== entry.bytes_base64
        || bytes.length !== receipt.byte_length || digest(bytes) !== receipt.sha256
        || receipt.id !== digest(JSON.stringify([this.runId, receipt.sha256, receipt.media_type]))) throw new Error('Evidence bundle identity mismatch.');
      validateContent(bytes, receipt.media_type);
      return { receipt, bytes };
    });
    for (const { receipt, bytes } of entries) {
      const registered = this.registerBytes(bytes, receipt.media_type);
      if (JSON.stringify(registered) !== JSON.stringify(receipt)) throw new Error('Evidence bundle receipt mismatch.');
    }
  }
}
