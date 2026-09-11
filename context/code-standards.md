# Code Standards: Reactive Skills Architecture (RSA)

---

## 1. TypeScript & Language Conventions
- **Target:** ES2022 / NodeNext module resolution.
- **Strict Mode:** `"strict": true` with zero `any` leaks in public APIs.
- **Async/Await:** All I/O, guard evaluations, and signal dispatches are explicitly `Promise`-based.
- **Imports:** Explicit `.js` extension on relative imports (ESM standard: `import { FSMEngine } from './fsm-engine.js'`).

---

## 2. Schema Validation & Types
- Every manifest entity (`skill.yaml`, `StateDefinition`, `TransitionDefinition`, `DeliverableProjection`) must have a corresponding Zod schema in `src/core/types.ts`.
- Recursive schemas (e.g. `substates`) must be explicitly typed with `z.ZodType<T>` and `z.lazy()`.
- Validate manifests at load time; never allow unvalidated YAML into the execution runtime.

---

## 3. Error Handling & Invariant Enforcement
- **Missing State / Template:** Throw explicit errors detailing the exact missing path.
- **Guard Failures:** Guard errors must not crash the runtime; they should evaluate to `passed: false` and append a `GUARD_EVALUATED` event with the error detail to the `EventStore`.
- **Sandbox Evaluation:** JavaScript guard expressions must be evaluated in an isolated function wrapper (`"use strict"; try { return Boolean(...) } catch { return false }`).

---

## 4. File Organization & Naming Rules
- `src/core/`: Core runtime classes (`types.ts`, `fsm-engine.ts`, `event-store.ts`, `guard-evaluator.ts`, `projection-engine.ts`, `runtime-hooks.ts`, `legacy-adapter.ts`).
- `src/cli/`: CLI commands and utilities.
- `skills/<name>/`: Self-contained reactive skill packages.
- `tests/<name>.test.ts`: Paired Vitest test suites.

---

## 5. Testing & Verification Standards
- Every feature or bug fix must have a corresponding Vitest test in `tests/`.
- Test suites must verify:
  1. Initial state boot and initial context binding.
  2. Happy-path transition progression.
  3. Guard failure blocking.
  4. HSM event bubbling from child to ancestor.
  5. State lifecycle hooks (`on_enter`, `on_exit`).
  6. Deliverable projection file output.
- **Gate:** `npm test` and `npm run build` must pass before finishing any task.
