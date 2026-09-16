# AGENTS.md

> Operational guide for agents working within the Reactive Skills repository.

---

## System Overview

See `.agents/CONTEXT.md#system-overview`

---

## Build & Verification Commands

See `.agents/COMMANDS.md`

---

## Architecture Invariants

1. **State Independence:** Each state's prompt slice in `states/*.md` must be self-contained. Never assume context from prior states unless bound to `context_keys` or recorded in the event stream.
2. **Deterministic Guarding:** State transitions must specify explicit, testable guard expressions (`exit_code == 0`, schema checks) or custom functions under `guards/`. Never allow transitions on subjective completion claims.
3. **Event Sourcing:** See `.agents/references/event-sourcing.md`
4. **HSM Bubbling:** Unhandled events in leaf substates bubble up to ancestor states. Use ancestor transitions for global policies (e.g. `GLOBAL_ABORT`, `TIMEOUT`, `SECURITY_CRITICAL`).
5. **Read-Model Projections:** See `.agents/references/projections.md`
6. **Strict Runtime Execution:** See `.agents/references/runtime-execution.md`
7. **Lifecycle Management & Statecharts:** See `.agents/references/lifecycle-management.md`
8. **Release Ceremony:** See `.agents/references/release-ceremony.md`

---

## Integration Modes

See `.agents/references/integration-modes.md`

---

## Repository Map

See `.agents/references/repository-map.md`

---

## Nx Workspace

See `~/.agents/AGENTS.md#nx-workspace`