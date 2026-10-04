# Specification and Plan: Site Adoption UX

Status: Draft for review. Nothing is implemented yet.

Target: `apps/site` (homepage, registry, blog, telemetry, guide, docs quickstart), `scripts/sync-registry.js`, generated `apps/site/src/infrastructure/content/registry/skills.js`.

## 1. Intent

Make reactive-skills.com convince developers and people running heavy agent workflows to adopt Reactive Skills where it fits.
A first-time visitor must learn what it is for, see real workflows, and find a first command within one screen.
The registry and blog must stop feeling cramped.
The telemetry dashboard joins the primary nav.

## 2. Findings (live site review, 2026-10-03, 1440px and ~500px widths)

1. Homepage explains the runtime mechanism before the use case. No registry workflow appears on the homepage.
2. Hero command `axi state incremental-implementation` inspects a skill the visitor has not installed. It truncates at both widths.
3. Bottom CTA and quickstart are author-first (`init`). The adopter path (`npx skills add`) appears only on `/guide` and `/registry`.
4. Unsupported claims: "~78% Context Window Saved", "0% Self-Policing Drift", "State machines are guarantees", registry "100% Guard Deterministic". They contradict `/guide` ("It does not make a model correct.") and open issues #22 and #23.
5. `/guide` already carries the clearer story (three ways to start, one failing run, boundaries).
6. Registry cards spend about 40% of their height on two truncated commands repeated on all 20 cards. The catalog starts about 860px down on desktop and 1230px on mobile.
7. Registry names come from naive slug title-casing: "Jsm Workflow", "Ci Cd Automation", "Api Contract", "Pep8 Review", "Pr Triage", "Tdd Refactor".
8. Blog index shows 11 topic chips for 2 posts. Part 2 is listed before Part 1. The series banner does not link anywhere.
9. Bug: post footer "Previous Article" on Part 1 links to Part 2, because `apps/site/src/app/blog/[slug]/page.js:66` indexes into newest-first order.
10. Post pages stack category, title, subtitle, a bordered author row with tags, and a series box before the first paragraph. At 1440px the article sits left with a dead gap of about 340px before the table of contents.
11. Quickstart headings run 1 to 5, then "2. Connect MCP for host-integrated workflows".
12. `/telemetry` auto-connects to `http://127.0.0.1:4242` on load. Every visitor without a broker sees "Connection error" and "Local Network access was blocked". The broker is started by `axi dashboard`, whose help already says to enter the printed URL.
13. UI copy contains em dashes.

## 3. Decisions (confirmed with Brandon, 2026-10-03)

1. Homepage audience: people to convince to adopt Reactive Skills where appropriate, developers and heavy-workflow users.
2. Replace the unsupported stats with measured numbers computed at build time from registry skill sources, with a methodology footnote.
3. Telemetry: link it in header, mobile menu, and footer. Keep `noindex`. Connect only on click, with a friendly empty state.
4. Merge `/guide` into the homepage. Remove Guide from nav. `/guide` becomes a static redirect to `/`.
5. The measured percentage is "instructions delivered per step", not context saved.
   The runtime returns one rendered state template per step (`packages/runtime/src/core/fsm-engine.ts:526`) and never re-sends `SKILL.md`.
   The host loads `SKILL.md` once when the skill starts, and earlier steps stay in the conversation, so the footnote discloses both.
   Measured 2026-10-03 across 20 skills and 266 state files: per-step delivery median 7.2%; `SKILL.md` plus one step median 30.1%; `SKILL.md` alone median 19.8%.

## 4. Requirements

1. Hero states what the product does for the visitor, offers a "Use a skill" and a "Build a skill" command, and links to the registry first.
2. Homepage shows four real registry workflows with links, a passive versus reactive comparison, one failing run, three ways to start, and honest boundaries.
3. Homepage and registry stats are computed from `skills.js`; no hand-typed percentages remain.
4. Median step share = median over skills of (mean state file bytes / (SKILL.md bytes + sum of state file bytes)), counting bytes after normalizing CRLF to LF and including state files in subfolders.
   Copy labels it as instructions delivered per step, and the footnote states that `SKILL.md` loads once at start and earlier steps stay in the conversation.
5. If no skill carries instruction measurements, the measured stat is hidden instead of rendering a wrong value.
6. Registry display names use acronym-aware formatting, with `display_name` in `skill.yaml` taking precedence.
7. Registry cards show category, version, name, description, state count, one copy button, and a details link. Catalog controls appear in the first desktop viewport.
8. Blog prev/next follow publication order. Topic chips appear only from 8 posts. The series banner links to Part 1. Post content starts higher and the article plus table of contents are centered.
9. Numbered doc headings run 1..n on every docs page.
10. `/telemetry` sends no network request until the visitor connects.
11. No changed page scrolls horizontally at 390px wide.
12. `/guide` and `/guide/` land on the homepage on root and basePath builds.

## 5. Out of scope (follow-ups to propose separately)

1. Registry category taxonomy ("General" holds 11 of 20 skills). Lives in `skill.yaml` files in `Reactive-Skills/skills`.
2. An adopter-first step in the quickstart.
3. `NEXT_PUBLIC_SITE_URL` still points to `https://reactive-skills.github.io` in both deploy workflows.
4. Blog body text contrast inside shared `DocSections`.

---

# Site Adoption UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn reactive-skills.com into an adoption page with measured claims, a roomier registry and blog, a telemetry nav link, and `/guide` merged into the homepage.

**Architecture:** The registry generator gains display names and instruction byte measurements; pure functions in `apps/site/src/lib/` compute stats, use cases, and blog adjacency and carry the unit tests. Landing sections move out of `GuidePage` into `features/landing`. Visual changes are verified in a real browser at 1440x900 and 390x844 against a static export.

**Tech Stack:** Next.js App Router static export (`output: 'export'`, `trailingSlash: true`), React 19, Tailwind 3 with `phino-*` tokens, Vitest 3, pnpm workspace with Nx, `chrome-devtools-axi` for browser checks.

**Spec:** Sections 1 to 5 above.

## Global Constraints

- Prefix every terminal command with `rtk`.
- No em dashes in any new or edited copy.
- No copy claims guarantees, zero drift, or percentages that are not computed.
- The measured share is always labeled "delivered per step" or "delivered at each step", never "context saved" or "in front of the agent".
- Never hand-edit `apps/site/src/infrastructure/content/registry/skills.js`; regenerate it with `rtk pnpm sync:registry`.
- Static export only: no server redirects, no `redirects()` config.
- Internal links use `next/link`; any raw URL must be relative so basePath builds keep working.
- Use existing `phino-*` design tokens; no new colors.
- No horizontal page scroll at 390px.
- Commit messages follow Conventional Commits and carry no co-author lines.
- Work on branch `feat/site-adoption-ux` in the main checkout (no worktree).
- Gate before finishing: `rtk pnpm exec nx run site:test`, `rtk pnpm exec nx run site:build`, `rtk pnpm test`.

## Review Focus

1. Committed `skills.js` lacks `instructionBytes` (the project-page deploy builds without running sync): the measured stat hides; it never shows `NaN%` or `0%`. Test in Task 1.
2. Instruction files checked out with CRLF on Windows and LF on Linux: the measured share is identical on both. Test in Task 1.
3. First visit to `/telemetry` with no broker running: no request to `127.0.0.1`, no "Connection error", no browser local-network prompt. Browser check in Task 2.
4. Same-date blog posts: prev/next order is deterministic. Test in Task 3.
5. A homepage use case slug disappears from the registry: the build fails with a message naming the slug instead of shipping a broken link. Test in Task 6.

## File Structure

| Path | Responsibility |
| :--- | :--- |
| `apps/site/vitest.config.mjs` (new) | Site unit test config with `@` alias |
| `apps/site/tests/*.test.js` (new) | Site unit tests |
| `apps/site/src/lib/registry/skillDisplayName.js` (new) | Slug to display name, no imports, shared with the generator |
| `apps/site/src/lib/registry/byteLength.js` (new) | CRLF-normalized UTF-8 byte length, shared with the generator |
| `apps/site/src/lib/registry/registryStats.js` (new) | Registry stats and percent formatting |
| `apps/site/src/lib/blog/adjacentPosts.js` (new) | Chronological prev/next |
| `apps/site/src/lib/landing/resolveUseCases.js` (new) | Join landing use cases with registry data |
| `apps/site/src/infrastructure/content/landing/useCases.js` (new) | Homepage use case copy |
| `scripts/sync-registry.js` | Emits `name` and `instructionBytes` |
| `apps/site/src/contracts/RegistryContentSource.js`, `apps/site/src/infrastructure/InMemoryRegistryContentSource.js` | `getStats()` |
| `apps/site/src/components/site/SiteHeader.jsx`, `SiteFooter.jsx` | Nav links |
| `apps/site/src/features/telemetry/MultiJobTelemetryDashboard.jsx` | Click-to-connect and idle state |
| `apps/site/src/app/blog/[slug]/page.js`, `features/blog/*` | Blog fixes and layout |
| `apps/site/src/infrastructure/content/docs/quickstart.js` | Heading numbering |
| `apps/site/src/app/registry/page.js`, `features/registry/SkillCard.jsx`, `components/common/CopyButton.jsx` | Registry layout |
| `apps/site/src/app/page.js`, `features/landing/*` | Homepage |
| `apps/site/src/app/guide/page.js`, `app/sitemap.js` | Redirect and sitemap |
| `context/progress-tracker.md` | Progress row |

