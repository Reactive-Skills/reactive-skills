import { VET_SEVERITIES, type VetRule, type VetSeverity } from './types.js';

/**
 * The rule catalog. Every finding comes from one of these rules and carries the rule's severity.
 * `docs/vetting.md` lists the same rules, and a test keeps the two in step.
 */
export const VET_RULES: readonly VetRule[] = [
  // Risky APIs in guards and scripts.
  { id: 'code/child-process', severity: 'high', category: 'code', summary: 'Starts other processes' },
  { id: 'code/network', severity: 'high', category: 'code', summary: 'Opens network connections' },
  { id: 'code/env-broad', severity: 'high', category: 'code', summary: 'Reads the whole process environment, or picks variables by a computed name' },
  { id: 'code/env-credential', severity: 'medium', category: 'code', summary: 'Reads an environment variable whose name suggests a credential' },
  { id: 'code/env-read', severity: 'low', category: 'code', summary: 'Reads a named environment variable' },
  { id: 'code/credential-path', severity: 'high', category: 'code', summary: 'Names a credential store such as ~/.ssh, ~/.aws or /etc/shadow' },
  { id: 'code/fs-write-outside', severity: 'high', category: 'code', summary: 'Writes to a path outside the skill, such as an absolute path, the home directory or a parent directory' },
  { id: 'code/fs-write', severity: 'medium', category: 'code', summary: 'Writes, deletes or renames files; the target cannot be proven to stay inside the skill' },
  { id: 'code/dynamic-code', severity: 'medium', category: 'code', summary: 'Builds code from strings with eval, new Function or node:vm' },
  { id: 'code/dynamic-require', severity: 'medium', category: 'code', summary: 'Loads a module chosen at run time, which static analysis cannot follow' },
  { id: 'code/decoded-exec', severity: 'high', category: 'code', summary: 'Decodes data and also builds code from strings in the same file' },

  // Inline guard expressions and guardFunction paths.
  { id: 'guard/sandbox-escape', severity: 'high', category: 'guard', summary: 'An inline guard or judgment expression reaches for constructors, prototypes, globals or modules that can break out of the vm sandbox' },
  { id: 'guard/path-escape', severity: 'high', category: 'guard', summary: 'guardFunction path points outside the skill directory' },

  // Prompt injection in prose.
  { id: 'prompt/instruction-override', severity: 'high', category: 'prompt', summary: 'Tells the agent to ignore its instructions, or carries chat-template control tokens' },
  { id: 'prompt/hide-from-user', severity: 'high', category: 'prompt', summary: 'Tells the agent to keep actions from the user' },
  { id: 'prompt/exfiltrate', severity: 'high', category: 'prompt', summary: 'Tells the agent to send secrets or private data to an outside destination' },
  { id: 'prompt/credential-access', severity: 'high', category: 'prompt', summary: 'Tells the agent to read or send a credential store' },
  { id: 'prompt/disable-safety', severity: 'high', category: 'prompt', summary: 'Tells the agent to disable safety checks, sandboxing or permission prompts' },
  { id: 'prompt/bypass-approval', severity: 'high', category: 'prompt', summary: 'Tells the agent to skip or self-answer a human approval gate' },
  { id: 'prompt/dangerous-command', severity: 'high', category: 'prompt', summary: 'Contains a reverse shell, a recursive delete of a root or home directory, or another destructive command' },

  // Hidden content.
  { id: 'hidden/zero-width', severity: 'high', category: 'hidden', summary: 'Contains zero-width, tag or variation-selector characters that hide text' },
  { id: 'hidden/bidi-control', severity: 'high', category: 'hidden', summary: 'Contains bidirectional embedding, override or isolate characters that reorder displayed text' },
  { id: 'hidden/invisible-format', severity: 'low', category: 'hidden', summary: 'Contains invisible formatting characters such as soft hyphens and directional marks' },
  { id: 'hidden/comment-instruction', severity: 'high', category: 'hidden', summary: 'An HTML or markdown comment carries instructions that rendering hides from a reviewer' },
  { id: 'hidden/comment-prose', severity: 'medium', category: 'hidden', summary: 'An HTML or markdown comment carries several words of prose that rendering hides from a reviewer' },
  { id: 'hidden/whitespace-run', severity: 'medium', category: 'hidden', summary: 'A long run of spaces pushes text off screen' },
  { id: 'hidden/long-line', severity: 'low', category: 'hidden', summary: 'A line is long enough to hide content off screen' },
  { id: 'hidden/encoded-payload', severity: 'high', category: 'hidden', summary: 'An encoded blob decodes to code, a command or an executable' },
  { id: 'hidden/encoded-blob', severity: 'medium', category: 'hidden', summary: 'Contains a long base64 or hex blob' },

  // Supply chain.
  { id: 'supply/download-exec', severity: 'high', category: 'supply', summary: 'Downloads code and runs it, or installs from a URL' },
  { id: 'supply/install-script', severity: 'high', category: 'supply', summary: 'package.json declares a script that runs during npm install' },
  { id: 'supply/remote-dependency', severity: 'medium', category: 'supply', summary: 'Declares a dependency fetched from a URL, git repository or local path instead of a registry' },
  { id: 'supply/dependency-manifest', severity: 'low', category: 'supply', summary: 'Declares dependencies to install' },
  { id: 'supply/vendored-dependencies', severity: 'medium', category: 'supply', summary: 'Ships an installed dependency tree that vet does not scan' },
  { id: 'supply/binary-executable', severity: 'high', category: 'supply', summary: 'Ships a compiled executable, library, WebAssembly module or macro-enabled document' },
  { id: 'supply/binary-unknown', severity: 'medium', category: 'supply', summary: 'Ships an archive or a binary file of an unrecognized type' },
  { id: 'supply/symlink', severity: 'high', category: 'supply', summary: 'A symbolic link points outside the skill directory or cannot be resolved' },

  // Coverage of the scan itself.
  { id: 'scan/not-scanned', severity: 'high', category: 'scan', summary: 'A file could not be fully checked: it was too large, unreadable, slow to scan, or had more matches than vet keeps' },
  { id: 'scan/invalid-manifest', severity: 'medium', category: 'scan', summary: 'skill.yaml could not be parsed, so its guards were not checked' },
  { id: 'scan/limited-analysis', severity: 'low', category: 'scan', summary: 'A script in a language vet has no code rules for; only text and hidden-content rules ran' },
];

const RULES_BY_ID: ReadonlyMap<string, VetRule> = new Map(VET_RULES.map((rule) => [rule.id, rule]));

export function getVetRule(id: string): VetRule | undefined {
  return RULES_BY_ID.get(id);
}

/** Lower rank means more severe. */
export function severityRank(severity: VetSeverity): number {
  return VET_SEVERITIES.indexOf(severity);
}

/** True when `severity` is at least as severe as `threshold`. */
export function meetsThreshold(severity: VetSeverity, threshold: VetSeverity): boolean {
  return severityRank(severity) <= severityRank(threshold);
}

export function isVetSeverity(value: unknown): value is VetSeverity {
  return typeof value === 'string' && (VET_SEVERITIES as readonly string[]).includes(value);
}
