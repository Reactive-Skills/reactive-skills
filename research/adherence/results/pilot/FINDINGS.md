# Adherence pilot: findings

> **Disclosure level: public. Pilot.** Three repetitions per cell, one skill per question, one model.
> Every number below is measured in these 24 runs and describes only these runs.
> The generated tables are in [REPORT.md](REPORT.md), the per-run scores in [scores.json](scores.json), and the sanitized traces in [traces/](traces/).

Agent under test: Claude Code `2.1.314` running `claude-fable-5-1` at effort `medium`. Every run used only that model.

## Pressure applied

| Cell | Context at the task (median tokens) | Peak context (range, tokens) | Notes |
| --- | --- | --- | --- |
| immediate | 10,560 flat / 11,620 reactive | 16,726–20,476 | no filler |
| ~150k | 111,625 flat / 112,234 reactive | 153,619–157,484 | about 250 KB of filler; one ~40k-token request injected at the agent's first test command, before any logged check |
| post-compaction | 13,423 flat / 11,888 reactive | 149,429–150,082 before compaction | compaction observed in all six runs: 150,165–150,822 tokens down to 2,201–3,219 |

In all six compaction runs, Claude Code's compaction summary (6,676–8,425 bytes) named the RED, GREEN and REFACTOR phases and the pending requirement.
Every flat run read `SKILL.md` exactly once, in the skill-load step.

## Question 1: tdd-refactor

| Measure | Flat (9 runs) | Reactive (9 runs) |
| --- | --- | --- |
| Correct end state (hidden acceptance tests, test, lint, typecheck) | 9/9 | 9/9 |
| Runs with step-order violations | 0 | 0 |
| Skipped gates | 0 | 0 |
| Missing outputs (summary file; reactive also needs runtime `COMPLETED`) | 0 | 0 |
| Runtime refusals | n/a | 0 |
| Reported exit codes that disagreed with the real run | n/a | 0 |
| Skill re-reads (immediate / ~150k / post-compaction, total over 3 runs) | 0 / 0 / 0 | 0 / 2 (7,368 B) / 3 (10,995 B) |

Both arms completed every gate in every run, at every pressure level.
Because no run went wrong, no guard refused a signal and no recovery path was exercised.
This pilot therefore does not separate the arms on adherence.
The measured differences are in how each arm behaved after pressure, and in cost.

- After the mid-task injection or compaction, reactive agents fetched the current state from the runtime (2 fetches at ~150k, 3 after compaction). Flat agents never re-read `SKILL.md` and kept working from context or from the compaction summary.

| Cell | Median cost (USD) | Median total tokens | Median model turns | Median wall-clock (s) |
| --- | --- | --- | --- | --- |
| tdd-flat-immediate | 0.57 | 135,272 | 10 | 59 |
| tdd-reactive-immediate | 0.52 | 241,118 | 16 | 74 |
| tdd-flat-150k | 3.88 | 1,515,787 | 13 | 149 |
| tdd-reactive-150k | 4.11 | 2,005,921 | 18 | 172 |
| tdd-flat-compaction | 3.86 | 553,237 | 13 | 140 |
| tdd-reactive-compaction | 4.01 | 757,751 | 21 | 264 |

Total tokens include cache reads, and cache reads dominate. Cost follows cache writes of the filler more than turn count, so the reactive arm used 32–78% more total tokens than the flat arm for a cost difference of −9% to +6%.

## Question 2: three-skill workflow

| Measure | Flat library (3 runs) | Reactive router (3 runs) |
| --- | --- | --- |
| Correct end state (acceptance tests, test, lint, changelog entry for #42) | 3/3 | 3/3 |
| Distractor skills read | 0 | 0 |
| Distractor outputs produced | 0 | 0 |
| Sequence errors / skipped steps | 0 / 0 | 0 / 0 |
| Runtime refusals | n/a | 0 |
| Runs that read the reactive skill's manifest, prompts or guard code directly | n/a | 2/3 |
| Skill bytes read before the first correct action (median) | 3,129 B | 11,829 B |
| Skill bytes read in total (median) | 3,129 B | 16,106 B |
| Median cost / model turns / wall-clock | $0.37 / 9 / 76 s | $0.52 / 11 / 63 s |

The flat agents listed `.skills/`, read only the three skills the goal needed, and applied them in order.
In two of three router runs, the agent did not wait for the runtime to deliver states. It read `skill.yaml`, every state prompt and the guard code with `cat` before its first step. That is most of the router arm's bytes.
Byte counts are tool-result bytes for each command that read skill content. When one command also printed other files, those bytes are included, which inflates both arms.

Static newcomer cost, before any run: 706 B of frontmatter to choose among six flat skills, 1,885 B for the three needed skills in full, against a 676 B router entry prompt plus the runtime envelope.

## Cost

- Measured pilot spend: **$53.76** for 24 runs at list prices, as reported by Claude Code.
- Measured cost per run (medians): $0.52–0.57 immediate, $3.88–4.11 at ~150k, $3.86–4.01 post-compaction, $0.37–0.52 for the workflow.
- Projected full grid of 460 runs: **about $1,037**. That is 5 skills × 2 arms × 4 pressure levels × 10 repetitions, plus 3 workflows × 2 arms × 10 repetitions.
  The projection assumes each run costs the pilot median for its pressure level, interpolates the unpiloted ~50k level, and assumes other skills cost what tdd-refactor cost.

## Decision for the owner

On these fixtures with this model, the pilot measured a ceiling: both arms adhered fully, so the full grid as specified may spend about $1,037 to reproduce the ceiling.
These options are untested:

1. Approve the full grid as specified.
2. First change the design so the adherence metrics can move, then pilot again (each ~24-run pilot costs about $50 at these rates). Candidates:
   - longer skills with more gates;
   - tasks where skipping a step is tempting, such as an obvious one-line fix;
   - tool-driven filler that changes files instead of pasted text;
   - a model of a different size as an added arm;
   - a pressure level whose compaction drops the skill's steps.

## Deviations and limits

- The full 0.20.0 report was not accessible from the environment that built this harness; the in-repo transport benchmark served as the method reference.
- The tdd-refactor reactive arm uses the shipped guards, which trust reported exit codes. In this pilot no reported exit code disagreed with a real run.
- In question 2 the router's guards run the suite themselves, and those runs count as observed suite runs for that arm.
- The ~50k level is configured but was not piloted. The filler is pasted material, not tool work.
