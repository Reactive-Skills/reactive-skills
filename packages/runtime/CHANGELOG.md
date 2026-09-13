
## [0.3.0] - 2026-09-13

- feat(core): implement job management, isolated run storage, dual-write projections, and AXI jobs suite (c76c6cb)
- chore: release v0.2.0 (bb33cfc)
- feat: add real-time telemetry server, AXI view command, and live visual telemetry deck (46b4b95)
- refactor(apps): rename apps/reactive-skills-axi to apps/axi to eliminate path stutter (7148b9a)
- copy(site): sharpen hero subhead and fix command block wrapping in quickstart CTA (b3ecf55)

## [0.2.0] - 2026-09-13

- feat: add real-time telemetry server, AXI view command, and live visual telemetry deck (46b4b95)
- refactor(apps): rename apps/reactive-skills-axi to apps/axi to eliminate path stutter (7148b9a)
- copy(site): sharpen hero subhead and fix command block wrapping in quickstart CTA (b3ecf55)
- feat(site): move Registry link to the end of primary navigation (6908b51)
- style(site): polish skill registry surfaces against craft floor standards (8e373f8)

# Changelog

## [2.0.2] - 2026-09-11

- fix(ci): link repository and use pnpm publish for GitHub Packages
- fix(ci): bypass corepack signature verification with corepack:false
- fix(ci): add registry-url and NODE_AUTH_TOKEN to publish workflow

## [2.0.1] - 2026-09-11

- fix(site): add missing TypeScript type packages for Next.js build (090a00e)
- fix(site): add js-yaml dependency for docs content source (b77573c)
- fix(ci): resolve command-not-found in NX targets by using package-scoped pnpm scripts (e933ec1)
- feat(strict-execution): add bypass detection as failure case with turn tracking and tool auditing (1c9677d)
- test: isolate events command tests from global skill installs (60bbeca)
