import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { SkillManifestSchema, SkillManifest } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderDetail, renderList, renderHelp, renderOutput } from '../toon.js';

export interface SkillValidationResult {
  name: string;
  path: string;
  valid: boolean;
  schemaVersion: string;
  version: string;
  stateCount: number;
  transitionCount: number;
  errors: string[];
  warnings: string[];
}

/**
 * Discover skill directories to validate based on target argument or workspace conventions
 */
export function discoverSkillDirs(targetArg?: string): string[] {
  if (targetArg) {
    let resolved = path.resolve(process.cwd(), targetArg);

    // If pointing to a skill.yaml file directly
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      if (resolved.endsWith('skill.yaml') || resolved.endsWith('skill.yml')) {
        return [path.dirname(resolved)];
      }
    }

    // If pointing to a directory that directly contains skill.yaml
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      if (fs.existsSync(path.join(resolved, 'skill.yaml')) || fs.existsSync(path.join(resolved, 'skill.yml'))) {
        return [resolved];
      }

      // Check if this directory contains subdirectories with skill.yaml
      const subSkills = findSkillsInDir(resolved);
      if (subSkills.length > 0) {
        return subSkills;
      }
    }

    // Check ./skills/<targetArg>
    const relativeToSkills = path.resolve(process.cwd(), 'skills', targetArg);
    if (fs.existsSync(relativeToSkills) && fs.statSync(relativeToSkills).isDirectory()) {
      if (fs.existsSync(path.join(relativeToSkills, 'skill.yaml')) || fs.existsSync(path.join(relativeToSkills, 'skill.yml'))) {
        return [relativeToSkills];
      }
    }

    throw new AxiError(
      `Skill not found at "${targetArg}"`,
      'NOT_FOUND',
      [
        'Provide a directory containing skill.yaml',
        'Usage: reactive-skills-axi validate [path-to-skill]',
      ]
    );
  }

  // Omitted target: check current working directory first
  if (fs.existsSync(path.join(process.cwd(), 'skill.yaml')) || fs.existsSync(path.join(process.cwd(), 'skill.yml'))) {
    return [process.cwd()];
  }

  // Check ./skills/
  const skillsDir = path.resolve(process.cwd(), 'skills');
  if (fs.existsSync(skillsDir) && fs.statSync(skillsDir).isDirectory()) {
    const subSkills = findSkillsInDir(skillsDir);
    if (subSkills.length > 0) {
      return subSkills;
    }
  }

  throw new AxiError(
    'No reactive skills found to validate in current directory',
    'NOT_FOUND',
    [
      'Run from a directory containing skill.yaml or a skills/ directory',
      'Or specify target path: reactive-skills-axi validate <path>',
    ]
  );
}

function findSkillsInDir(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const subPath = path.join(dir, entry.name);
        if (fs.existsSync(path.join(subPath, 'skill.yaml')) || fs.existsSync(path.join(subPath, 'skill.yml'))) {
          results.push(subPath);
        }
      }
    }
  } catch {
    // Ignore unreadable directories
  }
  return results;
}

/**
 * Validate an individual reactive skill directory
 */