---

### Task 1: Site test harness, registry display names, instruction measurements, stats

**Files:**
- Create: `apps/site/vitest.config.mjs`, `apps/site/src/lib/registry/skillDisplayName.js`, `apps/site/src/lib/registry/byteLength.js`, `apps/site/src/lib/registry/registryStats.js`
- Create: `apps/site/tests/skillDisplayName.test.js`, `apps/site/tests/byteLength.test.js`, `apps/site/tests/registryStats.test.js`
- Modify: `apps/site/package.json`, `apps/site/project.json`, `package.json`, `pnpm-lock.yaml`
- Modify: `scripts/sync-registry.js`, `apps/site/src/contracts/RegistryContentSource.js`, `apps/site/src/infrastructure/InMemoryRegistryContentSource.js`
- Regenerate: `apps/site/src/infrastructure/content/registry/skills.js`
- Add: `docs/specs/0013-site-adoption-ux.md`

**Interfaces:**
- Produces: `skillDisplayName(slug: string): string`
- Produces: `normalizedByteLength(text: string): number`
- Produces: `computeRegistryStats(skills: Array<{ stateCount?: number, instructionBytes?: { skillDocBytes: number, stateBytes: number[] } }>): { skillCount: number, stateCount: number, measuredSkillCount: number, medianStepShare: number | null }`
- Produces: `formatStepShare(share: number): string` returning for example `"~8%"`
- Produces: `IRegistryContentSource#getStats()` returning the `computeRegistryStats` result
- Produces: each generated skill gains `instructionBytes: { skillDocBytes: number, stateBytes: number[] }`

- [ ] **Step 1: Create the branch and add the spec**

```bash
rtk git switch -c feat/site-adoption-ux
rtk git add docs/specs/0013-site-adoption-ux.md
```

- [ ] **Step 2: Add the site test harness**

In `apps/site/package.json` add to `scripts`: `"test": "vitest run"`.
Add to `devDependencies`: `"vitest": "^3.0.4"`.

In `apps/site/project.json` add to `targets`:

```json
"test": {
  "executor": "nx:run-commands",
  "options": {
    "command": "pnpm test",
    "cwd": "{projectRoot}"
  }
}
```

In root `package.json` add to `scripts`: `"test:site": "pnpm --filter @reactive-skills/site test"`.

Create `apps/site/vitest.config.mjs`:

```js
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
```

Run: `rtk pnpm install`
Expected: lockfile updated, no errors.

- [ ] **Step 3: Write the failing tests**

`apps/site/tests/skillDisplayName.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { skillDisplayName } from '@/lib/registry/skillDisplayName';

describe('skillDisplayName', () => {
  it.each([
    ['jsm-workflow', 'JSM Workflow'],
    ['api-contract', 'API Contract'],
    ['ci-cd-automation', 'CI/CD Automation'],
    ['pep8-review', 'PEP 8 Review'],
    ['pr-triage', 'PR Triage'],
    ['tdd-refactor', 'TDD Refactor'],
    ['skill-manager', 'Skill Manager'],
    ['research-design-planner', 'Research Design Planner'],
  ])('formats %s as %s', (slug, expected) => {
    expect(skillDisplayName(slug)).toBe(expected);
  });

  it('ignores empty segments', () => {
    expect(skillDisplayName('pr--triage')).toBe('PR Triage');
  });
});
```

`apps/site/tests/byteLength.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { normalizedByteLength } from '@/lib/registry/byteLength';

describe('normalizedByteLength', () => {
  it('counts CRLF and LF text the same', () => {
    expect(normalizedByteLength('a\r\nb\r\n')).toBe(normalizedByteLength('a\nb\n'));
    expect(normalizedByteLength('a\nb\n')).toBe(4);
  });

  it('counts UTF-8 bytes, not characters', () => {
    expect(normalizedByteLength('✓')).toBe(3);
  });
});
```

`apps/site/tests/registryStats.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { computeRegistryStats, formatStepShare } from '@/lib/registry/registryStats';

const skill = (stateCount, instructionBytes) => ({ stateCount, instructionBytes });

describe('computeRegistryStats', () => {
  it('takes the median of one state versus SKILL.md plus all states', () => {
    const stats = computeRegistryStats([
      skill(2, { skillDocBytes: 100, stateBytes: [50, 50] }),
      skill(2, { skillDocBytes: 0, stateBytes: [10, 30] }),
      skill(1, { skillDocBytes: 200, stateBytes: [100] }),
    ]);
    expect(stats.skillCount).toBe(3);
    expect(stats.stateCount).toBe(5);
    expect(stats.measuredSkillCount).toBe(3);
    expect(stats.medianStepShare).toBeCloseTo(1 / 3, 5);
  });

  it('averages the middle pair for an even count', () => {
    const stats = computeRegistryStats([
      skill(2, { skillDocBytes: 100, stateBytes: [50, 50] }),
      skill(2, { skillDocBytes: 0, stateBytes: [10, 30] }),
      skill(1, { skillDocBytes: 200, stateBytes: [100] }),
      skill(4, { skillDocBytes: 0, stateBytes: [25, 25, 25, 25] }),
    ]);
    expect(stats.medianStepShare).toBeCloseTo((0.25 + 1 / 3) / 2, 5);
  });

  it('returns null when no skill carries measurements', () => {
    const stats = computeRegistryStats([skill(3, undefined), skill(2, { skillDocBytes: 10, stateBytes: [] })]);
    expect(stats.stateCount).toBe(5);
    expect(stats.measuredSkillCount).toBe(0);
    expect(stats.medianStepShare).toBeNull();
  });
});

describe('formatStepShare', () => {
  it('rounds to a whole percent', () => {
    expect(formatStepShare(0.079)).toBe('~8%');
  });

  it('never renders zero', () => {
    expect(formatStepShare(0.001)).toBe('~1%');
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `rtk pnpm exec nx run site:test`
Expected: FAIL, modules `@/lib/registry/*` not found.

- [ ] **Step 5: Implement the modules**

`apps/site/src/lib/registry/skillDisplayName.js` (no imports; the generator imports this file by relative path):

```js
const ACRONYMS = {
  api: 'API',
  axi: 'AXI',
  cd: 'CD',
  ci: 'CI',
  jsm: 'JSM',
  mcp: 'MCP',
  pr: 'PR',
  sdlc: 'SDLC',
  tdd: 'TDD',
  ui: 'UI',
  ux: 'UX',
};

const OVERRIDES = {
  'ci-cd-automation': 'CI/CD Automation',
  'pep8-review': 'PEP 8 Review',
};

export function skillDisplayName(slug) {
  if (OVERRIDES[slug]) return OVERRIDES[slug];
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => ACRONYMS[word] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

`apps/site/src/lib/registry/byteLength.js`:

```js
const encoder = new TextEncoder();

export function normalizedByteLength(text) {
  return encoder.encode(text.replace(/\r\n/g, '\n')).length;
}
```

`apps/site/src/lib/registry/registryStats.js`:

```js
function stepShare({ skillDocBytes, stateBytes }) {
  const stateTotal = stateBytes.reduce((sum, bytes) => sum + bytes, 0);
  const total = skillDocBytes + stateTotal;
  return total > 0 ? stateTotal / stateBytes.length / total : null;
}

function median(sortedValues) {
  const middle = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 1
    ? sortedValues[middle]
    : (sortedValues[middle - 1] + sortedValues[middle]) / 2;
}

export function computeRegistryStats(skills) {
  const shares = skills
    .map((skill) => skill.instructionBytes)
    .filter((bytes) => bytes && Array.isArray(bytes.stateBytes) && bytes.stateBytes.length > 0)
    .map(stepShare)
    .filter((share) => share !== null)
    .sort((a, b) => a - b);

  return {
    skillCount: skills.length,
    stateCount: skills.reduce((sum, skill) => sum + (skill.stateCount || 0), 0),
    measuredSkillCount: shares.length,
    medianStepShare: shares.length > 0 ? median(shares) : null,
  };
}

export function formatStepShare(share) {
  return `~${Math.max(1, Math.round(share * 100))}%`;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `rtk pnpm exec nx run site:test`
Expected: PASS, 3 files.

- [ ] **Step 7: Expose stats through the registry content boundary**

In `apps/site/src/contracts/RegistryContentSource.js` add after `getCategories()`:

```js
  /**
   * Aggregate registry stats computed from skill sources at build time.
   * @returns {{ skillCount: number, stateCount: number, measuredSkillCount: number, medianStepShare: number|null }}
   */
  getStats() {
    throw new Error('IRegistryContentSource.getStats must be implemented');
  }
