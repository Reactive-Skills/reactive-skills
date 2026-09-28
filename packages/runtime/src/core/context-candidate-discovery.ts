import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'js-yaml';
import type { ContextRouteCandidate } from './context-router.js';

export function readSkillMetadata(skillDir: string, fallbackName: string): { skill: string; summary: string } | undefined {
  let skill = fallbackName;
  let summary = '';
  let foundMetadata = false;

  for (const fileName of ['skill.yaml', 'skill.yml']) {
    const manifestPath = path.join(skillDir, fileName);
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = yaml.load(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown> | undefined;
      if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) continue;
      foundMetadata = true;
      if (typeof manifest.name === 'string') skill = manifest.name.trim() || skill;
      if (typeof manifest.description === 'string') summary = manifest.description.trim();
    } catch {
      // Try another supported skill metadata file.
    }
    if (summary) return { skill, summary: summary.slice(0, 1_000) };
  }

  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (fs.existsSync(skillMdPath)) {
    foundMetadata = true;
    try {
      const raw = fs.readFileSync(skillMdPath, 'utf8').slice(0, 12_000);
      const frontmatter = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      if (frontmatter) {
        const parsed = yaml.load(frontmatter[1]) as Record<string, unknown> | undefined;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          if (typeof parsed.name === 'string') skill = parsed.name.trim() || skill;
          if (typeof parsed.description === 'string') summary = parsed.description.trim();
        }
      }
      if (!summary) {
        const heading = raw.match(/^#\s+(.+)$/m)?.[1]?.trim();
        summary = heading ? `Instructions for ${heading}` : `Instructions for ${skill}`;
      }
    } catch {
      summary = `Instructions for ${skill}`;
    }
  }

  if (!foundMetadata) return undefined;
  return { skill, summary: summary.slice(0, 1_000) || `Instructions for ${skill}` };
}

/**
 * Discovers bounded skill metadata from the workspace and supported agent skill roots.
 * Reads metadata only; it never imports or executes skill code.
 */
export function discoverContextCandidates(
  userMessage: string,
  workspaceDir = process.cwd(),
): ContextRouteCandidate[] {
  const searchDirs = [
    path.resolve(workspaceDir, 'skills'),
    path.join(os.homedir(), '.agents', 'skills'),
    path.join(os.homedir(), '.gemini', 'config', 'skills'),
    path.join(os.homedir(), '.kilocode', 'skills'),
    path.join(os.homedir(), '.codex', 'skills'),
  ];
  const messageTokens = new Set(userMessage.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
  const candidates: Array<ContextRouteCandidate & { score: number }> = [];
  const seen = new Set<string>();

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(dir, entry.name);
      try {
        const hasMetadataFile = ['skill.yaml', 'skill.yml', 'SKILL.md']
          .some((fileName) => fs.existsSync(path.join(skillDir, fileName)));
        if (!hasMetadataFile) continue;
        const metadata = readSkillMetadata(skillDir, entry.name);
        if (!metadata) continue;
        const skill = metadata.skill;
        const summary = metadata.summary;
        if (!skill || !summary || seen.has(skill)) continue;
        seen.add(skill);
        const candidateTokens = new Set(`${skill} ${summary}`.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
        const score = [...messageTokens].reduce((total, token) => total + (candidateTokens.has(token) ? 1 : 0), 0);
        candidates.push({
          id: skill,
          skill,
          summary: summary.slice(0, 1_000),
          score,
        });
      } catch {
        // Ignore unreadable skill metadata during local candidate discovery.
      }
    }
  }

  return candidates
    .sort((left, right) => right.score - left.score || left.skill.localeCompare(right.skill))
    .slice(0, 12)
    .map(({ score: _score, ...candidate }) => candidate);
}
