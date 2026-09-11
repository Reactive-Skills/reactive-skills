# UI Context: Reactive Skills Visual Surfaces

---

## 1. Visual Review Surface (Lavish Editor)
When generating HTML review surfaces for Reactive Skills (state charts, comparison tables, decision matrices), follow the **Lavish Editor Design Standard**:

- **Framework:** Tailwind CSS v4 Browser Runtime + DaisyUI v5 CDN
- **Theme Palette:** Dark Mode default (`data-theme="dark"` / `bg-base-300`, `bg-base-100` card surfaces)
- **Component Primitives:**
  - `navbar` with sticky top positioning and session indicators
  - `hero` banners with gradient text highlights (`bg-gradient-to-r from-primary via-secondary to-accent`)
  - `stats` widgets for metrics (Trigger Mode, State Count, Deliverable count)
  - `badge` soft color variants (`badge-soft badge-primary`, `badge-success`, `badge-warning`)
  - `mockup-code` for terminal sessions, YAML schemas, and event stream JSONL ledgers
  - `alert` boxes for confirmed decisions and architecture status

---

## 2. Interactive SVG & Statechart Visualization Standards
- **Vector Graphics:** Hand-authored inline SVG using `viewBox="0 0 W H"` and `width="100%"` (responsive).
- **Color Adapters:** Use `currentColor`, semantic gradients, and theme tokens so SVG elements adapt dynamically between light and dark modes.
- **Node Semantics:** Add `<title>` and semantic class names (`.svg-node`) with subtle CSS hover filters (`filter: brightness(1.15)`) for interactive inspection.
- **Markers:** Standard SVG directional arrow markers for state transitions.

---

## 3. CLI & Terminal Output Standards
- **Icons & Status:**
  - ⚡ `RSA Header & Brand`
  - 🪝 `Interceptor Hooks`
  - 🔄 `State Transitions`
  - 📜 `Event Store Logs`
  - 📁 `Deliverables & Projections`
  - ✅ `Success / Verification Pass`
  - ❌ `Guard Trip / Failure`
- **Formatting:** Monospace tabular layout with clean padding for event sequences, timestamps, and causal metadata.

---

## 4. Markdown Deliverables Styling
Deliverables projected from Handlebars templates (`.docs/*.md`) must follow GitHub-flavored Markdown:
- Clean frontmatter or title banner.
- Structured Markdown tables for state transition timelines.
- Fenced code blocks with language identifiers (`json`, `yaml`, `bash`).