```

In `apps/site/src/infrastructure/InMemoryRegistryContentSource.js` add the import and method:

```js
import { computeRegistryStats } from '@/lib/registry/registryStats';
```

```js
  getStats() {
    return computeRegistryStats(this._skills);
  }
```

- [ ] **Step 8: Teach the generator names and measurements**

In `scripts/sync-registry.js` add imports after the `js-yaml` import:

```js
import { skillDisplayName } from '../apps/site/src/lib/registry/skillDisplayName.js';
import { normalizedByteLength } from '../apps/site/src/lib/registry/byteLength.js';
```

Add before `export function syncSkills()`:

```js
function measureInstructionBytes(dir) {
  const fileBytes = (filePath) => normalizedByteLength(fs.readFileSync(filePath, 'utf8'));
  const statesDir = path.join(dir, 'states');
  const stateBytes = fs.existsSync(statesDir)
    ? fs.readdirSync(statesDir, { recursive: true })
        .map(String)
        .filter((entry) => entry.endsWith('.md'))
        .sort()
        .map((entry) => fileBytes(path.join(statesDir, entry)))
    : [];
  const skillDocPath = path.join(dir, 'SKILL.md');
  const skillDocBytes = fs.existsSync(skillDocPath) ? fileBytes(skillDocPath) : 0;
  return { skillDocBytes, stateBytes };
}
```

In the `skills.push({ ... })` object replace the `name:` line with:

```js
        name: doc.display_name ? String(doc.display_name) : skillDisplayName(doc.name),
```

and add after `deliverables: ...`:

```js
        instructionBytes: measureInstructionBytes(dir),
```

- [ ] **Step 9: Regenerate the registry from an up-to-date skills checkout**

```bash
rtk git -C ../skills status -sb
rtk git -C ../skills pull --ff-only
rtk pnpm sync:registry
```

Expected: `../skills` is on `main` with a clean tree before the pull; the generator logs `Successfully wrote 20 skills`.
If `../skills` is dirty or not on `main`, stop and ask Brandon.

Verify: `rtk grep -c '"instructionBytes"' apps/site/src/infrastructure/content/registry/skills.js` prints `20`, and `rtk grep -n '"name": "CI/CD Automation"' apps/site/src/infrastructure/content/registry/skills.js` matches.

- [ ] **Step 10: Run tests and build**

Run: `rtk pnpm exec nx run site:test` then `rtk pnpm exec nx run site:build`
Expected: PASS and a successful static export.

- [ ] **Step 11: Commit**

```bash
rtk git add docs/specs/0013-site-adoption-ux.md apps/site/package.json apps/site/project.json apps/site/vitest.config.mjs apps/site/tests apps/site/src/lib/registry apps/site/src/contracts/RegistryContentSource.js apps/site/src/infrastructure/InMemoryRegistryContentSource.js apps/site/src/infrastructure/content/registry/skills.js scripts/sync-registry.js package.json pnpm-lock.yaml
rtk git commit -m "feat(site): measure registry instructions and format skill display names"
```

---

### Task 2: Telemetry in nav, connect on click

**Files:**
- Modify: `apps/site/src/components/site/SiteHeader.jsx:12-17`
- Modify: `apps/site/src/components/site/SiteFooter.jsx:31-40`
- Modify: `apps/site/src/features/telemetry/MultiJobTelemetryDashboard.jsx`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: header `NAV` contains `{ title: 'Telemetry', href: '/telemetry' }`; Task 7 edits the same array.

- [ ] **Step 1: Reproduce the bug in a real browser**

Build and serve the static export (keep the server running for later tasks):

```bash
rtk pnpm exec nx run site:build
rtk npx -y serve apps/site/out -l 3002
```

Run the server in the background, then:

```bash
rtk chrome-devtools-axi resize 1440 900
rtk chrome-devtools-axi open http://localhost:3002/telemetry/
rtk chrome-devtools-axi network
```

Expected (bug): a request to `http://127.0.0.1:4242/catalog` and the text "Connection error" in the snapshot.

- [ ] **Step 2: Add the nav links**

`SiteHeader.jsx` `NAV`:

```js
const NAV = [
  { title: 'Guide', href: '/guide' },
  { title: 'Docs', href: '/docs' },
  { title: 'Registry', href: '/registry' },
  { title: 'Blog', href: '/blog' },
  { title: 'Telemetry', href: '/telemetry' },
];
```

`SiteFooter.jsx`: add after the Changelog link:

```jsx
          <Link href="/telemetry" className="text-phino-text-muted transition-colors hover:text-phino-text">Telemetry</Link>
```

- [ ] **Step 3: Stop auto-connecting**

In `MultiJobTelemetryDashboard.jsx`:

Replace `const [brokerUrl, setBrokerUrl] = useState(DEFAULT_BROKER_URL);` with:

```js
  const [brokerUrl, setBrokerUrl] = useState('');
```

Replace `const [catalogStatus, setCatalogStatus] = useState('loading');` with:

```js
  const [catalogStatus, setCatalogStatus] = useState('idle');
```

Replace the mount effect:

```js
  useEffect(() => {
    if (brokerUrl) loadCatalog();
  }, [brokerUrl]);
```

In the state-loading effect replace `if (trackedTargets.length > 0) loadStates();` with:

```js
    if (brokerUrl && trackedTargets.length > 0) loadStates();
```

In the SSE effect replace `if (trackedTargets.length === 0) return undefined;` with:

```js
    if (!brokerUrl || trackedTargets.length === 0) return undefined;
```

Replace the `statusLabel` line with:

```js
  const statusLabel = {
    idle: 'Not connected',
    loading: 'Connecting',
    ready: 'Broker connected',
    error: 'Connection error',
  }[catalogStatus];
```

On the Refresh button add `disabled={!brokerUrl}` and append `disabled:cursor-not-allowed disabled:opacity-40` to its `className`.

In the status indicator replace the `WifiOff` icon expression with:

```jsx
            {catalogStatus === 'ready'
              ? <CheckCircle2 className="h-4 w-4 text-phino-success" aria-hidden="true" />
              : <WifiOff className={cn('h-4 w-4', catalogStatus === 'idle' ? 'text-phino-text-subtle' : 'text-phino-warning')} aria-hidden="true" />}
```

Add before `{catalogStatus === 'loading' && !catalog && (`:

```jsx
      {catalogStatus === 'idle' && (
        <div className="rounded-2xl border border-dashed border-phino-border bg-phino-surface p-8 sm:p-10" role="status">
          <p className="text-sm font-semibold text-phino-text">Start a local broker to see live runs</p>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-phino-text-muted">
            <li>1. In your workspace, run <code className="rounded bg-phino-code-bg px-1.5 py-0.5 font-mono text-xs text-phino-code-text">npx -y @reactive-skills/axi dashboard</code>.</li>
            <li>2. Paste the printed <code className="font-mono text-xs">url</code> above and select Connect broker.</li>
            <li>3. If your browser asks to allow local network access, allow it for this site.</li>
          </ol>
          <p className="mt-3 text-xs text-phino-text-subtle">The broker is read-only. Nothing leaves your machine.</p>
        </div>
      )}
```

- [ ] **Step 4: Verify in the browser**

```bash
rtk pnpm exec nx run site:build
rtk chrome-devtools-axi open http://localhost:3002/telemetry/
rtk chrome-devtools-axi network
rtk chrome-devtools-axi snapshot
```

Expected: no request to `127.0.0.1`; snapshot shows "Not connected" and "Start a local broker to see live runs"; header shows Telemetry with `aria-current="page"`.
Repeat at 390x844 (`rtk chrome-devtools-axi emulate --help` for the viewport flag) and confirm the mobile menu lists Telemetry.
Optional with a broker: run `rtk npx -y @reactive-skills/axi dashboard` in a workspace with `.reactive/skills`, paste the URL, connect, and confirm "Broker connected".

- [ ] **Step 5: Commit**

```bash
rtk git add apps/site/src/components/site/SiteHeader.jsx apps/site/src/components/site/SiteFooter.jsx apps/site/src/features/telemetry/MultiJobTelemetryDashboard.jsx
rtk git commit -m "feat(site): add telemetry to nav and connect to broker on request"
```

