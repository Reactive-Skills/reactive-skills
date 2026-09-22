import { createRequire } from 'node:module';
import type { RuntimeRequirements } from './types.js';

const require = createRequire(import.meta.url);
const packageMetadata = require('../../package.json') as { version?: string };

export const RUNTIME_VERSION = packageMetadata.version ?? 'unknown';

export const STATIC_RUNTIME_CAPABILITIES = [
  'runtime.preflight',
  'runtime.transport_handshake',
  'judgment',
  'judgment.script',
  'judgment.adapter_evidence',
] as const;

export type RuntimeTransport = 'axi' | 'mcp';
export type RuntimeLauncher = 'embedded' | 'persistent' | 'direct' | 'npx';
export type RuntimeScope = 'local' | 'remote' | 'unknown';

export interface RuntimeCapabilitySnapshot {
  runtime_version: string;
  transport: RuntimeTransport;
  launcher: RuntimeLauncher;
  scope: RuntimeScope;
  capabilities: string[];
  axi_version?: string;
  workspace?: string;
}

export interface RuntimeCandidate {
  transport: RuntimeTransport;
  launcher: RuntimeLauncher;
  scope: RuntimeScope;
  available: boolean;
  runtime_version?: string;
  capabilities?: string[];
  axi_version?: string;
  estimated_latency_ms?: number;
  reason?: string;
}

export interface RuntimeCompatibility {
  compatible: boolean;
  runtime_version?: string;
  min_runtime_version?: string;
  required_capabilities: string[];
  missing_capabilities: string[];
  errors: string[];
}

export interface RuntimeCandidateEvaluation extends RuntimeCandidate {
  compatibility: RuntimeCompatibility;
}

export interface RuntimeSelection {
  selected?: RuntimeCandidateEvaluation;
  candidates: RuntimeCandidateEvaluation[];
  reason: string;
}

export interface RuntimeCapabilityOptions {
  transport?: RuntimeTransport;
  launcher?: RuntimeLauncher;
  scope?: RuntimeScope;
  axi_version?: string;
  workspace?: string;
}

export function compareRuntimeVersions(left: string, right: string): number {
  const leftParts = parseRuntimeVersion(left);
  const rightParts = parseRuntimeVersion(right);

  if (!leftParts || !rightParts) {
    return left === right ? 0 : left.localeCompare(right);
  }

  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }

  return 0;
}

export function evaluateRuntimeRequirements(
  requirements: RuntimeRequirements | undefined,
  runtime: Pick<RuntimeCapabilitySnapshot, 'runtime_version' | 'capabilities'>
): RuntimeCompatibility {
  const minRuntimeVersion = requirements?.min_runtime_version;
  const requiredCapabilities = requirements?.required_capabilities ?? [];
  const errors: string[] = [];

  if (minRuntimeVersion) {
    const runtimeVersion = parseRuntimeVersion(runtime.runtime_version);
    const requiredVersion = parseRuntimeVersion(minRuntimeVersion);
    if (!runtimeVersion) {
      errors.push(`Runtime version is invalid or unavailable: ${runtime.runtime_version}`);
    } else if (!requiredVersion) {
      errors.push(`Required runtime version is invalid: ${minRuntimeVersion}`);
    } else if (compareRuntimeVersions(runtime.runtime_version, minRuntimeVersion) < 0) {
      errors.push(`Runtime ${runtime.runtime_version} is below required version ${minRuntimeVersion}`);
    }
  }

  const availableCapabilities = new Set(runtime.capabilities);
  const missingCapabilities = requiredCapabilities.filter((capability) => !availableCapabilities.has(capability));
  if (missingCapabilities.length > 0) {
    errors.push(`Missing runtime capabilities: ${missingCapabilities.join(', ')}`);
  }

  return {
    compatible: errors.length === 0,
    runtime_version: runtime.runtime_version,
    min_runtime_version: minRuntimeVersion,
    required_capabilities: [...requiredCapabilities],
    missing_capabilities: missingCapabilities,
    errors,
  };
}

export function selectRuntimeCandidate(
  candidates: RuntimeCandidate[],
  requirements?: RuntimeRequirements
): RuntimeSelection {
  const evaluations = candidates.map((candidate) => {
    const compatibility = candidate.available
      ? evaluateRuntimeRequirements(requirements, {
          runtime_version: candidate.runtime_version ?? 'unknown',
          capabilities: candidate.capabilities ?? [],
        })
      : {
          compatible: false,
          runtime_version: candidate.runtime_version,
          min_runtime_version: requirements?.min_runtime_version,
          required_capabilities: [...(requirements?.required_capabilities ?? [])],
          missing_capabilities: [],
          errors: ['Runtime candidate is unavailable'],
        };

    return { ...candidate, compatibility };
  });

  const viable = evaluations
    .filter((candidate) => candidate.compatibility.compatible)
    .sort(compareRuntimeCandidates);
  const selected = viable[0];

  return {
    selected,
    candidates: evaluations,
    reason: selected
      ? `selected_${selected.transport}_${selected.launcher}`
      : 'no_compatible_runtime',
  };
}

export async function getRuntimeCapabilities(
  options: RuntimeCapabilityOptions = {}
): Promise<RuntimeCapabilitySnapshot> {
  const capabilities = new Set<string>(STATIC_RUNTIME_CAPABILITIES);

  try {
    const { JevJudgmentAdapter } = await import('./judgment-engine.js');
    if (await new JevJudgmentAdapter().isAvailable()) {
      capabilities.add('judgment.jev');
    }
  } catch {
    // Jev is optional. Static runtime capabilities remain valid without it.
  }

  return {
    runtime_version: RUNTIME_VERSION,
    transport: options.transport ?? 'axi',
    launcher: options.launcher ?? 'embedded',
    scope: options.scope ?? 'local',
    capabilities: [...capabilities].sort(),
    ...(options.axi_version ? { axi_version: options.axi_version } : {}),
    ...(options.workspace ? { workspace: options.workspace } : {}),
  };
}

function parseRuntimeVersion(version: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareRuntimeCandidates(left: RuntimeCandidateEvaluation, right: RuntimeCandidateEvaluation): number {
  const rankDifference = runtimeCandidateRank(left) - runtimeCandidateRank(right);
  if (rankDifference !== 0) return rankDifference;

  return (left.estimated_latency_ms ?? Number.MAX_SAFE_INTEGER)
    - (right.estimated_latency_ms ?? Number.MAX_SAFE_INTEGER);
}

function runtimeCandidateRank(candidate: RuntimeCandidate): number {
  if (candidate.scope === 'local' && (candidate.launcher === 'embedded' || candidate.launcher === 'persistent')) {
    return 0;
  }
  if (candidate.scope === 'local' && candidate.launcher === 'direct') {
    return 1;
  }
  if (candidate.scope === 'unknown' && candidate.launcher === 'persistent') {
    return 2;
  }
  if (candidate.launcher === 'npx') {
    return 3;
  }
  return 4;
}
