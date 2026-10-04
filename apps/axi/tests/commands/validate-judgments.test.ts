import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { validateSkill } from '../../src/commands/validate.js';
import { createReactiveBootloaderReference } from '@reactive-skills/runtime';

const CAPABILITY_REQUIREMENT = `runtime_requirements:
  required_capabilities: [judgment.probability_thresholds]
`;

function writeSkill(root: string, judgmentYaml: string, options: { header?: string; guards?: Record<string, string> } = {}): string {
  const skillDir = path.join(root, 'judgment-skill');
  fs.mkdirSync(path.join(skillDir, 'guards'), { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'skill.yaml'),
    `schema_version: 2.1.0
name: judgment-skill
description: Judgment lint test skill
initial_state: REVIEW
${options.header ?? ''}states:
  REVIEW:
    transitions:
      SUBMIT:
        target: DONE
        judgment:
${judgmentYaml.trim().split('\n').map((line) => `          ${line}`).join('\n')}
  HUMAN_REVIEW: {}
  REVISE: {}
  DONE: {}
`
  );
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `${createReactiveBootloaderReference('judgment-skill')}\n\n# Judgment Skill`
  );
  for (const [name, content] of Object.entries(options.guards ?? {})) {
    fs.writeFileSync(path.join(skillDir, 'guards', name), content);
  }
  return skillDir;
}

describe('validate judgment thresholds and guard contracts', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axi-judgment-lint-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('warns on a semantic predicate that relies on min_confidence and names the equivalent min_probability', () => {
    const result = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "Is it ready?"
min_confidence: 0.7
`));

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain(
      'State "REVIEW" transition on "SUBMIT" predicate judgment relies on min_confidence 0.7, which requires P(yes) >= 0.85; declare min_probability: 0.85 instead'
    );
  });

  it('warns when an executable predicate lacks adapter_hint: script (#15)', () => {
    const result = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "payload.findings.length === 4 && payload.findings.every(f => f.status)"
min_confidence: 0.85
fallback_adapter: script
fallback_target: REVISE
`));

    expect(result.valid).toBe(true);
    const warning = result.warnings.find((w) => w.includes('executable expression'));
    expect(warning).toBe(
      'State "REVIEW" transition on "SUBMIT" predicate criterion is an executable expression, but adapter_hint is not set; when Jev is available the model judges this exact check instead of the script adapter evaluating it. Set adapter_hint: script (fallback_adapter: script runs only when the primary adapter fails)'
    );
    expect(result.warnings.some((w) => w.includes('relies on min_confidence'))).toBe(false);
  });

  it('names a non-script adapter_hint on an executable predicate (#15)', () => {
    const result = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "payload.exit_code === 0"
adapter_hint: jev
min_probability: 0.9
`, { header: 'runtime_requirements:\n  required_capabilities: [judgment.probability_thresholds]\n' }));

    expect(result.warnings.some((w) => w.includes("adapter_hint is 'jev'"))).toBe(true);
  });

  it('does not warn about adapter_hint for a hinted executable predicate or a natural-language criterion (#15)', () => {
    const hinted = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "payload.exit_code === 0"
adapter_hint: script
`));
    expect(hinted.warnings.some((w) => w.includes('executable expression'))).toBe(false);

    fs.rmSync(path.join(tmpDir, 'judgment-skill'), { recursive: true, force: true });
    const semantic = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "Is it ready?"
