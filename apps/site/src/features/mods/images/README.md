# Mods captures

These PNGs capture the actual bq-vitals status, `/flow` pane and `/flow-plan` command output, rendered in a framed HTML terminal at 2× resolution.
They share the site's dark code palette and a bundled DejaVu Sans Mono font, including its block, arrow and check glyphs.
The same images are used in both site themes.
The capture renders each duration bar as one solid CSS rectangle at the width of the original block-character run, avoiding font seams.
The live-map capture places the mod's state list beside its plan to use the frame's width; the intermediate text file preserves the original pane order and content.

`capture-input.json` contains the complete example inputs, neutral usage readings, deterministic clock intervals and public catalog revision.
`capture.mjs` reads the pinned `release-notes` manifest from `packages/runtime/tests/fixtures/public-catalog.json`, verifies its Git blob hash, and drives its real guarded transitions through `FSMEngine`.
It derives canonical chart edges from that manifest and passes the resulting real ledger to the unmodified `mods/bq-vitals/hooks/register.tsx` module.
`capture-host.mjs` implements the small host SDK surface needed to invoke those hooks and serialize their pane output, without reading a personal session or unrelated host UI.
No release is published and no model, remote skill action or personal usage API is called.
The example evidence and clock produce illustrative durations, not performance measurements.
The run stops at the existing human review gate.

From the repository root, with workspace dependencies installed:

```sh
pnpm nx run runtime:build
chrome-devtools-axi --help
CHROME_DEVTOOLS_AXI_SESSION=mods-capture node apps/site/src/features/mods/images/capture.mjs
```

The capture tool requires Node 22.13+, `chrome-devtools-axi` and its working headless Chrome connection.
It uses the workspace TypeScript compiler to load the actual mod and Next's existing Sharp dependency to optimize the PNGs.
It bundles the font in the temporary HTML, so rendering needs no external fonts or network requests.
The script selects an existing browser tab when available, then opens its local capture server.
Output PNGs replace the three files here; intermediate ledgers, text and raw captures stay in the printed temporary directory outside the repository.
Keep that directory as provenance when reviewing a regeneration.
Repeat runs with the same browser, compiler and Sharp versions should produce identical PNGs; different Chrome versions may change text antialiasing.

| Image | Pixels | View |
| --- | --- | --- |
| `status-line.png` | 1680 × 324 | Example usage and `release-notes ▸ VALIDATE` |
| `flow.png` | 1680 × 854 | Completed, current and unreached states beside the pane's plan |
| `flow-plan.png` | 1680 × 866 | Actual five-hop plan at `REVIEW`, with guards, durations and unused exits |

The page declares intrinsic image dimensions and descriptive alternative text.
Each preview links to its full-size PNG for inspection on narrow screens.
`apps/site/tests/modsScreenshots.test.js` guards the asset resolution and 250 kB per-image ceiling.
See `FONT-LICENSE.txt` for the bundled font's license.
