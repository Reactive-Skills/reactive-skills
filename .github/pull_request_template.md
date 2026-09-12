## 📋 Description

<!-- Provide a brief description of the changes introduced by this pull request. -->

## 🔗 Related Issues

<!-- Fixes #123, Closes #456, or References #789 -->

## 🛠️ Type of Change

- [ ] 🐛 Bug fix (non-breaking change fixing an issue)
- [ ] ✨ New feature (non-breaking change adding functionality)
- [ ] 💥 Breaking change (fix or feature causing existing functionality to break)
- [ ] 📝 Documentation update
- [ ] 🎨 Code style / formatting / refactoring
- [ ] 🧪 Test suite enhancement

## 📐 Architecture Invariants Verification

- [ ] **State Independence:** Each state slice in `states/*.md` remains self-contained.
- [ ] **Deterministic Guarding:** Transitions specify explicit, testable guard expressions or functions.
- [ ] **Event Sourcing First:** Execution history is strictly append-only; no event mutation.
- [ ] **Read-Model Projections:** Read models/deliverables are rendered via Handlebars templates in `templates/*.hbs` (never manually generated).

## 🧪 Pre-Merge Verification Checklist

- [ ] `pnpm install` succeeds cleanly.
- [ ] `pnpm run build` compiles without TypeScript errors.
- [ ] `pnpm test` passes 100% of runtime tests.
- [ ] `pnpm test:axi` passes 100% of AXI CLI tests.
- [ ] Code follows existing conventions and no machine paths (`C:\...`, `/home/...`) or secrets are committed.
