export type ErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'INVALID_SKILL'
  | 'VALIDATION_ERROR'
  | 'NO_EVENT_STORE'
  | 'RUNTIME_ERROR'
  | 'UNKNOWN';

export class AxiError extends Error {
  constructor(
    message: string,
    readonly code: ErrorCode,
    readonly suggestions: string[] = []
  ) {
    super(message);
    this.name = 'AxiError';
  }
}

export function exitCodeForError(code: ErrorCode): number {
  switch (code) {
    case 'NOT_FOUND':
    case 'ALREADY_EXISTS':
    case 'INVALID_SKILL':
    case 'VALIDATION_ERROR':
    case 'NO_EVENT_STORE':
      return 1;
    default:
      return 1;
  }
}

/** An event store that cannot be opened: the message already names the store path, the hint is the recovery command. */
export function storeOpenError(err: unknown): AxiError | null {
  if ((err as { code?: unknown } | null)?.code !== 'EVENT_STORE_OPEN_FAILED') return null;
  const { message, recovery } = err as Error & { recovery?: string };
  return new AxiError(message, 'RUNTIME_ERROR', recovery ? [recovery] : []);
}

export function mapRuntimeError(err: unknown): AxiError {
  if (err instanceof AxiError) return err;
  const storeError = storeOpenError(err);
  if (storeError) return storeError;
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('not found')) return new AxiError(msg, 'NOT_FOUND');
  if (msg.includes('already exists')) return new AxiError(msg, 'ALREADY_EXISTS');
  return new AxiError(msg, 'UNKNOWN');
}

