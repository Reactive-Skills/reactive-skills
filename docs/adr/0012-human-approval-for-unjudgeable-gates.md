# ADR 0012: Human Approval for Unjudgeable Gates

Status: Accepted.

Date: 2026-10-04.

## Context

ADR 0011 made a judgment unevaluable when no adapter can judge it during a model outage, and kept the payload heuristic, labeled self-reported, when no model is configured.
That left two gaps.
During an outage, nothing can move a run past a semantic gate until the model returns.
Without a model, the agent approves its own semantic gates.

An approval that arrives as an ordinary signal, through the CLI or MCP, is no stronger than self-report, because the agent sends those signals itself.
The same is true of any switch the agent can flip, such as an environment variable.
Within one OS account no channel is airtight, so the goal is a channel the agent cannot use in the normal course of work, with any bypass leaving a visible record.

## Decision

A judgment that no adapter can judge refuses the signal and records an `APPROVAL_REQUESTED` event with the state, signal, criterion, and payload.
This covers a model outage, rejected credentials, a judgment authoring error, and a natural-language criterion when no model is configured and self-report has not been granted.
The agent-facing reason tells the agent to stop and ask the user to run `reactive-skills-axi approve <skill> --job <id>` in their own terminal.

`reactive-skills-axi approve` refuses to run unless both standard input and standard output are an interactive terminal.
It shows each pending gate with its criterion and the agent's evidence, prints a one-time code drawn from a cryptographic random source, and asks the user to type it back.
A matching code approves the gate and typing `reject` rejects it; any other answer asks again, up to five times, and end of input cancels without deciding (amended 2026-10-04 after review).
The command records an `APPROVAL_DECIDED` event with the decision and the channel `interactive_terminal`, then re-sends the original signal with that event as its cause.

When the engine evaluates a judgment for a signal caused by an `APPROVAL_DECIDED` event, it validates that the decision names a pending request for the same state and signal and that no earlier signal consumed it.
A valid approval decides the judgment with `decidedBy: "human"` and band `accept`; a rejection decides it with band `reject`, which routes to `fallback_target` when declared.
An approval applies once.
MCP exposes no tool that approves a pending gate, and `reactive_respond_human` keeps its existing meaning for skill-declared human gates.

Self-reported decisions require a grant.
`reactive-skills-axi approve --allow-self-reported` uses the same terminal and code check and writes a workspace grant with its time and channel; `--revoke-self-reported` removes it without a code.
The grant lives in the user's home folder at `~/.reactive-skills/grants/`, keyed by the workspace path, and never in the workspace, so a file copied, committed, or restored into a workspace does not count and a revoke stays revoked. The first decision each grant allows in a run is recorded as `SELF_REPORT_GRANT_USED` (amended 2026-10-04 after review).
With a grant and no model configured, natural-language criteria are decided from the payload as in ADR 0011, and every such emit carries a warning.
The grant never applies during an outage of a configured model.

Every judgment result records who decided it: `model`, `expression`, `human`, or `self_reported`.

## Alternatives

- Approval as an ordinary signal with an audit note: rejected because the agent sends signals itself.
- Signed approvals with a passphrase-protected key: stronger, deferred as an opt-in hardening because of setup cost.
- Self-report opt-in through an environment variable or config file: rejected because the agent can change either silently.
- Keep self-report as the default without a model: rejected by the owner in favor of human approval as the default.

## Consequences

- Users without a model now approve semantic gates by hand in a terminal unless they grant self-report.
- Agents in harnesses whose shell tools are not interactive cannot approve gates themselves; the user runs `approve` in a separate terminal window.
- An agent that emulates a terminal, writes a grant into the user's home folder, or drives the runtime library directly can still bypass the channel; the ledger records the channel of every decision, and self-reported emits stay flagged.
- Some agent setups include tools that drive an interactive terminal session, such as an MCP server with process interaction tools. With those tools an agent can run `approve` and type the code without special effort, so the channel protects against accidental approval rather than a determined agent in such setups.
- Skills and tests that relied on self-reported passes without a model need a grant or a model.
- A grant applies only to processes that use the same home folder as the `approve` run that wrote it, so a runtime under another account, a container, or WSL does not see it.
- Unattended runs, such as CI, cloud sessions, and scheduled loops, have no terminal for a person, so a gate no model can judge stays refused there until someone runs `approve` on that machine; those runs need a working model.
- The runtime advertises the capability `judgment.human_approval`.
