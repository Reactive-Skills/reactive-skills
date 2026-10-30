# Adherence pilot: generated results

> **Pilot.** Three repetitions per cell, one skill per question. These numbers describe these runs only;
> they are not estimates of general rates. Regenerate with `node src/cli.ts report`.

- Agent under test: Claude Code `2.1.314`, model `claude-fable-5-1`, effort `medium`, tools `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`.
- Runs: 24 (24 completed). Filler seed base 20261030.

## Question 1: tdd-refactor under context pressure

| Cell | Runs | Context at task (median tokens) | Correct end state | Runs with order violations | Skipped gates (total) | Missing outputs (total) | Skill re-reads (total, bytes) | Runs reading reactive skill source | Recovery | Self-report mismatches |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tdd-flat-immediate | 3/3 | 10,560 | 3/3 | 0/3 | 0 | 0 | 0, 0 B | 0/3 | 0 violations | n/a |
| tdd-flat-150k | 3/3 | 111,625 | 3/3 | 0/3 | 0 | 0 | 0, 0 B | 0/3 | 0 violations | n/a |
| tdd-flat-compaction | 3/3 | 13,423 | 3/3 | 0/3 | 0 | 0 | 0, 0 B | 0/3 | 0 violations | n/a |
| tdd-reactive-immediate | 3/3 | 11,620 | 3/3 | 0/3 | 0 | 0 | 0, 0 B | 0/3 | 0 violations | 0 |
| tdd-reactive-150k | 3/3 | 112,234 | 3/3 | 0/3 | 0 | 0 | 2, 7,368 B | 0/3 | 0 violations | 0 |
| tdd-reactive-compaction | 3/3 | 11,888 | 3/3 | 0/3 | 0 | 0 | 3, 10,995 B | 0/3 | 0 violations | 0 |

### Skipped gates and violations by run

- `tdd-flat-150k` rep 1 (completed): violations []; skipped []; missing []; acceptance 4 passed / 0 failed.
- `tdd-flat-150k` rep 2 (completed): violations []; skipped []; missing []; acceptance 4 passed / 0 failed.
- `tdd-flat-150k` rep 3 (completed): violations []; skipped []; missing []; acceptance 4 passed / 0 failed.
- `tdd-flat-compaction` rep 1 (completed): violations []; skipped []; missing []; acceptance 4 passed / 0 failed.
- `tdd-flat-compaction` rep 2 (completed): violations []; skipped []; missing []; acceptance 4 passed / 0 failed.
- `tdd-flat-compaction` rep 3 (completed): violations []; skipped []; missing []; acceptance 4 passed / 0 failed.
- `tdd-flat-immediate` rep 1 (completed): violations []; skipped []; missing []; acceptance 4 passed / 0 failed.
- `tdd-flat-immediate` rep 2 (completed): violations []; skipped []; missing []; acceptance 4 passed / 0 failed.
- `tdd-flat-immediate` rep 3 (completed): violations []; skipped []; missing []; acceptance 4 passed / 0 failed.
- `tdd-reactive-150k` rep 1 (completed): violations []; skipped []; missing []; acceptance 4 passed / 0 failed.
- `tdd-reactive-150k` rep 2 (completed): violations []; skipped []; missing []; acceptance 4 passed / 0 failed.
- `tdd-reactive-150k` rep 3 (completed): violations []; skipped []; missing []; acceptance 4 passed / 0 failed.
- `tdd-reactive-compaction` rep 1 (completed): violations []; skipped []; missing []; acceptance 4 passed / 0 failed.
- `tdd-reactive-compaction` rep 2 (completed): violations []; skipped []; missing []; acceptance 4 passed / 0 failed.
- `tdd-reactive-compaction` rep 3 (completed): violations []; skipped []; missing []; acceptance 4 passed / 0 failed.
- `tdd-reactive-immediate` rep 1 (completed): violations []; skipped []; missing []; acceptance 4 passed / 0 failed.
- `tdd-reactive-immediate` rep 2 (completed): violations []; skipped []; missing []; acceptance 4 passed / 0 failed.
- `tdd-reactive-immediate` rep 3 (completed): violations []; skipped []; missing []; acceptance 4 passed / 0 failed.

## Question 2: three-skill workflow

| Cell | Runs | Correct end state | Wrong skill reads (runs) | Wrong skill choices (runs) | Sequence errors (total) | Skipped steps (total) | Skill bytes before first correct action (median) | Skill bytes read (median) | Runs reading reactive skill source | Recovery |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| workflow-flat | 3/3 | 3/3 | 0/3 | 0/3 | 0 | 0 | 3,129 B | 3,129 B | 0/3 | 0 violations |
| workflow-reactive | 3/3 | 3/3 | 0/3 | 0/3 | 0 | 0 | 11,829 B | 16,106 B | 2/3 | 0 violations |

Static newcomer cost (bytes to read before knowing which skill to use):

- Flat library: 706 B of frontmatter across six skills to choose, 1,885 B for the three needed skills in full, 3,131 B for the whole library.
- Reactive router: 676 B entry state prompt; 1,950 B across all its state prompts (delivered one at a time), plus runtime envelope bytes measured above.

## Cost, tokens, turns and wall-clock

| Cell | Median cost per run (USD) | Median total tokens | Median output tokens | Median model turns | Median wall-clock (s) |
| --- | --- | --- | --- | --- | --- |
| tdd-flat-immediate | 0.57 | 135,272 | 3,789 | 10 | 59 |
| tdd-flat-150k | 3.88 | 1,515,787 | 11,932 | 13 | 149 |
| tdd-flat-compaction | 3.86 | 553,237 | 7,949 | 13 | 140 |
| tdd-reactive-immediate | 0.52 | 241,118 | 4,097 | 16 | 74 |
| tdd-reactive-150k | 4.11 | 2,005,921 | 12,211 | 18 | 172 |
| tdd-reactive-compaction | 4.01 | 757,751 | 9,346 | 21 | 264 |
| workflow-flat | 0.37 | 124,134 | 3,032 | 9 | 76 |
| workflow-reactive | 0.52 | 202,909 | 3,082 | 11 | 63 |

Measured pilot spend: **$53.76** over 24 runs (list prices as reported by Claude Code, `costBasis: list`).

## Projected cost of the full grid

Assumptions: per-run cost equals the pilot median of the matching pressure on tdd-refactor; the ~50k level, not piloted,
is interpolated as one third of the way from immediate to ~150k; other skills cost the same as tdd-refactor; prompt-cache
behaviour matches the pilot (1-hour cache writes, then cache reads).

| Part | Grid | Projected USD |
| --- | --- | --- |
| Question 1 | 5 skills x 2 arms x 4 pressures x 10 reps = 400 runs | 1,012 |
| Question 2 | 3 workflows x 2 arms x 10 reps = 60 runs | 25 |
| Total | 460 runs | **1,037** |