---

### Task 3: Blog order, filters, and post layout

**Files:**
- Create: `apps/site/src/lib/blog/adjacentPosts.js`, `apps/site/tests/adjacentPosts.test.js`
- Modify: `apps/site/src/app/blog/[slug]/page.js:64-69`
- Modify: `apps/site/src/features/blog/BlogIndexView.jsx`, `BlogPostView.jsx`, `SeriesBanner.jsx`

**Interfaces:**
- Produces: `getAdjacentPosts(posts: Array<{ slug: string, publishedAt: string }>, slug: string): { prevPost: object|null, nextPost: object|null }` where `prevPost` is older and `nextPost` is newer.

- [ ] **Step 1: Write the failing test**

`apps/site/tests/adjacentPosts.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { getAdjacentPosts } from '@/lib/blog/adjacentPosts';

const newestFirst = [
  { slug: 'part-2', publishedAt: '2026-03-22' },
  { slug: 'part-1', publishedAt: '2026-03-20' },
];

describe('getAdjacentPosts', () => {
  it('treats older posts as previous and newer posts as next', () => {
    expect(getAdjacentPosts(newestFirst, 'part-1')).toEqual({ prevPost: null, nextPost: newestFirst[0] });
    expect(getAdjacentPosts(newestFirst, 'part-2')).toEqual({ prevPost: newestFirst[1], nextPost: null });
  });

  it('orders same-date posts by slug', () => {
    const sameDay = [
      { slug: 'b', publishedAt: '2026-04-01' },
      { slug: 'a', publishedAt: '2026-04-01' },
    ];
    expect(getAdjacentPosts(sameDay, 'a').nextPost.slug).toBe('b');
    expect(getAdjacentPosts(sameDay, 'b').prevPost.slug).toBe('a');
  });

  it('returns nulls for an unknown slug', () => {
    expect(getAdjacentPosts(newestFirst, 'missing')).toEqual({ prevPost: null, nextPost: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk pnpm exec nx run site:test`
Expected: FAIL, module `@/lib/blog/adjacentPosts` not found.

- [ ] **Step 3: Implement**

`apps/site/src/lib/blog/adjacentPosts.js`:

```js
function byPublicationOrder(a, b) {
  if (a.publishedAt !== b.publishedAt) return a.publishedAt < b.publishedAt ? -1 : 1;
  return a.slug.localeCompare(b.slug);
}

export function getAdjacentPosts(posts, slug) {
  const chronological = [...posts].sort(byPublicationOrder);
  const index = chronological.findIndex((post) => post.slug === slug);
  if (index === -1) return { prevPost: null, nextPost: null };
  return {
    prevPost: chronological[index - 1] ?? null,
    nextPost: chronological[index + 1] ?? null,
  };
}
```

`apps/site/src/app/blog/[slug]/page.js`: add `import { getAdjacentPosts } from '@/lib/blog/adjacentPosts';` and replace lines 64-67 with:

```js
  const { prevPost, nextPost } = getAdjacentPosts(content.listPosts(), slug);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk pnpm exec nx run site:test`
Expected: PASS.

- [ ] **Step 5: Blog index: hide chips below 8 posts, link the series**

In `BlogIndexView.jsx`:

Add `import Link from 'next/link';` and `ArrowRight` to the lucide import.
Add above the component:

```js
const MIN_POSTS_FOR_TOPIC_FILTER = 8;
```

Inside the component after `featuredPost`:

```js
  const seriesStart = posts.find((post) => post.series?.part === 1) || null;
  const showTopicFilter = posts.length >= MIN_POSTS_FOR_TOPIC_FILTER && tags?.length > 0;
```

Replace the description paragraph text with:

```jsx
          How Reactive Skills works under the hood: state machines for agent workflows, evidence checks, and event-sourced run history.
```

Replace the series banner `<div className="mt-10 ...">...</div>` with:

```jsx
      {seriesStart && (
        <Link
          href={`/blog/${seriesStart.slug}`}
          className="group mt-8 flex items-center justify-between gap-4 rounded-xl border border-phino-signal/40 bg-phino-surface-raised p-5 transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-phino-signal/40 bg-phino-signal/15 text-phino-signal-text">
              <Layers className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-phino-signal-text">
                {seriesStart.series.total}-part series
              </span>
              <h2 className="font-display text-lg font-semibold text-phino-text">{seriesStart.series.title}</h2>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-phino-signal-text">
            Start with Part 1 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </Link>
      )}
```

Change the chip block condition from `{tags && tags.length > 0 && (` to `{showTopicFilter && (`.
Remove the now unused `Sparkles` import.

- [ ] **Step 6: Post page: compact header, centered layout, tags at the end**

In `BlogPostView.jsx` replace everything from `<div className="container py-10 sm:py-14">` through the closing `</div>` of the author snippet (current lines 9-76) with:

```jsx
    <div className="container py-10 sm:py-14">
      <div className="xl:grid xl:grid-cols-[minmax(0,48rem)_240px] xl:justify-center xl:gap-16">
        <article className="mx-auto min-w-0 max-w-3xl xl:mx-0">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-phino-text-muted transition-colors hover:text-phino-text"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Blog</span>
          </Link>

          <h1 className="mt-6 font-display text-3xl font-semibold leading-tight tracking-tight text-phino-text sm:text-4xl lg:text-5xl">
            {post.title}
          </h1>

          {post.subtitle && (
            <p className="mt-3 text-lg font-medium text-phino-text-muted sm:text-xl">{post.subtitle}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-phino-text-subtle">
            <span className="font-medium text-phino-text">{post.author.name}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-mono">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {post.publishedAt}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-mono">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {post.readTime}
            </span>
            <span aria-hidden="true">·</span>
            <span>{post.category}</span>
          </div>
```

Keep the series banner, summary lead, and body that follow.
Before the post footer `<hr className="my-12 border-phino-border" />` insert:

```jsx
          {post.tags.length > 0 && (
            <ul className="mt-12 flex flex-wrap gap-2" aria-label="Topics">
              {post.tags.map((tag) => (
                <li key={tag} className="rounded border border-phino-border/60 bg-phino-surface-raised px-2 py-0.5 font-mono text-[11px] text-phino-text-subtle">
                  #{tag}
                </li>
              ))}
            </ul>
          )}
```

Remove `Share2` and `Bookmark` from the lucide import if unused.
The replacement keeps the same nesting (container, grid, article), so the existing table of contents column and closing tags stay as they are.

In `SeriesBanner.jsx` change the outer `className` from `my-6 rounded-lg border border-phino-border-strong bg-phino-surface-raised p-4 sm:p-5` to `mt-6 rounded-lg border border-phino-border bg-phino-surface-raised px-4 py-3`, and change `mt-3` on the links row to `mt-2`.

- [ ] **Step 7: Verify in the browser**

```bash
rtk pnpm exec nx run site:build
```

At 1440x900 and 390x844 open `http://localhost:3002/blog/` and `http://localhost:3002/blog/introducing-reactive-skills/`.
Expected: no topic chips; series card links to Part 1; on Part 1 the footer shows only "Next Article" pointing to Part 2; on Part 2 only "Previous Article" pointing to Part 1; the first paragraph starts within the first 900px viewport at 1440; article and table of contents are centered; `rtk chrome-devtools-axi eval "document.documentElement.scrollWidth <= window.innerWidth"` returns `true` at 390.
Save screenshots to the session scratchpad.

- [ ] **Step 8: Commit**

```bash
rtk git add apps/site/src/lib/blog apps/site/tests/adjacentPosts.test.js "apps/site/src/app/blog/[slug]/page.js" apps/site/src/features/blog
rtk git commit -m "fix(site): order blog prev and next by publication date and tighten blog layout"
```

---

### Task 4: Docs heading numbering

**Files:**
- Create: `apps/site/tests/docsHeadings.test.js`
- Modify: `apps/site/src/infrastructure/content/docs/quickstart.js:61`

**Interfaces:**
- Consumes: `docPageList` from `@/infrastructure/content/docs` (array of pages with `slug` and `sections[].heading`).

- [ ] **Step 1: Write the failing test**

Confirm the page shape first: `rtk sed -n 1,30p apps/site/src/infrastructure/content/docs/quickstart.js` shows `sections: [{ heading: ... }]`.

`apps/site/tests/docsHeadings.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { docPageList } from '@/infrastructure/content/docs';

const numberedHeadings = (page) =>
  (page.sections || [])
    .map((section) => section.heading?.match(/^(\d+)\.\s/))
    .filter(Boolean)
    .map((match) => Number(match[1]));

describe('docs numbered headings', () => {
  it.each(docPageList.map((page) => [page.slug, page]))('%s numbers steps 1..n', (_slug, page) => {
    const numbers = numberedHeadings(page);
    expect(numbers).toEqual(numbers.map((_, index) => index + 1));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk pnpm exec nx run site:test`