export function validateSkill(skillDir: string): SkillValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const yamlPath = fs.existsSync(path.join(skillDir, 'skill.yaml'))
    ? path.join(skillDir, 'skill.yaml')
    : path.join(skillDir, 'skill.yml');

  if (!fs.existsSync(yamlPath)) {
    return {
      name: path.basename(skillDir),
      path: skillDir,
      valid: false,
      schemaVersion: 'unknown',
      version: 'unknown',
      stateCount: 0,
      transitionCount: 0,
      errors: [`skill.yaml not found at ${skillDir}`],
      warnings: [],
    };
  }

  let rawContent = '';
  try {
    rawContent = fs.readFileSync(yamlPath, 'utf8');
  } catch (err: any) {
    return {
      name: path.basename(skillDir),
      path: skillDir,
      valid: false,
      schemaVersion: 'unknown',
      version: 'unknown',
      stateCount: 0,
      transitionCount: 0,
      errors: [`Could not read ${yamlPath}: ${err.message}`],
      warnings: [],
    };
  }

  let parsed: any;
  try {
    parsed = yaml.load(rawContent);
  } catch (err: any) {
    return {
      name: path.basename(skillDir),
      path: skillDir,
      valid: false,
      schemaVersion: 'unknown',
      version: 'unknown',
      stateCount: 0,
      transitionCount: 0,
      errors: [`Invalid YAML syntax: ${err.message}`],
      warnings: [],
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      name: path.basename(skillDir),
      path: skillDir,
      valid: false,
      schemaVersion: 'unknown',
      version: 'unknown',
      stateCount: 0,
      transitionCount: 0,
      errors: ['skill.yaml must contain a valid YAML object mapping'],
      warnings: [],
    };
  }

  const skillName = parsed.name || path.basename(skillDir);
  const schemaVersion = String(parsed.schema_version || 'unknown');
  const version = String(parsed.version || 'unknown');

  // 1. Zod Schema Validation
  const parseResult = SkillManifestSchema.safeParse(parsed);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      const fieldPath = issue.path.join('.');
      errors.push(`schema error at ${fieldPath || 'root'}: ${issue.message}`);
    }
  }

  // 2. State & Substate Traversal
  const allStateNames = new Set<string>();
  const referencedTemplates = new Set<string>();
  let transitionCount = 0;
  let stateCount = 0;

  function registerStates(statesObj: Record<string, any>, prefix = '') {
    if (!statesObj || typeof statesObj !== 'object') return;

    for (const [sName, sDef] of Object.entries(statesObj)) {
      const fullName = prefix ? `${prefix}.${sName}` : sName;
      allStateNames.add(fullName);
      allStateNames.add(sName);
      stateCount++;

      if (sDef && typeof sDef === 'object') {
        // Check prompt_template
        if (sDef.prompt_template) {
          const tplPath = path.resolve(skillDir, sDef.prompt_template);
          referencedTemplates.add(tplPath);
          if (!fs.existsSync(tplPath)) {
            errors.push(`State "${fullName}" prompt template not found on disk: ${sDef.prompt_template}`);
          }
        }

        // Count transitions
        if (sDef.transitions && typeof sDef.transitions === 'object') {
          transitionCount += Object.keys(sDef.transitions).length;
        }

        // Check substates
        if (sDef.substates && typeof sDef.substates === 'object') {
          if (sDef.initial_substate && !sDef.substates[sDef.initial_substate]) {
            errors.push(`State "${fullName}" initial_substate "${sDef.initial_substate}" not found in substates`);
          }
          registerStates(sDef.substates, fullName);
        }
      }
    }
  }

  if (parsed.states && typeof parsed.states === 'object') {
    registerStates(parsed.states);
  }

  // 3. Initial State Check
  if (parsed.initial_state && !allStateNames.has(parsed.initial_state)) {
    errors.push(`initial_state "${parsed.initial_state}" is not defined in states`);
  }

  // 4. Transition Targets & Guard Syntax Check
  function validateTransitions(statesObj: Record<string, any>, prefix = '') {
    if (!statesObj || typeof statesObj !== 'object') return;

    for (const [sName, sDef] of Object.entries(statesObj)) {
      const fullName = prefix ? `${prefix}.${sName}` : sName;
      if (sDef?.transitions && typeof sDef.transitions === 'object') {
        for (const [signal, trans] of Object.entries(sDef.transitions)) {
          const target = typeof trans === 'string' ? trans : (trans as any)?.target;
          const guard = typeof trans === 'object' ? (trans as any)?.guard : undefined;

          if (!target) {
            errors.push(`State "${fullName}" transition on signal "${signal}" has no target state`);
          } else if (!allStateNames.has(target)) {
            errors.push(`State "${fullName}" transition on signal "${signal}" targets unknown state "${target}"`);
          }

          if (guard && typeof guard === 'string') {
            try {
              new Function('event', 'payload', 'context', `return (${guard});`);
            } catch (guardErr: any) {
              errors.push(`State "${fullName}" transition on "${signal}" has invalid guard syntax: ${guardErr.message}`);
            }
          }
        }
      }

      if (sDef?.substates && typeof sDef.substates === 'object') {
        validateTransitions(sDef.substates, fullName);
      }
    }
  }

  if (parsed.states && typeof parsed.states === 'object') {
    validateTransitions(parsed.states);
  }

  // 5. Deliverable Projections Check
  if (Array.isArray(parsed.deliverable_projections)) {
    for (const proj of parsed.deliverable_projections) {
      if (proj.template) {
        const tplPath = path.resolve(skillDir, proj.template);
        if (!fs.existsSync(tplPath)) {
          errors.push(`Deliverable projection template not found on disk: ${proj.template}`);
        }
      }
      if (proj.output && path.isAbsolute(proj.output)) {
        errors.push(`Deliverable projection output must be a relative path: ${proj.output}`);
      }
    }
  }

  // 6. SKILL.md & Bootloader Check
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    warnings.push('SKILL.md not found in skill directory');
  } else {
    try {
      const skillMdContent = fs.readFileSync(skillMdPath, 'utf8');
      if (!skillMdContent.includes('<!-- REACTIVE BOOTLOADER -->')) {
        errors.push('SKILL.md is missing the universal reactive bootloader marker: <!-- REACTIVE BOOTLOADER -->');
      }
    } catch (err: any) {
      warnings.push(`Could not read SKILL.md: ${err.message}`);
    }
  }

  // 7. Orphan Templates Check (Hygiene)
  const statesDir = path.join(skillDir, 'states');
  if (fs.existsSync(statesDir)) {
    function getMdFiles(dir: string): string[] {
      const list: string[] = [];
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            list.push(...getMdFiles(full));
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            list.push(full);
          }
        }
      } catch {
        // Ignore unreadable dirs
      }
      return list;
    }

    const diskMdFiles = getMdFiles(statesDir);
    for (const diskFile of diskMdFiles) {
      if (!referencedTemplates.has(path.resolve(diskFile))) {
        const rel = path.relative(skillDir, diskFile).replace(/\\/g, '/');
        warnings.push(`Orphan prompt template detected: "${rel}" is not referenced in skill.yaml`);
      }
    }
  }

  return {
    name: skillName,
    path: skillDir,
    valid: errors.length === 0,
    schemaVersion,
    version,
    stateCount,
    transitionCount,
    errors,
    warnings,
  };
}

