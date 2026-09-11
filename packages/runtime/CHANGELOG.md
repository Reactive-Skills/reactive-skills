
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