min_probability: 0.85
`, { header: 'runtime_requirements:\n  required_capabilities: [judgment.probability_thresholds]\n' }));
    expect(semantic.warnings.some((w) => w.includes('executable expression'))).toBe(false);
  });

  it('names the default min_confidence when a semantic predicate declares no threshold', () => {
    const result = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "Is it ready?"
`));

    expect(result.warnings.some((warning) => warning.includes('relies on the default min_confidence 0.75, which requires P(yes) >= 0.875'))).toBe(true);
  });

  it('warns on a semantic categorical judgment without min_probability', () => {
    const result = validateSkill(writeSkill(tmpDir, `
type: categorical
criterion: "Which kind?"
options: [bug, feature]
min_confidence: 0.8
`));

    expect(result.warnings.some((warning) => warning.includes("categorical judgment compares min_confidence with the adapter's confidence score"))).toBe(true);
  });

  it('does not warn about thresholds on script judgments', () => {
    const result = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "payload.clean === true"
adapter_hint: script
min_confidence: 0.85
`));

    expect(result.warnings.filter((warning) => warning.includes('min_confidence'))).toEqual([]);
  });

  it('warns when min_probability is used without the capability requirement', () => {
    const result = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "Is it ready?"
min_probability: 0.85
`));

    expect(result.warnings.some((warning) => warning.includes('does not include judgment.probability_thresholds'))).toBe(true);
  });

  it('is silent when min_probability is used with the capability requirement', () => {
    const result = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "Is it ready?"
min_probability: 0.85
escalate:
  min_probability: 0.3
  target: HUMAN_REVIEW
fallback_target: REVISE
`, { header: CAPABILITY_REQUIREMENT }));

    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('reports invalid threshold combinations as schema errors', () => {
    const result = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "Is it ready?"
min_probability: 0.85
min_confidence: 0.7
`, { header: CAPABILITY_REQUIREMENT }));

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('set either min_probability or min_confidence, not both'))).toBe(true);
  });

  it('errors when escalate targets an unknown state', () => {
    const result = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "Is it ready?"
min_probability: 0.85
escalate:
  min_probability: 0.3
  target: HUMAN_REVEIW
`, { header: CAPABILITY_REQUIREMENT }));

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'State "REVIEW" transition on "SUBMIT" judgment escalates to unknown state "HUMAN_REVEIW"'
    );
  });

  it('treats an omitted min_confidence and the explicit default as the same threshold', () => {
    const result = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "Is it ready?"
min_confidence: 0.75
`, {
      guards: {
        'ready.yaml': `primitive: noul
snap_on:
  judgment:
    type: predicate
    criterion: "Is it ready?"
`,
      },
    }));

    expect(result.errors).toEqual([]);
  });

  it('errors when a guard contract and skill.yaml disagree on a threshold', () => {
    const result = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "Is it ready?"
min_probability: 0.85
`, {
      header: CAPABILITY_REQUIREMENT,
      guards: {
        'ready.yaml': `primitive: noul
snap_on:
  judgment:
    type: predicate
    criterion: "Is it ready?"
    min_probability: 0.9
`,
      },
    }));

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Guard contract guards/ready.yaml and State "REVIEW" transition on "SUBMIT" disagree on threshold: guard min_probability 0.9, skill.yaml min_probability 0.85'
    );
  });

  it('errors when the guard accept band disagrees with the enforced probability', () => {
    const result = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "Is it ready?"
min_confidence: 0.9
`, {
      guards: {
        'ready.yaml': `primitive: noul
thresholds:
  accept: ">= 0.9"
snap_on:
  judgment:
    type: predicate
    criterion: "Is it ready?"
    min_confidence: 0.9
`,
      },
    }));

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Guard contract guards/ready.yaml accept band >= 0.9 requires P >= 0.9, but State "REVIEW" transition on "SUBMIT" accepts at P >= 0.95'
    );
  });

  it('warns on a guard contract that no judgment enforces', () => {
    const result = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "Is it ready?"
min_probability: 0.85
`, {
      header: CAPABILITY_REQUIREMENT,
      guards: {
        'orphan.yaml': `primitive: noul
snap_on:
  judgment:
    type: predicate
    criterion: "Is something else true?"
    min_probability: 0.85
`,
      },
    }));

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain(
      'Guard contract guards/orphan.yaml is not enforced: no skill.yaml judgment uses its snap_on.judgment criterion'
    );
  });

  it('warns on inverted accept polarity and an unenforced escalate band', () => {
    const result = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "Is the letter clean?"
min_confidence: 0.6
`, {
      guards: {
        'voice.yaml': `primitive: noul
thresholds:
  reject: ">= 0.60"
  accept: "< 0.20"
  escalate: "0.20 – 0.60"
snap_on:
  judgment:
    type: predicate
    criterion: "Is the letter clean?"
    min_confidence: 0.6
`,
      },
    }));

    expect(result.valid).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('opposite polarity'))).toBe(true);
    expect(result.warnings).toContain(
      'Guard contract guards/voice.yaml declares escalate band 0.2 to 0.6, but State "REVIEW" transition on "SUBMIT" has no escalate block, so grey-zone results are rejected'
    );
  });

  it('errors when the guard escalate band disagrees with the enforced escalate block', () => {
    const result = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "Is it ready?"
min_probability: 0.85
escalate:
  min_probability: 0.4
  target: HUMAN_REVIEW
`, {
      header: CAPABILITY_REQUIREMENT,
      guards: {
        'ready.yaml': `primitive: noul
thresholds:
  accept: ">= 0.85"
  escalate: "0.3 - 0.85"
snap_on:
  judgment:
    type: predicate
    criterion: "Is it ready?"
    min_probability: 0.85
    escalate:
      min_probability: 0.4
      target: HUMAN_REVIEW
`,
      },
    }));

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('escalate band starts at P >= 0.3'))).toBe(true);
  });

  it('warns on TODO thresholds', () => {
    const result = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "Is it ready?"
min_probability: 0.85
`, {
      header: CAPABILITY_REQUIREMENT,
      guards: {
        'ready.yaml': `primitive: noul
thresholds:
  accept: ">= 0.85"
  reject: TODO
snap_on:
  judgment:
    type: predicate
    criterion: "Is it ready?"
    min_probability: 0.85
`,
      },
    }));

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('Guard contract guards/ready.yaml has unresolved TODO thresholds or failure behavior');
  });

  it('accepts a guard contract that matches the enforced judgment', () => {
    const result = validateSkill(writeSkill(tmpDir, `
type: predicate
criterion: "Is it ready?"
min_probability: 0.85
escalate:
  min_probability: 0.3
  target: HUMAN_REVIEW
fallback_target: REVISE
`, {
      header: CAPABILITY_REQUIREMENT,
      guards: {
        'ready.yaml': `primitive: noul
thresholds:
  accept: ">= 0.85"
  reject: "< 0.3"
  escalate: "0.3 - 0.85"
failure_behavior: fail_closed
snap_on:
  judgment:
    type: predicate
    criterion: "Is it ready?"
    min_probability: 0.85
    escalate:
      min_probability: 0.3
      target: HUMAN_REVIEW
    fallback_target: REVISE
`,
      },
    }));

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});
