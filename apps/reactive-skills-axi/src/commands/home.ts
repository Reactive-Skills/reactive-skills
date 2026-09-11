import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'js-yaml';
import { encode } from '@toon-format/toon';
import { renderHelp, renderOutput } from '../toon.js';
import { getSuggestions } from '../suggestions.js';

const HOME_DIR = os.homedir();

const SKILL_ROOTS = [
  path.resolve(process.cwd(), 'skills'),
  path.resolve(HOME_DIR, '.agents', 'skills'),
  path.resolve(HOME_DIR, '.gemini', 'config', 'skills'),
];

function findSkills(): Array<{ name: string; description: string; initial_state: string; path: string }> {
  const skills: Array<{ name: string; description: string; initial_state: string; path: string }> = [];

  for (const root of SKILL_ROOTS) {
    if (!fs.existsSync(root)) continue;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const skillYamlPath = path.join(root, entry.name, 'skill.yaml');
      if (!fs.existsSync(skillYamlPath)) continue;

      try {
        const content = fs.readFileSync(skillYamlPath, 'utf8');
        const parsed = yaml.load(content) as {
          name?: string;
          description?: string;
          initial_state?: string;
        };
        skills.push({
          name: parsed.name || entry.name,
          description: parsed.description || '',
          initial_state: parsed.initial_state || 'START',
          path: path.join(root, entry.name),
        });
      } catch {
        skills.push({
          name: entry.name,
          description: '',
          initial_state: 'START',
          path: path.join(root, entry.name),
        });
      }
    }
  }

  return skills
    .sort((a, b) => a.name.localeCompare(b.name))
    .reduce((acc, skill) => {
      if (!acc.find(s => s.name === skill.name)) {
        acc.push(skill);
      }
      return acc;
    }, [] as typeof skills);
}

export async function homeCommand(): Promise<string> {
  const skills = findSkills();
  const total = skills.length;

  const binPath = process.argv[1] || 'reactive-skills-axi';
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const binDisplay = binPath.replace(homeDir, '~');

  const description = 'AXI-compliant CLI for Reactive Skills Architecture — state, emit, events in TOON format';

  const headerData = {
    bin: binDisplay,
    description,
    count: total + ' skill' + (total !== 1 ? 's' : '') + ' total',
  };

  const lines: string[] = [];
  lines.push('bin: ' + headerData.bin);
  lines.push('description: ' + headerData.description);
  lines.push('count: ' + headerData.count);

  if (skills.length > 0) {
    const skillsData = { skills: skills.map((s, i) => ({ ['skills[' + i + ']']: s })) };
    const encoded = encode(skillsData);
    lines.push(encoded);
  }

  const suggestions = getSuggestions({ domain: 'home', action: 'list' });
  lines.push(renderHelp(suggestions));

  return lines.join('\n');
}