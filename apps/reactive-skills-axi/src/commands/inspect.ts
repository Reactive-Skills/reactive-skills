import fs from 'node:fs';
import path from 'node:path';
import { FSMEngine } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderDetail, renderError, renderHelp, renderList, renderOutput } from '../toon.js';
import { getSuggestions } from '../suggestions.js';

const SKILLS_DIR = path.resolve(process.cwd(), 'skills');

export async function inspectCommand(args: string[]): Promise<string> {
  let targetPath = args[0] ? path.resolve(process.cwd(), args[0]) : '';
  if (!targetPath) {
    if (fs.existsSync(SKILLS_DIR)) {
      const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
      const skillEntry = entries.find((e) => e.isDirectory() && fs.existsSync(path.join(SKILLS_DIR, e.name, 'skill.yaml')));
      if (skillEntry) {
        targetPath = path.join(SKILLS_DIR, skillEntry.name);
      }
    }
  }
  if (!targetPath) {
    targetPath = path.join(SKILLS_DIR, 'sample-skill');
  }
  const skillYamlPath = path.join(targetPath, 'skill.yaml');

  if (!fs.existsSync(skillYamlPath)) {
    const error = new AxiError(
      'skill.yaml not found at ' + skillYamlPath,
      'NOT_FOUND',
      ['Check the path and ensure it contains a skill.yaml file', 'Usage: reactive-skills-axi inspect <path>']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }

  try {
    const engine = new FSMEngine({ skillDir: targetPath });
    const manifest = engine.getManifest();

    const stateNames = Object.keys(manifest.states || {});
    let transitionCount = 0;

    for (const stateName of stateNames) {
      const state = manifest.states[stateName];
      if (state?.transitions) {
        transitionCount += Object.keys(state.transitions).length;
      }
    }

    const metadata = {
      name: manifest.name,
      version: manifest.schema_version || 'unknown',
      description: manifest.description || '',
      initial_state: manifest.initial_state || 'START',
      state_count: stateNames.length,
      transition_count: transitionCount,
    };

    const lines: string[] = [];
    lines.push(renderDetail('skill', metadata, [
      { type: 'field', key: 'name' },
      { type: 'field', key: 'version' },
      { type: 'field', key: 'description' },
      { type: 'field', key: 'initial_state' },
      { type: 'field', key: 'state_count' },
      { type: 'field', key: 'transition_count' },
    ]));

    const statesList = stateNames.map(name => ({
      name,
      description: manifest.states[name]?.description || '',
    }));
    lines.push(renderList('states', statesList, [
      { type: 'field', key: 'name' },
      { type: 'field', key: 'description' },
    ]));

    interface TransitionDef {
      target: string;
      guard?: string;
    }

    const allTransitions: Array<{ from_state: string; signal: string; target: string; guard: string }> = [];
    for (const stateName of stateNames) {
      const state = manifest.states[stateName];
      if (state?.transitions) {
        for (const [signal, trans] of Object.entries(state.transitions)) {
          const transDef: TransitionDef = typeof trans === 'string' ? { target: trans } : trans;
          allTransitions.push({
            from_state: stateName,
            signal,
            target: transDef.target,
            guard: transDef.guard || '',
          });
        }
      }
    }

    if (allTransitions.length > 0) {
      lines.push(renderList('transitions', allTransitions, [
        { type: 'field', key: 'from_state' },
        { type: 'field', key: 'signal' },
        { type: 'field', key: 'target' },
        { type: 'field', key: 'guard' },
      ]));
    }

    const skillName = manifest.name;
    const suggestions = getSuggestions({ domain: 'inspect', action: 'view', skillName });
    lines.push(renderHelp(suggestions));

    return lines.join('\n');
  } catch (err) {
    const error = err instanceof AxiError
      ? err
      : new AxiError(
          err instanceof Error ? err.message : 'Failed to load skill',
          'INVALID_SKILL',
          ['Ensure skill.yaml is valid YAML', 'Check that all referenced files exist']
        );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }
}

