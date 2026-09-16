# Release Ceremony

When cutting a release, the hero banner (`> 🚀 **What's New in vX.Y.Z:**`) across root `README.md`, `apps/axi/README.md`, and `packages/runtime/README.md` MUST be updated to highlight the release milestone.

This invariant is programmatically enforced by `scripts/check-docs.js` during `pnpm test`. Releases will fail CI if the banners do not match `package.json.version`.

## Release Steps

1. **Bump Version**: Run `npm run bump:patch` (or `bump:minor`/`bump:major`).
2. **Update README Banners**: Update the `> 🚀 **What's New in vX.Y.Z:**` callouts in `README.md`, `apps/axi/README.md`, and `packages/runtime/README.md`.
3. **Verify Documentation Invariants**: Run `pnpm test` (executes Vitest + `check:docs` + `check:prose`).
4. **Commit & Tag**:
   ```bash
   git commit -am "chore(release): vX.Y.Z - <headline>"
   git tag -a vX.Y.Z -m "vX.Y.Z - <headline>"
   git push origin main
   git push origin vX.Y.Z
   ```
5. **Automated CI/CD**: Pushing tag `v*` triggers `.github/workflows/publish.yml` to build, test, and publish packages to npm and create the GitHub Release.