/**
 * Validate command handler for reactive-skills-axi
 */
export async function validateCommand(args: string[]): Promise<string> {
  const targetArg = args.find((a) => !a.startsWith('--'));
  const skillDirs = discoverSkillDirs(targetArg);

  const results: SkillValidationResult[] = [];
  for (const dir of skillDirs) {
    results.push(validateSkill(dir));
  }

  const hasErrors = results.some((r) => !r.valid);
  if (hasErrors) {
    process.exitCode = 1;
  }

  if (results.length === 1) {
    const res = results[0];
    const detail = renderDetail(
      'validation',
      {
        skill: res.name,
        status: res.valid ? 'valid' : 'invalid',
        schema: res.schemaVersion,
        version: res.version,
        states: res.stateCount,
        transitions: res.transitionCount,
        errors: res.errors.length,
        warnings: res.warnings.length,
      },
      [
        { type: 'field', key: 'skill' },
        { type: 'field', key: 'status' },
        { type: 'field', key: 'schema' },
        { type: 'field', key: 'version' },
        { type: 'field', key: 'states' },
        { type: 'field', key: 'transitions' },
        { type: 'field', key: 'errors' },
        { type: 'field', key: 'warnings' },
      ]
    );

    const blocks: (string | undefined)[] = [detail];

    if (res.errors.length > 0) {
      blocks.push(`errors[${res.errors.length}]:\n` + res.errors.map((e) => `  ${e}`).join('\n'));
    }

    if (res.warnings.length > 0) {
      blocks.push(`warnings[${res.warnings.length}]:\n` + res.warnings.map((w) => `  ${w}`).join('\n'));
    }

    if (res.valid) {
      blocks.push(
        renderHelp([
          `Run \`reactive-skills-axi inspect ${res.path}\` to inspect statechart`,
          `Run \`reactive-skills-axi state ${res.name}\` to inspect active state`,
        ])
      );
    } else {
      blocks.push(
        renderHelp([
          'Fix the validation errors listed above in skill.yaml or prompt templates',
        ])
      );
    }

    return renderOutput(blocks);
  }

  // Multi-skill output
  const list = renderList(
    'validation',
    results.map((r) => ({
      skill: r.name,
      status: r.valid ? 'valid' : 'invalid',
      states: r.stateCount,
      errors: r.errors.length,
      warnings: r.warnings.length,
    })),
    [
      { type: 'field', key: 'skill' },
      { type: 'field', key: 'status' },
      { type: 'field', key: 'states' },
      { type: 'field', key: 'errors' },
      { type: 'field', key: 'warnings' },
    ]
  );

  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  for (const r of results) {
    for (const e of r.errors) allErrors.push(`${r.name}: ${e}`);
    for (const w of r.warnings) allWarnings.push(`${r.name}: ${w}`);
  }

  const blocks: (string | undefined)[] = [list];

  if (allErrors.length > 0) {
    blocks.push(`errors[${allErrors.length}]:\n` + allErrors.map((e) => `  ${e}`).join('\n'));
  }

  if (allWarnings.length > 0) {
    blocks.push(`warnings[${allWarnings.length}]:\n` + allWarnings.map((w) => `  ${w}`).join('\n'));
  }

  if (!hasErrors) {
    blocks.push(
      renderHelp([
        `All ${results.length} reactive skill(s) validated successfully`,
      ])
    );
  } else {
    blocks.push(
      renderHelp([
        'Fix the validation errors listed above in skill.yaml or prompt templates',
      ])
    );
  }

  return renderOutput(blocks);
}
