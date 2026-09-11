import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { SkillManifest } from './types.js';

export interface LegacySkillMetadata {
  name: string;
  description: string;
  rawMarkdown: string;
  frontmatter?: Record<string, any>;
}

/**
 * Legacy Skill Adapter
 * Enables backward compatibility with existing static SKILL.md files.
 * Automatically wraps plain markdown skills into reactive state machines or upgrades them.
 */
export class LegacySkillAdapter {
  /**
   * Parse frontmatter and markdown body from SKILL.md
   */
  public static parseSkillMd(skillMdPath: string): LegacySkillMetadata {
    if (!fs.existsSync(skillMdPath)) {
      throw new Error(`SKILL.md not found at ${skillMdPath}`);
    }

    const content = fs.readFileSync(skillMdPath, 'utf8');
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

    let frontmatter: Record<string, any> = {};
    let rawMarkdown = content;

    if (frontmatterMatch) {
      try {
        frontmatter = (yaml.load(frontmatterMatch[1]) as Record<string, any>) || {};
        rawMarkdown = frontmatterMatch[2];
      } catch {
        // Fallback if frontmatter is plain text
      }
    }

    const name = frontmatter.name || path.basename(path.dirname(skillMdPath));
    const description = frontmatter.description || `Skill for ${name}`;

    return {
      name,
      description,
      rawMarkdown,
      frontmatter,
    };
  }

  /**
   * Wraps a legacy SKILL.md in-memory into a 3-stage reactive state machine
   * (DISCOVERY -> EXECUTION -> VERIFICATION -> COMPLETED)
   */
  public static wrapAsReactiveManifest(skillMdPath: string): SkillManifest {
    const meta = this.parseSkillMd(skillMdPath);

    return {
      schema_version: 'reactive/v1',
      name: meta.name,
      description: meta.description,
      initial_state: 'EXECUTION',
      states: {
        DISCOVERY: {
          description: 'Analyze requirements and verify workspace prerequisites',
          prompt_template: 'states/01_discovery.md',
          tools: ['view_file', 'grep_search', 'find_by_name'],
          transitions: {
            READY_TO_EXECUTE: {
              target: 'EXECUTION',
            },
          },
        },
        EXECUTION: {
          description: `Execute instructions according to ${meta.name} skill`,
          prompt_template: 'SKILL.md', // Direct reference to original markdown body
          transitions: {
            TASK_COMPLETED: {
              target: 'VERIFICATION',
            },
            TEST_RAN: {
              target: 'VERIFICATION',
              guard: 'event.payload.exit_code === 0',
            },
          },
        },
        VERIFICATION: {
          description: 'Validate quality gates, linting, or tests',
          prompt_template: 'states/03_verification.md',
          transitions: {
            VERIFIED: {
              target: 'COMPLETED',
            },
            REGRESSION_FOUND: {
              target: 'EXECUTION',
            },
          },
        },
        COMPLETED: {
          description: 'Skill workflow finalized',
          prompt_template: 'states/04_completed.md',
        },
      },
      deliverable_projections: [
        {
          template: 'templates/summary.md.hbs',
          output: `.docs/${meta.name}-execution-summary.md`,
        },
      ],
    };
  }

  /**
   * Upgrades a legacy SKILL.md directory into a full modular Reactive Skill package
   */
  public static upgradeToModular(skillDir: string, outDir?: string): string {
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    const meta = this.parseSkillMd(skillMdPath);
    const targetDir = outDir ? path.resolve(outDir) : skillDir;

    const statesDir = path.join(targetDir, 'states');
    const templatesDir = path.join(targetDir, 'templates');
    const guardsDir = path.join(targetDir, 'guards');

    fs.mkdirSync(statesDir, { recursive: true });
    fs.mkdirSync(templatesDir, { recursive: true });
    fs.mkdirSync(guardsDir, { recursive: true });

    // 1. Write skill.yaml
    const manifest = this.wrapAsReactiveManifest(skillMdPath);
    // Point EXECUTION prompt to the modular state file
    manifest.states.EXECUTION.prompt_template = 'states/02_execution.md';
    fs.writeFileSync(path.join(targetDir, 'skill.yaml'), yaml.dump(manifest), 'utf8');

    // 2. Write state slices
    fs.writeFileSync(
      path.join(statesDir, '01_discovery.md'),
      `# Discovery Phase: ${meta.name}\n\nReview requirements and inspect existing codebase context before making changes.`,
      'utf8'
    );

    fs.writeFileSync(
      path.join(statesDir, '02_execution.md'),
      `# Execution Phase: ${meta.name}\n\n${meta.rawMarkdown}`,
      'utf8'
    );

    fs.writeFileSync(
      path.join(statesDir, '03_verification.md'),
      `# Verification Phase: ${meta.name}\n\nRun verification suites and ensure zero regressions before completing.`,
      'utf8'
    );

    fs.writeFileSync(
      path.join(statesDir, '04_completed.md'),
      `# Completed: ${meta.name}\n\nExecution finished. Deliverables projected.`,
      'utf8'
    );

    // 3. Write summary projection template
    fs.writeFileSync(
      path.join(templatesDir, 'summary.md.hbs'),
      `# {{skillName}} Execution Audit\n\n- State: **{{currentState}}**\n- Synchronized: {{lastUpdated}}\n\n## State Transitions\n{{#each transitions}}\n- {{timestamp}}: \`{{from}}\` -> \`{{to}}\` (via {{signal}})\n{{/each}}\n`,
      'utf8'
    );

    return targetDir;
  }
}
