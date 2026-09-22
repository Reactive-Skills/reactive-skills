import { createRequire } from 'node:module';
import {
  getRuntimeCapabilities,
  type RuntimeCapabilitySnapshot,
} from '@reactive-skills/runtime';
import { renderDetail, renderHelp, renderList, renderOutput } from '../toon.js';

const require = createRequire(import.meta.url);
const packageMetadata = require('../../package.json') as { version?: string };
const AXI_VERSION = packageMetadata.version ?? 'unknown';

export async function capabilitiesCommand(args: string[] = []): Promise<string> {
  const snapshot = await getRuntimeCapabilities({
    transport: 'axi',
    launcher: 'direct',
    scope: 'local',
    axi_version: AXI_VERSION,
  });

  const report = {
    ...snapshot,
    selection: 'axi_direct',
  };

  if (args.includes('--json')) {
    return JSON.stringify(report, null, 2);
  }

  return renderOutput([
    renderCapabilityDetail(report),
    renderList(
      'capabilities',
      snapshot.capabilities.map((name) => ({ name })),
      [{ type: 'field', key: 'name' }]
    ),
    renderHelp([
      'Use this read-only report during INIT runtime negotiation',
      'Run `reactive-skills-axi preflight <skill>` to check skill requirements',
    ]),
  ]);
}

export function renderCapabilityDetail(snapshot: RuntimeCapabilitySnapshot & { selection?: string }): string {
  return renderDetail(
    'runtime',
    {
      runtime_version: snapshot.runtime_version,
      axi_version: snapshot.axi_version ?? 'unknown',
      transport: snapshot.transport,
      launcher: snapshot.launcher,
      scope: snapshot.scope,
      workspace: snapshot.workspace ?? '',
      selection: snapshot.selection ?? '',
    },
    [
      { type: 'field', key: 'runtime_version' },
      { type: 'field', key: 'axi_version' },
      { type: 'field', key: 'transport' },
      { type: 'field', key: 'launcher' },
      { type: 'field', key: 'scope' },
      { type: 'field', key: 'workspace' },
      { type: 'field', key: 'selection' },
    ]
  );
}
