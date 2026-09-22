import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  evaluateRuntimeRequirements,
  getRuntimeCapabilities,
  SkillManifestSchema,
  type RuntimeCompatibility,
} from '@reactive-skills/runtime';
import { renderDetail, renderHelp, renderList, renderOutput } from '../toon.js';
import { discoverSkillDirs } from './validate.js';
import { renderCapabilityDetail } from './capabilities.js';

interface PreflightResult {
  skill: string;
  path: string;
  status: 'compatible' | 'incompatible' | 'invalid';
  runtime_version: string;
  requirements: RuntimeCompatibility;
  errors: string[];
}

export async function preflightCommand(args: string[]): Promise<string> {
  const targetArg = args.find((arg) => !arg.startsWith('--'));
  const skillDirs = discoverSkillDirs(targetArg);
  const runtime = await getRuntimeCapabilities({
    transport: 'axi',
    launcher: 'direct',
    scope: 'local',
  });

  const results = skillDirs.map((skillDir) => preflightSkill(skillDir, runtime));
  const hasFailures = results.some((result) => result.status !== 'compatible');
  process.exitCode = hasFailures ? 1 : 0;

  if (args.includes('--json')) {
    return JSON.stringify({ runtime, results }, null, 2);
  }

  const blocks: Array<string | undefined> = [
    renderCapabilityDetail(runtime),
  ];

  if (results.length === 1) {
    const result = results[0];
    blocks.push(renderPreflightDetail(result));
    if (result.errors.length > 0) {
      blocks.push(`errors[${result.errors.length}]:\n` + result.errors.map((error) => `  ${error}`).join('\n'));
    }
  } else {
    blocks.push(renderList(
      'preflight',
      results.map((result) => ({
        skill: result.skill,
        status: result.status,
        runtime_version: result.runtime_version,
        missing_capabilities: result.requirements.missing_capabilities.join(', '),
        errors: result.errors.length,
      })),
      [
        { type: 'field', key: 'skill' },
        { type: 'field', key: 'status' },
        { type: 'field', key: 'runtime_version' },
        { type: 'field', key: 'missing_capabilities' },
        { type: 'field', key: 'errors' },
      ]
    ));
  }

  blocks.push(renderHelp([
    hasFailures
      ? 'Use a compatible AXI or MCP runtime before executing this skill'
      : 'Runtime requirements pass without creating or changing a job',
  ]));

  return renderOutput(blocks);
}

function preflightSkill(skillDir: string, runtime: Awaited<ReturnType<typeof getRuntimeCapabilities>>): PreflightResult {
  const manifestPath = ['skill.yaml', 'skill.yml']
    .map((fileName) => path.join(skillDir, fileName))
    .find((candidate) => fs.existsSync(candidate));

  if (!manifestPath) {
    return {
      skill: path.basename(skillDir),
      path: skillDir,
      status: 'invalid',
      runtime_version: runtime.runtime_version,
      requirements: evaluateRuntimeRequirements(undefined, runtime),
      errors: ['skill.yaml or skill.yml not found'],
    };
  }

  try {
    const raw = yaml.load(fs.readFileSync(manifestPath, 'utf8'));
    const parsed = SkillManifestSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        skill: path.basename(skillDir),
        path: skillDir,
        status: 'invalid',
        runtime_version: runtime.runtime_version,
        requirements: evaluateRuntimeRequirements(undefined, runtime),
        errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'manifest'}: ${issue.message}`),
      };
    }

    const requirements = evaluateRuntimeRequirements(parsed.data.runtime_requirements, runtime);
    return {
      skill: parsed.data.name,
      path: skillDir,
      status: requirements.compatible ? 'compatible' : 'incompatible',
      runtime_version: runtime.runtime_version,
      requirements,
      errors: requirements.errors,
    };
  } catch (error) {
    return {
      skill: path.basename(skillDir),
      path: skillDir,
      status: 'invalid',
      runtime_version: runtime.runtime_version,
      requirements: evaluateRuntimeRequirements(undefined, runtime),
      errors: [error instanceof Error ? error.message : 'Failed to read skill manifest'],
    };
  }
}

function renderPreflightDetail(result: PreflightResult): string {
  return renderDetail(
    'preflight',
    {
      skill: result.skill,
      status: result.status,
      path: result.path,
      runtime_version: result.runtime_version,
      min_runtime_version: result.requirements.min_runtime_version ?? '',
      required_capabilities: result.requirements.required_capabilities.join(', '),
      missing_capabilities: result.requirements.missing_capabilities.join(', '),
    },
    [
      { type: 'field', key: 'skill' },
      { type: 'field', key: 'status' },
      { type: 'field', key: 'path' },
      { type: 'field', key: 'runtime_version' },
      { type: 'field', key: 'min_runtime_version' },
      { type: 'field', key: 'required_capabilities' },
      { type: 'field', key: 'missing_capabilities' },
    ]
  );
}
