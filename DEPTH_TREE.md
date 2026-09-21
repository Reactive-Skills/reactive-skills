# Depth Tree: Reactive Skills Job Ergonomics & Lifecycle Fixes

- [ ] Slice 3: Job Lifecycle Ergonomics & Terminal Auto-Rotation (Spec: `docs/specs/job-lifecycle-and-terminal-rotation.md`)
  - [x] Leaf 1: Invert Bootloader Contract (`invoke` for new tasks, `state` for resuming). (Engine: `/implement-spec`, Gate: `gates/leaf-1-bootloader-contract.md`)
  - [x] Leaf 2: Implement Runtime Terminal Auto-Rotation on `state` / `reactive_state`. (Engine: `/tdd`, Gate: `gates/leaf-2-terminal-autorotation.md`)
  - [ ] Leaf 3: Implement Environment-Scoped Job Isolation (`REACTIVE_JOB_ID`). (Engine: `/tdd`, Gate: `gates/leaf-3-env-job-isolation.md`)
