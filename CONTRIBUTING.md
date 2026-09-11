# Contributing to Reactive Skills

Thank you for your interest in contributing to the Reactive Skills Architecture!

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Reactive-Skills/reactive-skills.git
   cd reactive-skills
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Build packages:**
   ```bash
   pnpm run build
   ```

4. **Run test suites:**
   ```bash
   pnpm test
   pnpm test:axi
   ```

## Architecture Invariants

1. **State Independence:** Each state's prompt slice in `states/*.md` must be self-contained.
2. **Deterministic Guarding:** State transitions must specify explicit, testable guard expressions.
3. **Event Sourcing First:** All signals, guard checks, and state transitions must append to `EventStore`.
4. **Zero-Bypass Enforcement:** Agent execution must be driven by the state machine runtime.

## Submitting Pull Requests

1. Create a feature branch: `git checkout -b feat/your-feature`.
2. Commit following Conventional Commits (`feat: ...`, `fix: ...`, `docs: ...`).
3. Ensure `pnpm test` and `pnpm test:axi` pass.
4. Open a Pull Request on GitHub.

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.