Expected: FAIL on `quickstart` with `[1, 2, 3, 4, 5, 2]`.

- [ ] **Step 3: Fix the heading**

In `quickstart.js` change `heading: '2. Connect MCP for host-integrated workflows'` to:

```js
      heading: 'Optional: connect MCP for host-integrated workflows',
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk pnpm exec nx run site:test` then `rtk pnpm test`
Expected: PASS, including the runtime prose gate that scans site docs content.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/site/tests/docsHeadings.test.js apps/site/src/infrastructure/content/docs/quickstart.js
rtk git commit -m "fix(docs): number quickstart steps in order"
```

---

### Task 5: Registry layout

**Files:**
- Modify: `apps/site/src/app/registry/page.js`
- Modify: `apps/site/src/features/registry/SkillCard.jsx`
- Modify: `apps/site/src/components/common/CopyButton.jsx`

**Interfaces:**
- Consumes: `getRegistryContentSource().getStats()` and `formatStepShare` from Task 1.
- Produces: `CopyButton` accepts optional `ariaLabel: string`.

- [ ] **Step 1: Capture the before state**

At 1440x900 and 390x844 screenshot `http://localhost:3002/registry/` and record the y position of the search input: `rtk chrome-devtools-axi eval "document.querySelector('input[type=search]').getBoundingClientRect().top"`.
Expected (before): about 880 at 1440.

- [ ] **Step 2: Give CopyButton an accessible name override**

In `CopyButton.jsx` change the signature to `export function CopyButton({ value, label = 'Copy', ariaLabel, className, size = 'md' })` and the attribute to:

```jsx
      aria-label={status === 'copied' ? 'Copied to clipboard' : (ariaLabel ?? label)}
```

- [ ] **Step 3: Slim the card**

Replace `SkillCard.jsx` with:

```jsx
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Workflow } from 'lucide-react';
import { CopyButton } from '@/components/common/CopyButton';

export function SkillCard({ skill }) {
  const installCmd = `npx skills add Reactive-Skills/skills --skill ${skill.slug}`;

  return (
    <article className="group relative flex h-full flex-col rounded-xl border border-phino-border bg-phino-surface p-5 transition-colors duration-150 hover:border-phino-border-strong hover:bg-phino-surface-raised">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate rounded-md border border-phino-border bg-phino-canvas px-2 py-0.5 text-xs font-medium text-phino-text-muted">
          {skill.category}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs tabular-nums text-phino-text-muted">
          v{skill.version}
          {skill.strictExecution && (
            <ShieldCheck className="h-3.5 w-3.5 text-phino-signal-text" aria-label="Strict execution" />
          )}
        </span>
      </div>

      <h3 className="mt-3 font-display text-lg font-semibold text-phino-text transition-colors group-hover:text-phino-signal-text">
        <Link
          href={`/registry/${skill.slug}`}
          className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phino-surface"
        >
          <span className="absolute inset-0 rounded-xl" aria-hidden="true" />
          {skill.name}
        </Link>
      </h3>

      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-phino-text-muted">{skill.description}</p>

      <div className="relative z-10 mt-4 flex items-center justify-between gap-2 border-t border-phino-border pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-phino-text-muted">
          <Workflow className="h-3.5 w-3.5 text-phino-signal" aria-hidden="true" />
          <span className="font-mono font-medium tabular-nums">{skill.stateCount}</span> states
        </span>
        <div className="flex items-center gap-3">
          <CopyButton
            value={installCmd}
            label="Install"
            ariaLabel={`Copy install command for ${skill.name}`}
            size="sm"
            className="h-7 px-2 text-xs"
          />
          <span
            className="pointer-events-none inline-flex select-none items-center gap-1 text-xs font-semibold text-phino-text transition-colors group-hover:text-phino-signal-text"
            aria-hidden="true"
          >
            Details <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Compact the page header and use measured stats**

In `apps/site/src/app/registry/page.js`:

Replace the lucide import with `import { ExternalLink, GitPullRequest, ArrowRight } from 'lucide-react';`, remove the `CopyButton` import, and add `import { formatStepShare } from '@/lib/registry/registryStats';`.

Change `metadata.description` to `'Published reactive workflows for coding agents from Reactive-Skills/skills, ready to install with skills.sh.'`.

In `RegistryPage` replace `const totalStates = ...` with `const stats = registrySource.getStats();` and replace the returned JSX with:

```jsx
    <div className="container py-10 sm:py-12">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-end lg:gap-10">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-bold tracking-tight text-phino-text sm:text-4xl">Skill Registry</h1>
          <p className="mt-3 text-base leading-relaxed text-phino-text-muted">
            Published workflows from{' '}
            <a
              href="https://github.com/Reactive-Skills/skills"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm font-semibold text-phino-text underline decoration-phino-signal underline-offset-4 hover:text-phino-signal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
            >
              Reactive-Skills/skills
            </a>
            . Install one with skills.sh, then invoke it from your agent.
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-phino-text-muted">
            <li><strong className="font-mono font-semibold tabular-nums text-phino-text">{stats.skillCount}</strong> skills</li>
            <li><strong className="font-mono font-semibold tabular-nums text-phino-text">{stats.stateCount}</strong> explicit states</li>
            {stats.medianStepShare !== null && (
              <li title={`Median across ${stats.measuredSkillCount} skills: one state file versus SKILL.md plus every state file, in bytes. SKILL.md loads once when the skill starts, and earlier steps stay in the conversation.`}>
                <strong className="font-mono font-semibold tabular-nums text-phino-text">{formatStepShare(stats.medianStepShare)}</strong> of a skill&apos;s instructions delivered per step
              </li>
            )}
          </ul>
        </div>

        <div className="min-w-0">
          <CommandBlock command="npx skills add Reactive-Skills/skills" caption="install every skill" />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <a
              href="https://github.com/Reactive-Skills/skills"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-phino-text-muted hover:text-phino-text"
            >
              <GithubIcon className="h-4 w-4" aria-hidden="true" /> Source <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <a
              href="https://github.com/Reactive-Skills/skills/blob/main/CONTRIBUTING.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-phino-text-muted hover:text-phino-text"
            >
              <GitPullRequest className="h-4 w-4 text-phino-signal" aria-hidden="true" /> Contribute
            </a>
            <Link href="/registry/skill-manager" className="inline-flex items-center gap-1 font-medium text-phino-signal-text hover:text-phino-text">
              Building your own? Start with Skill Manager <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <SkillCatalog initialSkills={skills} categories={categories} />
      </div>
    </div>
```

- [ ] **Step 5: Verify in the browser**

Rebuild, then at 1440x900 and 390x844 reload `/registry/`.
Expected: search input top below 600 at 1440; card names read "JSM Workflow", "CI/CD Automation", "PEP 8 Review"; no truncated commands on cards; "Install" copies `npx skills add Reactive-Skills/skills --skill <slug>` (check the toast); no horizontal scroll at 390; no "100% Guard Deterministic".
Open one card's Details and confirm the detail page still renders install commands.

- [ ] **Step 6: Commit**

```bash
rtk git add apps/site/src/app/registry/page.js apps/site/src/features/registry/SkillCard.jsx apps/site/src/components/common/CopyButton.jsx
rtk git commit -m "feat(site): compact registry header and slim skill cards"
```

---

### Task 6: Homepage for adopters

**Files:**
- Create: `apps/site/src/infrastructure/content/landing/useCases.js`, `apps/site/src/lib/landing/resolveUseCases.js`
- Create: `apps/site/src/features/landing/HeroCommandTabs.jsx`, `HeroStats.jsx`, `RuntimeWorkbench.jsx`, `UseCases.jsx`, `StartPaths.jsx`, `Boundaries.jsx`
- Move: `apps/site/src/features/guide/GuideRunDemo.jsx` to `apps/site/src/features/landing/RunDemo.jsx`
- Modify: `apps/site/src/app/page.js`, `features/landing/Hero.jsx`, `LandingPage.jsx`, `QuickstartCta.jsx`, `SkillComparison.jsx`
- Delete: `apps/site/src/features/landing/EventFlowDiagram.jsx`, `ValueAreas.jsx`, `AgentHosts.jsx`
- Create: `apps/site/tests/resolveUseCases.test.js`, `apps/site/tests/noEmDash.test.js`

**Interfaces:**
- Consumes: `getStats()`, `formatStepShare` (Task 1), `listSkills()` entries with `slug`, `name`, `stateCount`.
- Produces: `resolveUseCases(entries: Array<{ slug, job, outcome }>, skills: Array<{ slug, name, stateCount }>): Array<{ slug, job, outcome, name, stateCount }>`, throwing `Error('Landing use case "<slug>" is not in the skill registry')` for a missing slug.
- Produces: `LandingPage({ stats, useCases })`, `Hero({ stats })`, `HeroStats({ stats })`, `UseCases({ items })`, `RunDemo()`, `StartPaths()`, `Boundaries()`, `RuntimeWorkbench()`, `HeroCommandTabs()`.

- [ ] **Step 1: Write the failing tests**

`apps/site/tests/resolveUseCases.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { resolveUseCases } from '@/lib/landing/resolveUseCases';
import { landingUseCases } from '@/infrastructure/content/landing/useCases';
import { registrySkills } from '@/infrastructure/content/registry/skills';

