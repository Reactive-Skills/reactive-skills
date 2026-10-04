# Security Policy

## Supported versions

Security fixes land in the latest release only.
This project is pre-1.0, so update to the newest version of each package to receive fixes.

| Package | Supported |
| --- | --- |
| `@reactive-skills/runtime` | Latest release |
| `@reactive-skills/axi` | Latest release |
| Older releases | Not supported |

## Reporting a vulnerability

Please do not report vulnerabilities in public issues, discussions, or pull requests.

Report them privately through GitHub: open the [Security tab](https://github.com/Reactive-Skills/reactive-skills/security) and choose **Report a vulnerability**.

Include what you can of the following:

- The affected package and version.
- What an attacker can do, and what they need first, such as a crafted skill, a malicious payload, or local access.
- Steps or a minimal skill that reproduces the issue.
- Any fix or mitigation you suggest.

## What to expect

This project is maintained on a best-effort basis, with no guaranteed response times.
Reports are acknowledged as soon as practical, and you will be kept informed through the private advisory as the fix progresses.
Once a fix is released, the advisory is published with credit to the reporter unless you ask to stay anonymous.

## Scope

In scope:

- The runtime (`@reactive-skills/runtime`): state machine execution, guard and judgment evaluation, the event store, context handling, and projections.
- The AXI CLI (`@reactive-skills/axi`) and its MCP integration.
- Skill sync and installation behavior.
- Ways a skill, a signal payload, or stored context can escape the runtime's intended limits.

Out of scope:

- Vulnerabilities in third-party skills themselves. Report those to the skill's author. For skills published in [Reactive-Skills/skills](https://github.com/Reactive-Skills/skills), see that repository's security policy.
- Issues that require an attacker who can already modify your local files or run code as your user.

## Known issues

These weaknesses are public and tracked openly:

- Guard code supplied by a skill, in `guardFunction` files and in inline `guard` expressions, currently runs with the full privileges of the runtime process. A malicious or compromised skill can read files and environment variables, start processes, and make network calls. The fix is tracked in [#34](https://github.com/Reactive-Skills/reactive-skills/issues/34).
- The runtime does not yet vet third-party skills before running their code. This is tracked in [#33](https://github.com/Reactive-Skills/reactive-skills/issues/33).

Until these are fixed, run only skills from sources you trust, and review each skill's `guards/` directory and inline `guard:` expressions before installing or updating it.
