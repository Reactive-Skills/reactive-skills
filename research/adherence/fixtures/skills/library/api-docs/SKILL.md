---
name: api-docs
description: Update the public API reference when a function signature or documented behaviour changes.
---

# api-docs

Use this when an exported function is added, removed or renamed, or its documented contract changes.

## Steps

1. Compare the exported functions in `src/` with `docs/API.md`.
2. Update `docs/API.md` so each exported function has one accurate line.
3. Keep examples short and runnable.