const skills = [{ slug: 'tdd-refactor', name: 'TDD Refactor', stateCount: 11 }];

describe('resolveUseCases', () => {
  it('joins copy with registry name and state count', () => {
    expect(resolveUseCases([{ slug: 'tdd-refactor', job: 'Refactoring', outcome: 'Text.' }], skills)).toEqual([
      { slug: 'tdd-refactor', job: 'Refactoring', outcome: 'Text.', name: 'TDD Refactor', stateCount: 11 },
    ]);
  });

  it('fails loudly when a slug is missing', () => {
    expect(() => resolveUseCases([{ slug: 'missing', job: 'J', outcome: 'O' }], skills)).toThrow(
      'Landing use case "missing" is not in the skill registry',
    );
  });

  it('resolves every homepage use case against the generated registry', () => {
    expect(resolveUseCases(landingUseCases, registrySkills)).toHaveLength(landingUseCases.length);
  });
});
```

`apps/site/tests/noEmDash.test.js`:

```js
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCANNED = [
  'src/app/page.js',
  'src/app/registry',
  'src/components/site',
  'src/features/blog',
  'src/features/landing',
  'src/features/registry',
  'src/features/telemetry',
  'src/infrastructure/content/landing',
];

const listFiles = (target) =>
  statSync(target).isFile() ? [target] : readdirSync(target).flatMap((name) => listFiles(join(target, name)));

