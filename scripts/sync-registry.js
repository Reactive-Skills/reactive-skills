#!/usr/bin/env node
/**
 * scripts/sync-registry.js
 *
 * Synchronizes the site's skill registry with the public registry repository:
 * https://github.com/Reactive-Skills/skills
 *
 * It looks for the sibling directory `../skills` (the local checkout of Reactive-Skills/skills).
 * If found, it parses `skill.yaml` and `STATECHART.md` directly.
 * Otherwise, it can fallback to cached or GitHub raw content.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const LOCAL_SKILLS_REPO = path.resolve(ROOT_DIR, '..', 'skills');
const OUTPUT_FILE = path.resolve(ROOT_DIR, 'apps/site/src/infrastructure/content/registry/skills.js');

const IGNORED_DIRS = new Set([
  '.git',
  '.github',
  '.reactive',
  '.scratch',
  'scripts',
  'node_modules',
  'dist',
  'bin',
  'tmp'
]);

function extractMermaid(statechartContent) {
  if (!statechartContent) return null;
  const match = statechartContent.match(/```mermaid\s*([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

const PRIORITY_SKILLS = {
  'skill-manager': {
    featured: true,
    priorityBadge: 'Essential / Authoring',
    featuredReason: 'Core Utility: The official tool for creating, updating, and migrating reactive skills. Automatically synchronizes skill.yaml, state prompts, and STATECHART.md.',
  },
};

function categoryForSkill(name, rawCat) {
  if (rawCat) return rawCat;
  if (name.includes('test') || name.includes('triage') || name.includes('refactor') || name.includes('mutation')) {
    return 'Testing & Quality';
  }
  if (name.includes('resume') || name.includes('career') || name.includes('intake')) {
    return 'Career & Automation';
  }
  if (name.includes('manager') || name.includes('architect') || name.includes('synthesis')) {
    return 'Metaprogramming & Lifecycle';
  }
  return 'General';
}

export function syncSkills() {
  console.log(`[sync-registry] Checking for public registry at: ${LOCAL_SKILLS_REPO}`);

  let skillDirs = [];
  if (fs.existsSync(LOCAL_SKILLS_REPO)) {
    const entries = fs.readdirSync(LOCAL_SKILLS_REPO, { withFileTypes: true });
    skillDirs = entries
      .filter((e) => e.isDirectory() && !IGNORED_DIRS.has(e.name))
      .map((e) => path.join(LOCAL_SKILLS_REPO, e.name));
  }

  if (skillDirs.length === 0) {
    console.warn(`[sync-registry] No skills directory found at ${LOCAL_SKILLS_REPO}. Retaining existing generated content.`);
    return;
  }

  const skills = [];

  for (const dir of skillDirs) {
    const yamlPath = path.join(dir, 'skill.yaml');
    if (!fs.existsSync(yamlPath)) continue;

    try {
      const rawYaml = fs.readFileSync(yamlPath, 'utf8');
      const doc = yaml.load(rawYaml);
      if (!doc || !doc.name) continue;

      const statechartPath = path.join(dir, 'STATECHART.md');
      let mermaidChart = null;
      if (fs.existsSync(statechartPath)) {
        mermaidChart = extractMermaid(fs.readFileSync(statechartPath, 'utf8'));
      }

      // Collect unique tools across all states
      const toolsSet = new Set();
      const stateList = [];

      if (doc.states && typeof doc.states === 'object') {
        for (const [stateName, stateDef] of Object.entries(doc.states)) {
          if (!stateDef || typeof stateDef !== 'object') continue;

          if (Array.isArray(stateDef.tools)) {
            for (const t of stateDef.tools) toolsSet.add(t);
          }

          const transitions = [];
          if (stateDef.transitions && typeof stateDef.transitions === 'object') {
            for (const [sig, transDef] of Object.entries(stateDef.transitions)) {
              if (typeof transDef === 'string') {
                transitions.push({ signal: sig, target: transDef });
              } else if (transDef && typeof transDef === 'object') {
                transitions.push({
                  signal: sig,
                  target: transDef.target || 'UNKNOWN',
                  guard: transDef.guard ? String(transDef.guard) : undefined,
                });
              }
            }
          }

          stateList.push({
            name: stateName,
            description: stateDef.description || `Operational state ${stateName}`,
            tools: Array.isArray(stateDef.tools) ? stateDef.tools : [],
            transitions,
          });
        }
      }

      const deliverables = [];
      if (Array.isArray(doc.deliverable_projections)) {
        for (const p of doc.deliverable_projections) {
          if (p && p.output) deliverables.push(p.output);
        }
      }

      const priorityInfo = PRIORITY_SKILLS[doc.name] || {};

      skills.push({
        slug: doc.name,
        name: doc.name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        version: String(doc.version || '1.0.0'),
        schemaVersion: String(doc.schema_version || '2.1.0'),
        category: categoryForSkill(doc.name, doc.category),
        description: (doc.description || '').replace(/\s+/g, ' ').trim(),
        tags: [doc.name, ...(doc.name.split('-'))],
        strictExecution: Boolean(doc.strict_execution),
        featured: Boolean(priorityInfo.featured),
        priorityBadge: priorityInfo.priorityBadge || undefined,
        featuredReason: priorityInfo.featuredReason || undefined,
        initialState: doc.initial_state || 'INIT',
        contextKeys: Array.isArray(doc.context_keys) ? doc.context_keys : [],
        defaultContext: doc.default_context || {},
        tools: Array.from(toolsSet),
        registryRepo: 'Reactive-Skills/skills',
        skillsShInstallCmd: `npx skills add Reactive-Skills/skills --skill ${doc.name}`,
        installCmd: `npx -y @reactive-skills/axi invoke ${doc.name}`,
        author: 'Reactive Skills Core Team',
        stateCount: stateList.length,
        states: stateList,
        mermaidChart: mermaidChart || undefined,
        deliverables: deliverables.length > 0 ? deliverables : undefined,
      });

      console.log(`[sync-registry] Synced: ${doc.name} (${stateList.length} states, v${doc.version}${priorityInfo.featured ? ' [FEATURED]' : ''})`);
    } catch (err) {
      console.error(`[sync-registry] Failed to parse ${yamlPath}:`, err);
    }
  }

  // Priority skills first, then alphabetical
  skills.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return a.name.localeCompare(b.name);
  });

  const fileContent = `/** @type {import('@/contracts/types').RegistrySkillDetail[]} */
// Generated automatically by scripts/sync-registry.js from Reactive-Skills/skills
export const registrySkills = ${JSON.stringify(skills, null, 2)};
`;

  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      fs.unlinkSync(OUTPUT_FILE);
    }
  } catch {}

  fs.writeFileSync(OUTPUT_FILE, fileContent, 'utf8');
  console.log(`[sync-registry] Successfully wrote ${skills.length} skills to ${OUTPUT_FILE}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncSkills();
}
