import { describe, expect, it } from 'vitest';
import {
  compareRuntimeVersions,
  evaluateRuntimeRequirements,
  selectRuntimeCandidate,
  STATIC_RUNTIME_CAPABILITIES,
} from '../src/core/runtime-capabilities.js';

describe('runtime capability contracts', () => {
  it('compares semantic runtime versions', () => {
    expect(compareRuntimeVersions('0.10.1', '0.9.9')).toBeGreaterThan(0);
    expect(compareRuntimeVersions('0.10.1', '0.10.1')).toBe(0);
    expect(compareRuntimeVersions('0.10.1', '0.11.0')).toBeLessThan(0);
  });

  it('reports version and capability incompatibility', () => {
    const result = evaluateRuntimeRequirements(
      {
        min_runtime_version: '0.11.0',
        required_capabilities: ['runtime.preflight', 'missing.capability'],
      },
      {
        runtime_version: '0.10.1',
        capabilities: [...STATIC_RUNTIME_CAPABILITIES],
      }
    );

    expect(result.compatible).toBe(false);
    expect(result.missing_capabilities).toEqual(['missing.capability']);
    expect(result.errors).toEqual([
      'Runtime 0.10.1 is below required version 0.11.0',
      'Missing runtime capabilities: missing.capability',
    ]);
  });

  it('advertises bounded context routing', () => {
    expect(STATIC_RUNTIME_CAPABILITIES).toContain('context.routing');
  });

  it('does not treat an unknown runtime version as compatible with a minimum version', () => {
    const result = evaluateRuntimeRequirements(
      { min_runtime_version: '0.10.0' },
      { runtime_version: 'unknown', capabilities: [...STATIC_RUNTIME_CAPABILITIES] }
    );

    expect(result.compatible).toBe(false);
    expect(result.errors).toEqual(['Runtime version is invalid or unavailable: unknown']);
  });

  it('selects persistent local MCP before direct local AXI and npx', () => {
    const result = selectRuntimeCandidate([
      {
        transport: 'axi',
        launcher: 'npx',
        scope: 'local',
        available: true,
        runtime_version: '0.10.1',
        capabilities: [...STATIC_RUNTIME_CAPABILITIES],
      },
      {
        transport: 'axi',
        launcher: 'direct',
        scope: 'local',
        available: true,
        runtime_version: '0.10.1',
        capabilities: [...STATIC_RUNTIME_CAPABILITIES],
      },
      {
        transport: 'mcp',
        launcher: 'persistent',
        scope: 'local',
        available: true,
        runtime_version: '0.10.1',
        capabilities: [...STATIC_RUNTIME_CAPABILITIES],
      },
    ]);

    expect(result.reason).toBe('selected_mcp_persistent');
    expect(result.selected?.transport).toBe('mcp');
  });

  it('uses direct local AXI when MCP is remote', () => {
    const result = selectRuntimeCandidate([
      {
        transport: 'mcp',
        launcher: 'persistent',
        scope: 'remote',
        available: true,
        runtime_version: '0.10.1',
        capabilities: [...STATIC_RUNTIME_CAPABILITIES],
      },
      {
        transport: 'axi',
        launcher: 'direct',
        scope: 'local',
        available: true,
        runtime_version: '0.10.1',
        capabilities: [...STATIC_RUNTIME_CAPABILITIES],
      },
    ]);

    expect(result.reason).toBe('selected_axi_direct');
    expect(result.selected?.transport).toBe('axi');
  });
});