describe('site UI copy', () => {
  it('contains no em dashes', () => {
    const offenders = SCANNED.flatMap(listFiles)
      .filter((file) => /\.(js|jsx|mjs)$/.test(file))
      .filter((file) => readFileSync(file, 'utf8').includes(String.fromCharCode(0x2014)))
      .map((file) => relative(process.cwd(), file));
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk pnpm exec nx run site:test`
Expected: FAIL; `resolveUseCases` and `useCases` modules missing; em dash test lists the current offenders (expected to include `src/features/landing/LandingPage.jsx`).

- [ ] **Step 3: Implement use case data and resolver**

`apps/site/src/infrastructure/content/landing/useCases.js`:

```js
export const landingUseCases = [
  {
    slug: 'tdd-refactor',
    job: 'Refactoring',
    outcome: 'Red, green, and refactor run as separate states, and test results decide when each phase is done.',
  },
  {
    slug: 'pr-triage',
    job: 'Code review',
    outcome: 'Collects PR metadata, classifies risk and ownership, checks readiness, then stops for a human decision.',
  },
  {
    slug: 'release-notes',
    job: 'Releases',
    outcome: 'Scopes changes, classifies entries, drafts notes, validates formatting, and waits for approval.',
  },
  {
    slug: 'security-scan',
    job: 'Security',
    outcome: 'Scans staged changes for secrets and credentials, then hands back a remediation checklist.',
  },
];
```

`apps/site/src/lib/landing/resolveUseCases.js`:

```js
export function resolveUseCases(entries, skills) {
  const bySlug = new Map(skills.map((skill) => [skill.slug, skill]));
  return entries.map((entry) => {
    const skill = bySlug.get(entry.slug);
    if (!skill) throw new Error(`Landing use case "${entry.slug}" is not in the skill registry`);
    return { ...entry, name: skill.name, stateCount: skill.stateCount };
  });
}
```

- [ ] **Step 4: Split the hero**

Create `apps/site/src/features/landing/RuntimeWorkbench.jsx`:
start with `'use client';`, the imports `useState`, `useCallback` from `react`, `Layers`, `ShieldCheck`, `Terminal`, `Check`, `Cpu`, `GitBranch`, `Activity`, `Clock`, `AlertCircle` from `lucide-react` (keep only those the moved JSX uses), and `cn` from `@/lib/utils`.
Declare `export function RuntimeWorkbench() {`, move current `Hero.jsx` lines 24-78 (workbench state, `states`, `logs`, `handleEmitSignal`, `handleGuardFailure`) into it, then `return (` the inner `<div className="overflow-hidden rounded-2xl ...">` block from current lines 209-503, then `);}`.
In the moved JSX make three edits:
1. Replace `<span>ACTIVE_SESSION</span>` with `<span>SIMULATED RUN</span>`.
2. Replace `{states[stateIndex].tokens} tokens &bull; 8.9k avoided` with `{states[stateIndex].tokens} tokens`.
3. Delete the footer row `<div className="mt-3 flex items-center justify-between text-[11px] ...">` containing "CLI Shell Latency" and "Token Overhead: 0".

Create `apps/site/src/features/landing/HeroCommandTabs.jsx`:

```jsx
'use client';

import { useState } from 'react';
import { CopyButton } from '@/components/common/CopyButton';
import { cn } from '@/lib/utils';

const MODES = [
  { id: 'use', label: 'Use a skill', caption: 'skills.sh', command: 'npx skills add Reactive-Skills/skills --skill tdd-refactor' },
  { id: 'build', label: 'Build a skill', caption: 'zero install', command: 'npx -y @reactive-skills/axi init my-workflow' },
];

export function HeroCommandTabs() {
  const [modeId, setModeId] = useState(MODES[0].id);
  const mode = MODES.find((entry) => entry.id === modeId) ?? MODES[0];

  return (
    <div className="max-w-xl rounded-xl border border-phino-border bg-phino-surface p-3 sm:p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Getting started command">
          {MODES.map((entry) => (
            <button
              key={entry.id}
              id={`hero-tab-${entry.id}`}
              type="button"
              role="tab"
              aria-selected={entry.id === mode.id}
              aria-controls="hero-command-panel"
              onClick={() => setModeId(entry.id)}
              className={cn(
                'rounded px-2.5 py-1 font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus',
                entry.id === mode.id
                  ? 'border border-phino-signal/40 bg-phino-signal-soft font-semibold text-phino-signal-text'
                  : 'text-phino-text-muted hover:text-phino-text',
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <span className="hidden font-mono text-[11px] uppercase tracking-wider text-phino-text-subtle sm:inline">{mode.caption}</span>
      </div>
      <div
        id="hero-command-panel"
        role="tabpanel"
        aria-labelledby={`hero-tab-${mode.id}`}
        className="flex flex-col gap-2 rounded-lg border border-phino-border-strong bg-phino-code-bg px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
      >
        <code className="min-w-0 font-mono text-xs text-phino-code-text [overflow-wrap:anywhere] sm:overflow-x-auto sm:whitespace-nowrap sm:text-sm sm:[overflow-wrap:normal]">
          <span className="mr-2 select-none text-phino-signal" aria-hidden="true">$</span>
          {mode.command}
        </code>
        <CopyButton
          value={mode.command}
          size="sm"
          className="self-end border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white sm:shrink-0 sm:self-auto"
        />
      </div>
    </div>
  );
}
```

Create `apps/site/src/features/landing/HeroStats.jsx`:

```jsx
import { cn } from '@/lib/utils';
import { formatStepShare } from '@/lib/registry/registryStats';

export function HeroStats({ stats }) {
  const items = [
    stats.medianStepShare !== null && {
      value: formatStepShare(stats.medianStepShare),
      label: "of a skill's instructions delivered at each step",
      tone: 'text-phino-signal-text',
    },
    {
      value: String(stats.stateCount),
      label: `explicit states across ${stats.skillCount} published workflows`,
      tone: 'text-phino-state-text',
    },
    {
      value: 'Every',
      label: 'transition and failed check lands in a replayable run history',
      tone: 'text-phino-guard-text',
    },
  ].filter(Boolean);

  return (
    <figure className="max-w-xl">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <li key={item.label} className="rounded-lg border border-phino-border bg-phino-surface-raised/80 p-3">
            <p className={cn('font-display text-2xl font-bold tracking-tight', item.tone)}>{item.value}</p>
            <p className="mt-0.5 text-xs font-medium leading-snug text-phino-text-subtle">{item.label}</p>
          </li>
        ))}
      </ul>
      {stats.medianStepShare !== null && (
        <figcaption className="mt-2 text-[11px] leading-relaxed text-phino-text-subtle">
          Median across {stats.measuredSkillCount} registry skills: one state file versus SKILL.md plus every state file, measured in bytes at build time. SKILL.md loads once when the skill starts, and earlier steps stay in the conversation.
        </figcaption>
      )}
    </figure>
  );
}
```

Replace `apps/site/src/features/landing/Hero.jsx` with:

```jsx
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HeroCommandTabs } from './HeroCommandTabs';
import { HeroStats } from './HeroStats';
import { RuntimeWorkbench } from './RuntimeWorkbench';

export function Hero({ stats }) {
  return (
    <section className="relative overflow-hidden border-b border-phino-border bg-phino-canvas">
      <div className="phino-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <div className="phino-radial pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="container relative py-12 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-8 xl:gap-12">
          <div className="min-w-0 space-y-6 lg:col-span-6 xl:col-span-7">
            <p className="inline-flex items-center gap-2.5 rounded-full border border-phino-signal/30 bg-phino-signal-soft/60 px-3.5 py-1 font-mono text-xs text-phino-signal-text">
              <span className="h-2 w-2 rounded-full bg-phino-signal" aria-hidden="true" />
              <span className="font-semibold uppercase tracking-wider">Workflows for coding agents</span>
            </p>

            <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-phino-text sm:text-5xl xl:text-6xl">
              Stop hoping your agent followed the playbook.{' '}
              <span className="bg-gradient-to-r from-phino-signal-text via-teal-300 to-emerald-300 bg-clip-text text-transparent">
                Make it prove each step.
              </span>
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-phino-text-muted sm:text-lg">
              Reactive Skills turns a long instruction file into a workflow your agent runs one step at a time. It sees only the current step, moves forward when a check passes, and leaves a run history you can inspect and resume.
            </p>

            <HeroCommandTabs />
            <HeroStats stats={stats} />

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/registry"
                className="inline-flex items-center gap-2 rounded-lg bg-phino-text px-5 py-2.5 text-sm font-semibold text-phino-canvas transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
              >
                Browse workflows <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/docs/quickstart"
                className="inline-flex items-center gap-1.5 rounded-lg border border-phino-border-strong bg-phino-surface-raised px-5 py-2.5 text-sm font-medium text-phino-text transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
              >
                Read the quickstart
              </Link>
            </div>
          </div>

          <div className="min-w-0 lg:col-span-6 xl:col-span-5">
            <RuntimeWorkbench />
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Move guide sections into landing components**

```bash
rtk git mv apps/site/src/features/guide/GuideRunDemo.jsx apps/site/src/features/landing/RunDemo.jsx
```

In `RunDemo.jsx` rename `export function GuideRunDemo()` to `export function RunDemo()`.

Create `apps/site/src/features/landing/StartPaths.jsx` by moving `PATHS` (with its icon imports `Layers3`, `Workflow`, `Terminal`) and `PathCard` verbatim from `GuidePage.jsx` lines 15-43 and 78-100, plus:

```jsx
export function StartPaths() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {PATHS.map((path) => <PathCard key={path.number} path={path} />)}
    </div>
  );
}
```

Imports needed: `Link` from `next/link`, `ArrowRight`, `Layers3`, `Terminal`, `Workflow` from `lucide-react`.

Create `apps/site/src/features/landing/Boundaries.jsx`:

```jsx
import { Check } from 'lucide-react';

const BOUNDARIES = [
  'It does not make a model correct. It makes progress explicit and inspectable.',
  'It does not replace tests, reviews, or human decisions.',
  'It does not require a state machine for a one-off question or short script.',
  'It does not hide failed guards. Rejections remain visible in the run history.',
];

export function Boundaries() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {BOUNDARIES.map((text) => (
        <div key={text} className="flex gap-3 rounded-xl border border-phino-border bg-phino-surface p-4">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-phino-signal" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-phino-text-muted">{text}</p>
        </div>
      ))}
    </div>
  );
}
```

Create `apps/site/src/features/landing/UseCases.jsx`:

```jsx
import Link from 'next/link';
import { ArrowRight, Workflow } from 'lucide-react';

export function UseCases({ items }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.slug}
          href={`/registry/${item.slug}`}
          className="group flex h-full flex-col rounded-2xl border border-phino-border bg-phino-surface p-5 transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
        >
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-phino-signal-text">{item.job}</span>
          <h3 className="mt-3 font-display text-lg font-semibold text-phino-text">{item.name}</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-phino-text-muted">{item.outcome}</p>
          <div className="mt-5 flex items-center justify-between text-xs text-phino-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Workflow className="h-3.5 w-3.5 text-phino-signal" aria-hidden="true" />
              <span className="font-mono tabular-nums">{item.stateCount}</span> states
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-phino-text group-hover:text-phino-signal-text">
              View <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Recompose the page**

Replace `apps/site/src/features/landing/LandingPage.jsx` with:

```jsx
import { SectionHeading } from '@/components/common/SectionHeading';
import { Hero } from './Hero';
import { UseCases } from './UseCases';
import { SkillComparison } from './SkillComparison';
import { RunDemo } from './RunDemo';
import { StartPaths } from './StartPaths';
import { Boundaries } from './Boundaries';
import { QuickstartCta } from './QuickstartCta';

const RUN_STEPS = [
  ['01', 'Mount', 'The agent receives only VERIFY instructions.'],
  ['02', 'Reject', 'A failed check blocks progress and preserves state.'],
  ['03', 'Resume', 'A passing result advances the workflow and records why.'],
];

export function LandingPage({ stats, useCases }) {
  return (
    <div>
      <Hero stats={stats} />

      <section className="container py-16 sm:py-20" aria-labelledby="use-cases-heading">
        <SectionHeading
          eyebrow="where it fits"
          title="Built for work that spans many steps"
          description="Published workflows you can install today. Each one runs as explicit states, so your agent works one step at a time and moves on when a check passes."
        />
        <h2 id="use-cases-heading" className="sr-only">Example workflows</h2>
        <div className="mt-8">
          <UseCases items={useCases} />
        </div>
      </section>

      <section className="border-y border-phino-border bg-phino-surface" aria-labelledby="passive-heading">
        <div className="container py-16 sm:py-20">
          <SectionHeading
            eyebrow="the shift"
            title="From a document the model reads to a workflow you can watch"
            description="A passive skill leaves the model to police itself. A reactive skill runs explicit states with evidence checks, scoped instructions, and an append-only event log."
          />
          <h2 id="passive-heading" className="sr-only">Passive versus reactive skills</h2>
          <div className="mt-8">
            <SkillComparison />
          </div>
        </div>
      </section>

      <section className="container py-16 sm:py-20" aria-labelledby="run-heading">
        <SectionHeading
          eyebrow="follow one run"
          title="The useful part appears when something fails"
          description="A passing demo proves little. A rejected check shows that the workflow can stop, keep its state, and continue from evidence."
        />
        <h2 id="run-heading" className="sr-only">Follow one run</h2>
        <div className="mt-8">
          <RunDemo />
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {RUN_STEPS.map(([number, title, text]) => (
              <div key={number} className="rounded-xl border border-phino-border bg-phino-surface p-4">
                <span className="font-mono text-xs font-semibold text-phino-signal-text">{number}</span>
                <p className="mt-3 font-display text-sm font-semibold text-phino-text">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-phino-text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-phino-border bg-phino-surface" aria-labelledby="paths-heading">
        <div className="container py-16 sm:py-20">
          <SectionHeading
            eyebrow="choose your path"
            title="Three ways to start"
            description="Use a published skill, author one for your team, or connect the runtime to your agent host."
          />
          <h2 id="paths-heading" className="sr-only">Three ways to start</h2>
          <div className="mt-8">
            <StartPaths />
          </div>
        </div>
      </section>

      <section className="container py-16 sm:py-20" aria-labelledby="boundaries-heading">
        <SectionHeading
          eyebrow="know the boundaries"
          title="Use it where state and evidence matter"
          description="Reactive Skills is not required for every prompt. It earns its place when a workflow spans multiple steps, tools, or sessions."
        />
        <h2 id="boundaries-heading" className="sr-only">Boundaries</h2>
        <div className="mt-8">
          <Boundaries />
        </div>
      </section>

      <section className="container pb-20">
        <QuickstartCta />
      </section>
    </div>
  );
}
```

Replace `QuickstartCta.jsx` heading, paragraph, command, and link with:

```jsx
        <h2 className="font-display text-2xl font-semibold tracking-tight text-phino-text sm:text-3xl">Try a published workflow</h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-phino-text-muted">
          Install the official skills, then invoke one by name in your agent. It starts in its first state and tells the agent what to do next.
        </p>
        <div className="mx-auto mt-6 max-w-xl text-left">
          <CommandBlock command="npx skills add Reactive-Skills/skills" caption="install every skill" />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/registry"
            className="inline-flex items-center gap-1.5 rounded-md bg-phino-text px-5 py-2.5 text-sm font-semibold text-phino-canvas transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phino-canvas"
          >
            Browse workflows <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/docs/quickstart"
            className="inline-flex items-center gap-1.5 rounded-md border border-phino-border-strong bg-phino-surface-raised px-5 py-2.5 text-sm font-medium text-phino-text transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
          >
            Read the quickstart
          </Link>
        </div>
```

Replace `apps/site/src/app/page.js` with:

```js
import { getRegistryContentSource } from '@/infrastructure/container';
import { landingUseCases } from '@/infrastructure/content/landing/useCases';
import { resolveUseCases } from '@/lib/landing/resolveUseCases';
import { LandingPage } from '@/features/landing/LandingPage';

export default function HomePage() {
  const registry = getRegistryContentSource();
  return (
    <LandingPage
      stats={registry.getStats()}
      useCases={resolveUseCases(landingUseCases, registry.listSkills())}
    />
  );
}
```

Delete the sections no longer rendered, after confirming no other importer:

```bash
rtk grep -rn "EventFlowDiagram\|ValueAreas\|AgentHosts" apps/site/src
rtk git rm apps/site/src/features/landing/EventFlowDiagram.jsx apps/site/src/features/landing/ValueAreas.jsx apps/site/src/features/landing/AgentHosts.jsx
```

Expected: the grep lists only the three files themselves before removal.

- [ ] **Step 7: Remove remaining em dashes**

Run: `rtk pnpm exec nx run site:test`
For each file the em dash test still lists, rewrite the sentence without an em dash (split the sentence or use a comma or colon).
Rerun until PASS.

- [ ] **Step 8: Verify in the browser**

Rebuild, then at 1440x900 and 390x844 open `http://localhost:3002/`.
Expected: hero shows the new headline, both command tabs switch and copy the right command, stats show the computed percent (about `~7%`, labeled "delivered at each step"), the state total from `skill.yaml` (about 279), and the footnote including the SKILL.md disclosure; no "~78%", "0%", or "100%" claims; the workbench says "SIMULATED RUN"; four use case cards link to their registry pages; section order is use cases, shift, run, paths, boundaries, CTA; command text wraps instead of truncating at 390; `document.documentElement.scrollWidth <= window.innerWidth` is `true` at 390.
Toggle light mode once and screenshot the hero to confirm contrast holds.

- [ ] **Step 9: Commit**

```bash
rtk git add -A apps/site/src/app/page.js apps/site/src/features/landing apps/site/src/features/guide apps/site/src/infrastructure/content/landing apps/site/src/lib/landing apps/site/tests/resolveUseCases.test.js apps/site/tests/noEmDash.test.js
rtk git commit -m "feat(site): rebuild homepage around adoption with measured stats"
```

---

### Task 7: Merge guide into homepage

**Files:**
- Modify: `apps/site/src/app/guide/page.js`, `apps/site/src/app/sitemap.js:20`, `apps/site/src/components/site/SiteHeader.jsx`
- Delete: `apps/site/src/features/guide/GuidePage.jsx`

**Interfaces:**
- Consumes: `NAV` from Task 2.

- [ ] **Step 1: Replace the guide route with a static redirect**

`apps/site/src/app/guide/page.js`:

```jsx
import Link from 'next/link';
import { absoluteUrl } from '@/infrastructure/siteMetadata';

export const metadata = {
  title: 'Guide moved to the homepage',
  robots: { index: false, follow: true },
  alternates: { canonical: absoluteUrl('/') },
};

export default function GuideRedirect() {
  return (
    <div className="container py-20 text-center">
      <meta httpEquiv="refresh" content="0; url=../" />
      <p className="text-phino-text-muted">
        The guide now lives on the{' '}
        <Link href="/" className="font-semibold text-phino-signal-text underline underline-offset-4">
          homepage
        </Link>
        .
      </p>
    </div>
  );
}
```

The relative `../` resolves from `/guide/` to the site root on both root and basePath builds.

- [ ] **Step 2: Remove Guide from nav and sitemap, delete the old page**

`SiteHeader.jsx` `NAV`:

```js
const NAV = [
  { title: 'Docs', href: '/docs' },
  { title: 'Registry', href: '/registry' },
  { title: 'Blog', href: '/blog' },
  { title: 'Telemetry', href: '/telemetry' },
];
```

`sitemap.js`: delete the `'/guide',` line.

```bash
rtk grep -rn "GuidePage\|features/guide" apps/site/src
rtk git rm apps/site/src/features/guide/GuidePage.jsx
```

Expected: the grep lists only `GuidePage.jsx` and no importer.

- [ ] **Step 3: Verify in the browser**

Rebuild, then open `http://localhost:3002/guide/` and `http://localhost:3002/guide`.
Expected: both end on `http://localhost:3002/` within one second; `rtk grep -c guide apps/site/out/sitemap.xml` prints `0`.
Check the basePath build too:

```bash
NEXT_PUBLIC_BASE_PATH=/reactive-skills rtk pnpm --filter @reactive-skills/site build
```

Serve `apps/site/out` under a `reactive-skills` folder (copy to the session scratchpad as `<scratch>/pages/reactive-skills`, then `rtk npx -y serve <scratch>/pages -l 3003`) and confirm `http://localhost:3003/reactive-skills/guide/` lands on `http://localhost:3003/reactive-skills/`.
Rebuild without the variable afterwards.

- [ ] **Step 4: Commit**

```bash
rtk git add -A apps/site/src/app/guide apps/site/src/app/sitemap.js apps/site/src/components/site/SiteHeader.jsx apps/site/src/features/guide
rtk git commit -m "feat(site): fold guide into homepage and redirect /guide"
```

---

### Task 8: Full verification and bookkeeping

**Files:**
- Modify: `context/progress-tracker.md`

- [ ] **Step 1: Run every gate**

```bash
rtk pnpm exec nx run site:test
rtk pnpm exec nx run site:build
rtk pnpm test
```

Expected: all PASS. Fix any failure before continuing, including ambient lint or flaky tests met along the way.

- [ ] **Step 2: Browser sweep**

Against the served static export, at 1440x900 and 390x844, screenshot `/`, `/registry/`, `/registry/tdd-refactor/`, `/blog/`, both blog posts, `/telemetry/`, `/docs/quickstart/`, and `/guide/` into the session scratchpad.
For each page: no horizontal scroll at 390, no console errors (`rtk chrome-devtools-axi console`), header nav reads Docs, Registry, Blog, Telemetry, footer lists Telemetry.
Fix any visual defect found, then rerun Step 1.

- [ ] **Step 3: Update the progress tracker**

Add to `context/progress-tracker.md` after the v0.6.x milestone table:

```markdown
---

## 🌐 Site

| Slice | Archetype | Status |
| :--- | :--- | :--- |
| Adoption homepage, measured registry stats, registry and blog layout, telemetry nav, guide merge (`docs/specs/0013-site-adoption-ux.md`) | Site | ✅ Done |
```

- [ ] **Step 4: Commit**

```bash
rtk git add context/progress-tracker.md
rtk git commit -m "docs(context): record site adoption UX slice"
```

---

### Task 9: Ship

- [ ] **Step 1: Push and open the PR**

```bash
rtk git push -u origin feat/site-adoption-ux
rtk gh-axi pr create --help
```

Create the PR against `main` with title `feat(site): adoption-focused homepage, roomier registry and blog, telemetry nav` and a body that summarizes Tasks 1 to 7, lists the verification evidence, and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 2: Wait for CI**

Watch the PR checks with `rtk gh-axi pr checks <number>` (or `rtk gh-axi run list`).
Expected: green. Fix failures on the branch and push again.

- [ ] **Step 3: Merge and deploy**

Merge with a merge commit, matching repo history.
Check the `Notify root Pages deployment` run on `main`.
If it reports the manual fallback, dispatch the root deploy: `rtk gh workflow run deploy.yml -R Reactive-Skills/Reactive-Skills.github.io -f source_ref=main`.
Wait for the deploy run to succeed.

- [ ] **Step 4: Verify the live site**

Repeat the Task 8 browser sweep against `https://reactive-skills.com`.
Expected: 20 registry skills with corrected names; measured stats present; `/guide/` lands on `/`; `/telemetry/` makes no loopback request on load.

- [ ] **Step 5: Clean up and record**

```bash
rtk git switch main
rtk git pull --ff-only
rtk git branch -d feat/site-adoption-ux
rtk git push origin --delete feat/site-adoption-ux
```

Stop the background `serve` processes and the `chrome-devtools-axi` session.
Delete the session scratchpad screenshots.
Capture a Cortex note with what shipped, the live verification result, and the Section 5 follow-ups.
