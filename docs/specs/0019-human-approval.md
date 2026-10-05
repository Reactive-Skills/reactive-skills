# Specification: Human Approval and Refusal Reasons (v0.18.0)

Status: Draft for DoD approval.

Scope: `docs/scope/release-v0.18.0-human-approval.md`.
Decision record: `docs/adr/0012-human-approval-for-unjudgeable-gates.md`, building on ADR 0011.

## 1. Pending approvals (#22 part 2)

1. A judgment that returns band `unevaluable` refuses the signal and appends `APPROVAL_REQUESTED` with `state`, `signal`, `target`, `criterion`, `judgmentType`, the signal payload, and the unevaluable reason.
2. Without a configured model and without a self-report grant, a natural-language criterion is unevaluable instead of decided from the payload.
3. The refusal reason keeps the cause and adds: stop and ask the user to run `reactive-skills-axi approve <skill> --job <id>` in their own terminal.
4. A second refused emit of the same signal in the same state while a request is pending does not create a duplicate request.

## 2. The approve command

5. `reactive-skills-axi approve <skill> [--job <id>]` exits with an error and changes nothing unless both standard input and standard output are interactive terminals.
6. It lists pending requests for the job, oldest first, with state, signal, criterion, and a bounded summary of the payload.
7. For each request it prints a four-character code from an unambiguous alphabet generated with `crypto.randomInt` and reads one line at a time: an exact match (case-insensitive) approves, `reject` rejects, any other answer asks again up to five times, and end of input or a fifth wrong answer cancels without deciding (amended 2026-10-04 after review).
8. It appends `APPROVAL_DECIDED` with `requestId`, `decision`, and `channel: "interactive_terminal"`, then re-sends the original signal and payload with that event as the signal's cause.
9. MCP registers no tool that decides a pending request.

## 3. Human-decided judgments

10. When a signal's cause is an `APPROVAL_DECIDED` event, the engine validates that it names an `APPROVAL_REQUESTED` event for the same state, signal, target, criterion, and payload in the same run and that no earlier `SIGNAL_EMITTED` was caused by it.
11. A valid approval decides the judgment with `passed: true`, band `accept`, and `decidedBy: "human"`; a valid rejection decides it with band `reject`, which routes to `fallback_target` when declared and otherwise refuses.
12. An invalid or already consumed decision is ignored, and the judgment is evaluated normally.
13. The emit result reports `judgment_basis: human` for a human-decided transition.

## 4. Self-report grant

14. `approve --allow-self-reported` requires the same terminal and code check and writes the grant, with `workspace`, `grantedAt`, and `channel`, to `~/.reactive-skills/grants/<hash of the workspace path>.json`; nothing in the workspace counts as a grant. `approve --revoke-self-reported` deletes it without a code (home-folder store amended 2026-10-04 after review).
15. With a grant and no configured model, natural-language criteria are decided from the payload, labeled self-reported, and the emit output carries a warning line.
16. A grant never applies when a configured model is in an outage.
16a. The first self-reported decision each grant allows in a run appends `SELF_REPORT_GRANT_USED` with the grant's `grantedAt` and `channel`.

## 5. Decision source

17. Every judgment result carries `decidedBy`: `model`, `expression`, `human`, or `self_reported`, recorded in `GUARD_EVALUATED`.

## 6. Authoring errors (#47)

18. `JevJudgmentAdapter` throws a `JudgmentAuthoringError` for configuration problems it can detect before calling the model, such as an evaluation rubric with fewer than two criteria.
19. The engine does not record an authoring error against the circuit breaker, and the reason names the authoring problem, says retrying will not help, and asks the agent to report the skill problem to the user.

## 7. Refusal reasons (#32)

20. A guard function may return `{ passed, reason }`; a falsy `passed` refuses with `reason` as the refusal reason.
21. A transition may declare `guard_message`, returned when its inline guard refuses.
22. A refused guard with no message returns `Guard refused: <expression>` or `Guard function <path> refused`.
23. Boolean guard results keep working unchanged.

## 8. Capability

24. The runtime advertises `judgment.human_approval`.

## 9. Build order

1. Criteria 17, then 1 to 4 and 10 to 13 in the engine.
2. Criteria 5 to 9 in AXI.
3. Criteria 14 to 16.
4. Criteria 18 and 19.
5. Criteria 20 to 23.
6. Criterion 24, docs, release preparation.
