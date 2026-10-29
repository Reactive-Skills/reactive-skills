import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

export const CHECKPOINT_CHUNK_BYTES = 64 * 1024;
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const segmentSchema = z.object({ name: z.string(), length: z.number().int().nonnegative(), chunks: z.array(digestSchema) }).strict();
const checkpointSchema = z.object({
  format: z.literal(1), schema: z.number().int(), generation: z.string(), ledgerSeq: z.number().int().nonnegative(),
  chunkBytes: z.literal(CHECKPOINT_CHUNK_BYTES), segments: z.array(segmentSchema), seal: digestSchema,
}).strict();
export type JsonlCheckpoint = z.infer<typeof checkpointSchema>;
export type LedgerBoundary = { generation: string; ledgerSeq: number; schema: number };

/**
 * Hash bytes without decoding event objects.
 * # Performance & Risk Budget
 * - Tier: P2 (< 100ms)
 * - Complexity: O(b) in supplied bytes
 * - Cyclomatic Complexity (CC): 1
 * - Branch Coverage: target >= 70%
 * - CRAP Score: target <= 25.0
 */
function digest(bytes: string | Buffer): string { return createHash('sha256').update(bytes).digest('hex'); }

/**
 * Read an entire requested byte range, rejecting concurrent truncation or short reads.
 * # Performance & Risk Budget
 * - Tier: P2 (< 100ms)
 * - Complexity: O(b) time and memory, b <= 64 KiB
 * - Cyclomatic Complexity (CC): 3
 * - Branch Coverage: target >= 70%
 * - CRAP Score: target <= 25.0
 */
function readChunk(fd: number, start: number, length: number): Buffer {
  const buffer = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const read = fs.readSync(fd, buffer, offset, length - offset, start + offset);
    if (read === 0) throw new Error('JSONL changed during checkpoint read');
    offset += read;
  }
  return buffer;
}

/**
 * Hash a segment, retaining completed chunk digests during append. Verify the old partial
 * chunk before extending it so an external prefix edit cannot acquire a fresh certificate.
 * # Performance & Risk Budget
 * - Tier: P2 (< 100ms); incremental use is P1 (< 25ms)
 * - Complexity: O(new bytes + one chunk) hashing on append; O(bytes) for a new segment
 * - Cyclomatic Complexity (CC): 6
 * - Branch Coverage: target >= 80%
 * - CRAP Score: target <= 15.0
 */
function certifySegment(file: string, previous?: JsonlCheckpoint['segments'][number]): JsonlCheckpoint['segments'][number] {
  const fd = fs.openSync(file, 'r');
  try {
    const length = fs.fstatSync(fd).size;
    if (previous && length < previous.length) throw new Error('JSONL checkpoint prefix was truncated');
    if (previous && length === previous.length) return previous;
    const completed = Math.floor((previous?.length || 0) / CHECKPOINT_CHUNK_BYTES);
    const start = completed * CHECKPOINT_CHUNK_BYTES;
    const partial = (previous?.length || 0) - start;
    if (partial && digest(readChunk(fd, start, partial)) !== previous!.chunks[completed]) {
      throw new Error('JSONL checkpoint prefix changed');
    }
    const chunks = previous?.chunks.slice(0, completed) || [];
    for (let offset = start; offset < length; offset += CHECKPOINT_CHUNK_BYTES) {
      chunks.push(digest(readChunk(fd, offset, Math.min(CHECKPOINT_CHUNK_BYTES, length - offset))));
    }
    return { name: path.basename(file), length, chunks };
  } finally { fs.closeSync(fd); }
}

/**
 * Load a versioned, sealed certificate; uncertainty always selects full repair.
 * # Performance & Risk Budget
 * - Tier: P2 (< 100ms)
 * - Complexity: O(c) certificate metadata, c = chunk count
 * - Cyclomatic Complexity (CC): 3
 * - Branch Coverage: target >= 70%
 * - CRAP Score: target <= 25.0
 */
export function loadCheckpoint(file: string): JsonlCheckpoint | null {
  try {
    const parsed = checkpointSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
    const { seal, ...body } = parsed;
    // Hash the canonical schema field order used by publication.
    if (digest(JSON.stringify(body)) !== seal) return null;
    if (parsed.segments.some(segment => segment.chunks.length !== Math.ceil(segment.length / CHECKPOINT_CHUNK_BYTES))) return null;
    return parsed;
  } catch { return null; }
}

/**
 * Verify every byte of every inventoried segment, never only stats or the active tail.
 * # Performance & Risk Budget
 * - Tier: P2 (< 100ms)
 * - Complexity: O(total JSONL bytes + c) time, O(64 KiB + c) memory
 * - Cyclomatic Complexity (CC): 5
 * - Branch Coverage: target >= 70%
 * - CRAP Score: target <= 25.0
 */
export function verifyCheckpoint(checkpoint: JsonlCheckpoint, files: string[], boundary: LedgerBoundary): boolean {
  if (checkpoint.generation !== boundary.generation || checkpoint.schema !== boundary.schema || checkpoint.ledgerSeq > boundary.ledgerSeq) return false;
  if (files.length !== checkpoint.segments.length) return false;
  try {
    return files.every((file, index) => {
      const expected = checkpoint.segments[index];
      const actual = certifySegment(file);
      return actual.name === expected.name && actual.length === expected.length
        && actual.chunks.length === expected.chunks.length && actual.chunks.every((hash, chunk) => hash === expected.chunks[chunk]);
    });
  } catch { return false; }
}

/**
 * Publish an atomic certificate only after mirror writes returned. A crash before rename
 * leaves the old certificate; a crash after rename leaves bytes that open verifies again.
 * The JSONL contract uses synchronous writes, not power-loss fsync durability.
 * # Performance & Risk Budget
 * - Tier: P2 (< 100ms); incremental use is P1 (< 25ms)
 * - Complexity: O(new bytes + 64 KiB + c) on append, O(total bytes + c) after full repair;
 *   c = chunk metadata serialized, no historical event decoding
 * - Cyclomatic Complexity (CC): 4
 * - Branch Coverage: target >= 80%
 * - CRAP Score: target <= 15.0
 */
export function publishCheckpoint(file: string, files: string[], boundary: LedgerBoundary, previous?: JsonlCheckpoint): void {
  const oldSegments = new Map(previous?.segments.map(segment => [segment.name, segment]));
  const segments = files.map(segment => certifySegment(segment, oldSegments.get(path.basename(segment))));
  const body = { format: 1 as const, schema: boundary.schema, generation: boundary.generation, ledgerSeq: boundary.ledgerSeq,
    chunkBytes: CHECKPOINT_CHUNK_BYTES, segments };
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify({ ...body, seal: digest(JSON.stringify(body)) }), 'utf8');
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}
