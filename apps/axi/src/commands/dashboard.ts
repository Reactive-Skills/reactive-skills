import { TelemetryBroker } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderDetail, renderError, renderHelp, renderOutput } from '../toon.js';

export async function dashboardCommand(args: string[]): Promise<string> {
  let port = 4242;
  let host = '127.0.0.1';
  let once = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--port' && index + 1 < args.length) {
      const parsed = Number.parseInt(args[index + 1], 10);
      if (!Number.isNaN(parsed)) port = parsed;
      index += 1;
    } else if (arg === '--host' && index + 1 < args.length) {
      host = args[index + 1];
      index += 1;
    } else if (arg === '--once') {
      once = true;
    }
  }

  const broker = new TelemetryBroker({
    workspaceDir: process.cwd(),
    port,
    host,
  });

  try {
    const { port: boundPort, url } = await broker.start();
    const detail = renderDetail('dashboard', {
      status: 'listening',
      mode: 'read_only_broker',
      host,
      port: boundPort,
      url,
      catalog: `${url}/catalog`,
      state_endpoint: `${url}/state?skillId=<skill-id>&jobId=<job-id>`,
      events_sse: `${url}/events`,
      site_route: '/telemetry',
    }, [
      { type: 'field', key: 'status' },
      { type: 'field', key: 'mode' },
      { type: 'field', key: 'host' },
      { type: 'field', key: 'port' },
      { type: 'field', key: 'url' },
      { type: 'field', key: 'catalog' },
      { type: 'field', key: 'state_endpoint' },
      { type: 'field', key: 'events_sse' },
      { type: 'field', key: 'site_route' },
    ]);
    const help = renderHelp([
      'Open the site telemetry dashboard and enter the broker URL above.',
      'The broker is read-only and never dispatches signals or changes the active job pointer.',
      'Use `reactive-skills-axi view <skill> [--job <job-id>]` for the existing single-job viewer.',
    ]);

    if (once) {
      await broker.stop();
      return renderOutput([detail, help]);
    }

    const shutdown = async () => {
      await broker.stop();
      process.exit(0);
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);

    return renderOutput([detail, help]);
  } catch (error: any) {
    await broker.stop().catch(() => undefined);
    const axiError = new AxiError(
      `Failed to launch telemetry dashboard broker: ${error.message}`,
      'RUNTIME_ERROR',
      ['Check if the requested port is already in use', 'Verify the workspace contains a .reactive/skills directory'],
    );
    return renderOutput([renderError(axiError.message, axiError.code, axiError.suggestions)]);
  }
}
