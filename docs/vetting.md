# Vetting third-party skills

`reactive-skills-axi vet` scans a skill, or every skill in a directory, for the threats a reviewer cannot easily see: risky APIs in guards and scripts, prompt injection, hidden content, encoded blobs, and download-and-execute steps.

It is a static check. Vet reads skill files as text or bytes and never imports, requires, or runs any of them. It is a tripwire for review and for CI, not a sandbox and not proof that a skill is safe. See [the trust model](#trust-model) for what the runtime itself executes.

The rule set lives in `@reactive-skills/runtime` and is exported from `@reactive-skills/runtime/vet`, so the same rules back the CLI, the skills catalog's CI, and any other tool.

## Usage

```bash
reactive-skills-axi vet skills/my-skill
reactive-skills-axi vet ./catalog --allowlist vet-allowlist.yaml
reactive-skills-axi vet skills/my-skill --fail-on medium --json
reactive-skills-axi vet --rules
```

| Argument | Meaning |
| --- | --- |
| `<path>` | A skill directory, or a directory whose subdirectories are skills. A skill is a directory with `skill.yaml`, `skill.yml`, or `SKILL.md`. A bare skill name resolves as other commands do. With no path, vet reads the current directory or `./skills/`. |
| `--fail-on <severity>` | The lowest severity that fails the run: `high` (default), `medium`, or `low`. |
| `--allowlist <file>` | A file of reviewed exceptions. See [Allowlist](#allowlist). |
| `--json` | Print the full report as JSON instead of TOON. |
| `--rules` | Print the rule catalog and exit. |

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | No unsuppressed finding at or above `--fail-on`. |
| `1` | At least one unsuppressed finding at or above `--fail-on`. |
| `2` | Vet could not run: a bad flag, a path that is not a skill, or an unreadable or invalid allowlist. |

### Output

The default output is TOON, like the other commands. It has a `vet` summary, a `findings` table with one row per rule and file, then `suppressed` and `unused_allowlist` tables when they apply.

```text
vet:
  status: fail
  fail_on: high
  skills: "1"
  files: "34"
  high: "1"
  medium: "3"
  low: "1"
  suppressed: "0"
findings[5]{skill,severity,rule,file,line,count,guard,message}:
  build-advisor,high,code/child-process,guards/workflow.test.cjs,"7","1","",Starts other processes (child_process)
  ...
```

Each finding has a rule id, a severity, a skill-relative `file`, the first `line` where the rule matched, a `count` of matches in that file, and a short message. Several hits of one rule in one file collapse into one finding. `guard` is `yes` when the runtime loads the file as a `guardFunction`, or when a guard requires it.

`--json` prints the same data with the per-skill structure: `skills[].findings`, `skills[].suppressed`, a `summary`, `failed`, and `unusedAllowlist`. File names and other text that came from a skill are escaped before they are printed, so a hostile file name cannot carry terminal escapes or instructions into the output.

## Severities

| Severity | Meaning |
| --- | --- |
| high | Something a skill almost never needs, or that defeats review: starting processes, opening sockets, reading credentials, hiding text, downloading and running code. Fails the run by default. |
| medium | Needs a human look but is common in legitimate skills: writing files, building code from strings, reading a credential-named variable. |
| low | Informational: a named environment variable, a dependency manifest, an invisible formatting character. |

A rule always reports at its own severity. Allowlist entries are how a reviewed use stops failing the run.

## Rules

Heuristics are deliberately conservative and the catalog is tuned against the published skills so that clean skills produce few findings. A match is a reason to look, not a verdict.

### Risky APIs in guards and scripts

| Rule | Severity | Looks for |
| --- | --- | --- |
| `code/child-process` | high | Starts other processes. |
| `code/network` | high | Opens network connections. |
| `code/env-broad` | high | Reads the whole process environment, or picks variables by a computed name. |
| `code/env-credential` | medium | Reads an environment variable whose name suggests a credential. |
| `code/env-read` | low | Reads a named environment variable. |
| `code/credential-path` | high | Names a credential store such as ~/.ssh, ~/.aws or /etc/shadow. |
| `code/fs-write-outside` | high | Writes to a path outside the skill, such as an absolute path, the home directory or a parent directory. |
| `code/fs-write` | medium | Writes, deletes or renames files; the target cannot be proven to stay inside the skill. |
| `code/dynamic-code` | medium | Builds code from strings with eval, new Function or node:vm. |
| `code/dynamic-require` | medium | Loads a module chosen at run time, which static analysis cannot follow. |
| `code/decoded-exec` | high | Decodes data and also builds code from strings in the same file. |

### Inline guards and guardFunction paths

| Rule | Severity | Looks for |
| --- | --- | --- |
| `guard/sandbox-escape` | high | An inline guard or judgment expression reaches for constructors, prototypes, globals or modules that can break out of the vm sandbox. |
| `guard/path-escape` | high | guardFunction path points outside the skill directory. |

### Prompt injection in prose

| Rule | Severity | Looks for |
| --- | --- | --- |
| `prompt/instruction-override` | high | Tells the agent to ignore its instructions, or carries chat-template control tokens. |
| `prompt/hide-from-user` | high | Tells the agent to keep actions from the user. |
| `prompt/exfiltrate` | high | Tells the agent to send secrets or private data to an outside destination. |
| `prompt/credential-access` | high | Tells the agent to read or send a credential store. |
| `prompt/disable-safety` | high | Tells the agent to disable safety checks, sandboxing or permission prompts. |
| `prompt/bypass-approval` | high | Tells the agent to skip or self-answer a human approval gate. |
| `prompt/dangerous-command` | high | Contains a reverse shell, a recursive delete of a root or home directory, or another destructive command. |

### Hidden content

| Rule | Severity | Looks for |
| --- | --- | --- |
| `hidden/zero-width` | high | Contains zero-width, tag or variation-selector characters that hide text. |
| `hidden/bidi-control` | high | Contains bidirectional embedding, override or isolate characters that reorder displayed text. |
| `hidden/invisible-format` | low | Contains invisible formatting characters such as soft hyphens and directional marks. |
| `hidden/comment-instruction` | high | An HTML or markdown comment carries instructions that rendering hides from a reviewer. |
| `hidden/comment-prose` | medium | An HTML or markdown comment carries several words of prose that rendering hides from a reviewer. |
| `hidden/whitespace-run` | medium | A long run of spaces pushes text off screen. |
| `hidden/long-line` | low | A line is long enough to hide content off screen. |
| `hidden/encoded-payload` | high | An encoded blob decodes to code, a command or an executable. |
| `hidden/encoded-blob` | medium | Contains a long base64 or hex blob. |

### Supply chain

| Rule | Severity | Looks for |
| --- | --- | --- |
| `supply/download-exec` | high | Downloads code and runs it, or installs from a URL. |
| `supply/install-script` | high | package.json declares a script that runs during npm install. |
| `supply/remote-dependency` | medium | Declares a dependency fetched from a URL, git repository or local path instead of a registry. |
| `supply/dependency-manifest` | low | Declares dependencies to install. |
| `supply/vendored-dependencies` | medium | Ships an installed dependency tree that vet does not scan. |
| `supply/binary-executable` | high | Ships a compiled executable, library, WebAssembly module or macro-enabled document. |
| `supply/binary-unknown` | medium | Ships an archive or a binary file of an unrecognized type. |
| `supply/symlink` | high | A symbolic link points outside the skill directory or cannot be resolved. |

### Coverage of the scan itself

| Rule | Severity | Looks for |
| --- | --- | --- |
| `scan/not-scanned` | high | A file could not be fully checked: it was too large, unreadable, slow to scan, or had more matches than vet keeps. |
| `scan/invalid-manifest` | medium | skill.yaml could not be parsed, so its guards were not checked. |
| `scan/limited-analysis` | low | A script in a language vet has no code rules for; only text and hidden-content rules ran. |

### What the heuristics do

- **Code rules** read JavaScript and TypeScript with a small lexer that separates code from comments, strings and regular expressions, so a risky word in a comment or a string does not count. Python, shell and PowerShell, and Go get a smaller set of rules for the same threat classes. Other scripting languages get `scan/limited-analysis`.
- **Environment access** is split by how wide it is. `process.env.NAME` is low, a credential-looking name is medium, and the whole object, a spread, or a computed name is high.
- **File writes** are high only when the target visibly leaves the skill: an absolute path, `~`, the home directory, or `..`. Any other write is medium because the target cannot be proven to stay inside the skill. For copies and symlinks only the destination counts.
- **Inline guards** run in `node:vm`, which is not a security boundary: the sandbox passes host objects such as `Object` and `Boolean` into the expression. A guard or an executable judgment criterion that mentions `constructor`, `prototype`, `process`, `require`, `globalThis`, `this`, `Function`, `eval` and similar names is flagged as a sandbox escape. A criterion that does not compile as an expression is prose and is not checked.
- **Prompt rules** match an imperative: a verb, a target and, for exfiltration, a destination. A match is ignored when a nearby "never", "do not", "detect", "scan for" or similar word shows the text warns against the behavior, so a security skill can describe attacks.
- **Hidden characters** use an explicit code point list rather than every Unicode format character. A joiner between emoji or non-ASCII letters, a byte order mark at the start of a file, and a single emoji presentation selector are allowed.
- **Hidden comments** are HTML comments and markdown link-reference comments outside code blocks and inline code. Known markers such as `<!-- REACTIVE BOOTLOADER -->`, all-caps markers, and linter directives are ignored. A comment that matches a prompt or download rule is `hidden/comment-instruction`. Other comments of six or more words are `hidden/comment-prose`.
- **Encoded blobs** are base64 runs of 120 or more characters with mixed case and digits, and hex runs of 160 or more characters. Vet decodes up to 64 KiB of each and reports a payload when the bytes are an executable or a script, or text that holds commands. Integrity digests, SHA hex digests, and image data URIs are ignored.
- **Guard files** are the `guardFunction` files named in `skill.yaml`, plus the relative modules they require or import. Findings in those files carry `guard: true`.

### Limits

- Static analysis can be evaded. A computed `require` is flagged as `code/dynamic-require`, but obfuscated code can still hide intent. The hardened mode tracked in [#34](https://github.com/Reactive-Skills/reactive-skills/issues/34) is the real boundary.
- Vet does not follow symbolic links. A link inside a skill that leaves it is a high finding, and its target is not read. A skill directory that is itself a link, found while listing a directory of skills, is reported and not scanned. A link you name on the command line is followed to the directory it points to.
- Vet does not scan inside `node_modules`, `.venv`, `venv` or `site-packages`. It reports them as `supply/vendored-dependencies`. It skips `.git` and `.reactive`.
- A file over 16 MiB, an unreadable file, a file that is slow to scan, and a file with more than 5,000 distinct hits of the checks or more than 2,000 hidden comments is `scan/not-scanned` and counts as high, so padding cannot hide content. Allowed characters, comment markers, and ignored blobs do not count toward those limits.
- "New dependencies" cannot be judged without a baseline. Vet reports that a dependency manifest exists. A per-skill trust record that detects change is a separate piece of work.

## Allowlist

A skill that legitimately uses a network, process, or file-system API is listed in an allowlist that the catalog keeps and reviews, so the finding does not fail CI.

```yaml
version: 1
allow:
  - skill: build-advisor
    rule: code/child-process
    path: guards/workflow.test.cjs
    reason: CI test harness that resolves the global runtime with `npm root -g`; skill.yaml does not reference it.
  - skill: skill-manager
    rule: hidden/encoded-blob
    path: evals/results/evidence/**
    reason: Recorded transcripts of eval runs; generated, not authored.
```

| Field | Rule |
| --- | --- |
| `skill` | The skill's directory name. Required, no wildcards. |
| `rule` | One rule id from the table above. Unknown ids are rejected. |
| `path` | A path relative to the skill, with forward slashes. `*` matches within a path segment, `**` matches across segments, `?` matches one character. Paths with `..`, empty segments, or a leading `/` are rejected. |
| `reason` | Required and non-empty. Say why the use is legitimate. |

Other fields, duplicate entries, and a file without an `allow` list are rejected, so a typo cannot silently widen or lose an exception. JSON also works, since it is valid YAML.

An entry suppresses a finding only when the skill, the rule, and the path all match. Suppressed findings are not dropped: they are listed under `suppressed` with their reason, and they do not count toward `--fail-on`. Entries that matched nothing are listed under `unused_allowlist` so they can be deleted.

Vet only reads an allowlist given with `--allowlist`, and it refuses an allowlist that sits inside a skill it is vetting. A skill must not approve its own findings, so keep the file in the catalog next to the skills and review changes to it like code.

## CI

```bash
npx -y @reactive-skills/axi@latest vet . --allowlist .github/vet-allowlist.yaml
```

The step fails with exit code 1 on any unsuppressed high finding, and with exit code 2 when the allowlist is invalid. Use `--json` to build a per-skill report, or `--fail-on medium` to tighten the gate.

## Trust model

The runtime runs on your machine with your privileges. What it executes depends on the skill:

| Skill content | What happens | Privileges |
| --- | --- | --- |
| `guardFunction` files | Loaded with `import()` in the runtime process when a transition is evaluated. | The full privileges of the process: files, environment variables, network, and child processes. |
| Inline `guard` expressions | Evaluated in `node:vm` with a 100 ms limit. | Not a boundary. A crafted expression can reach the host. |
| Judgment criteria | Evaluated the same way when they compile as an expression; otherwise sent to a configured model. | As inline guards. |
| `on_enter` and `on_exit` hooks | Emit signals and set context. They do not run commands. | None beyond the state machine. |
| Prompt slices, state prompts, templates | Read by the agent. The agent may follow them with its own tools, under its own permission settings. | Whatever the agent's tools allow. |
| Handlebars templates | Rendered into deliverables. | File writes inside the workspace. |
| Other files, such as `scripts/` | Never run by the runtime. A person or an agent may run them. | Whatever runs them. |

`sync` copies skill files and does not run them. The runtime does not run vet automatically. Run vet before you install or update a skill from a source you do not control, and read the `guards/` directory and every inline `guard:` expression yourself. SECURITY.md lists the open issues behind this model.
