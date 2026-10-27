# Site component contract

<!-- EGM:START -->

## Purpose and scope

`@reactive-skills/site` is the Next.js marketing, documentation, registry, blog, mods, and telemetry presentation application.
It is a private workspace package rather than the runtime SDK or CLI.
This document describes selected boundaries observed on 2026-10-26.

## Source map and interfaces

| Source | Responsibility |
| --- | --- |
| [src/app/layout.js](src/app/layout.js), [src/app/page.js](src/app/page.js) | Application shell and landing route |
| [src/app/docs/page.js](src/app/docs/page.js) | Documentation entry route |
| [src/app/registry/page.js](src/app/registry/page.js) | Registry catalog route |
| [src/app/blog/page.js](src/app/blog/page.js), [src/app/mods/page.js](src/app/mods/page.js) | Blog and mods entry routes |
| [src/app/telemetry/page.js](src/app/telemetry/page.js) | Workspace telemetry dashboard route |
| [src/contracts/RegistryContentSource.js](src/contracts/RegistryContentSource.js) | Registry content contract |
| [src/contracts/DocsContentSource.js](src/contracts/DocsContentSource.js), [src/contracts/BlogContentSource.js](src/contracts/BlogContentSource.js), [src/contracts/ModsContentSource.js](src/contracts/ModsContentSource.js) | Other content contracts |
| [src/infrastructure/container.js](src/infrastructure/container.js) | Composition boundary registering concrete content providers |
| [src/infrastructure/InMemoryRegistryContentSource.js](src/infrastructure/InMemoryRegistryContentSource.js) | Registry filtering, lookup, categories, and statistics |
| [src/features/telemetry/LiveTelemetryDeck.jsx](src/features/telemetry/LiveTelemetryDeck.jsx) | Individual bridge connection and signal interaction |
| [src/features/telemetry/MultiJobTelemetryDashboard.jsx](src/features/telemetry/MultiJobTelemetryDashboard.jsx) | Broker catalog and multiple selected jobs |

Route components obtain content through container facades.
The container selects the concrete in-memory providers; the registry contract exposes `listSkills`, `getSkill`, `getCategories`, and `getStats`.
Presentation changes should preserve these boundaries and the public route structure.

## Build and content contracts

[next.config.mjs](next.config.mjs) selects static export, unoptimized images, and trailing slashes.
`NEXT_PUBLIC_ROOT_SITE`, `NEXT_PUBLIC_BASE_PATH`, `GITHUB_PAGES`, and `CI` influence the configured base path.
A static export does not provide a hosted runtime ledger or server-side signal executor.
Browser telemetry connects separately to a local runtime bridge or broker.
The inspected telemetry clients default to `http://127.0.0.1:4242` and report local-network access failures.
Individual bridge connections fetch `/state` and subscribe to `/events` through SSE.
Live runtime access therefore depends on the user's service and browser permissions.

The repository's [sync-registry.js](../../scripts/sync-registry.js) produces registry content from the skills source.
[sync-changelog.js](../../scripts/sync-changelog.js) derives site release content from the runtime changelog.
Do not hand-edit those generated outputs during documentation maintenance.
Root `build:site` runs those synchronization scripts before the site build; the package `build` script runs `next build` directly.
Choose the command based on whether content regeneration is authorized.

## Browser side effects

Telemetry connections make local HTTP and SSE requests; signal actions can affect the selected runtime run.
The root layout mounts [Analytics.jsx](src/components/site/Analytics.jsx), which loads the configured Umami script with do-not-track support.
Analytics policy and configuration belong to [docs/analytics.md](../../docs/analytics.md).
Rendering static pages and connecting to a runtime are separate capabilities.
This bootstrap neither changes browser behavior nor verifies responsive rendering or live telemetry connectivity.

## Verification and maintenance

Run from repository root:

```powershell
rtk pnpm nx run site:test
rtk pnpm nx run site:lint
rtk pnpm nx run site:build
```

[project.json](project.json) maps these targets to package scripts; development uses port 3001.
Package equivalents use `rtk pnpm --filter @reactive-skills/site test`, `lint`, or `build` if Nx cannot initialize.
The [bootstrap report](../../.egm/01a177dd-db6c-702e-bc67-95e98f0e3eb3/bootstrap-report.md) distinguishes executed checks from documented commands.
Future UI changes also require browser review of routes, responsive layouts, accessibility states, and exported assets.

<!-- EGM:END -->
