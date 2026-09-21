import http from 'node:http';

export const DEFAULT_TELEMETRY_PORT = 4242;
export const TELEMETRY_PORT_FALLBACK_ATTEMPTS = 10;

export interface TelemetryPortSelectionOptions {
  host: string;
  requestedPort?: number;
  preferredPort?: number;
  maxAttempts?: number;
  createServer: () => http.Server;
}

export interface BoundTelemetryServer {
  server: http.Server;
  port: number;
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatBindError(error: unknown, host: string, port: number): string {
  if (getErrorCode(error) === 'EADDRINUSE') {
    return `Port ${port} on ${host} is already in use.`;
  }
  return `Unable to bind telemetry viewer to ${host}:${port}: ${getErrorMessage(error)}`;
}

function getBoundPort(server: http.Server, requestedPort: number): number {
  const address = server.address();
  if (typeof address === 'object' && address !== null) {
    return address.port;
  }
  return requestedPort;
}

async function closeFailedServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve) => {
    try {
      server.close(() => resolve());
    } catch {
      resolve();
    }
  });
}

async function listen(server: http.Server, host: string, port: number): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const onError = (error: Error) => {
      server.removeListener('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve(getBoundPort(server, port));
    };

    server.once('error', onError);
    server.once('listening', onListening);

    try {
      server.listen(port, host);
    } catch (error) {
      server.removeListener('error', onError);
      server.removeListener('listening', onListening);
      reject(error);
    }
  });
}

/**
 * Bind one HTTP server using strict explicit-port or bounded automatic selection semantics.
 * Each candidate is a real listen attempt, so the returned server owns the successful bind.
 */
export async function listenWithPortSelection(
  options: TelemetryPortSelectionOptions,
): Promise<BoundTelemetryServer> {
  const preferredPort = options.preferredPort ?? DEFAULT_TELEMETRY_PORT;
  const maxAttempts = options.maxAttempts ?? TELEMETRY_PORT_FALLBACK_ATTEMPTS;
  const candidates = options.requestedPort === undefined
    ? Array.from({ length: maxAttempts }, (_, index) => preferredPort + index)
    : [options.requestedPort];

  let lastError: unknown;
  for (const candidate of candidates) {
    const server = options.createServer();
    try {
      const port = await listen(server, options.host, candidate);
      return { server, port };
    } catch (error) {
      lastError = error;
      await closeFailedServer(server);

      if (options.requestedPort !== undefined || getErrorCode(error) !== 'EADDRINUSE') {
        throw new Error(formatBindError(error, options.host, candidate), { cause: error });
      }
    }
  }

  const lastCandidate = candidates[candidates.length - 1] ?? preferredPort;
  throw new Error(
    `No available telemetry viewer ports in range ${preferredPort}-${lastCandidate} on ${options.host}.`,
    { cause: lastError },
  );
}
