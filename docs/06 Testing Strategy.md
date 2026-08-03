Testing at three levels, plus the regression battery that anchors everything to real lecture math. Phase gates in [[05 Build Phases]] reference these suites.

Part of [[00 Overview and Doc Map]].

# Level 1 — Unit (vitest, Node, no Obsidian)

- **Catalog converter:** Formula Library JSON → `MathTemplate[]`; category mapping; alias generation; id collisions.
- **Ranking:** text-match beats recency beats frequency; favorites float; deterministic ordering for identical scores.
- **Template records:** every hand-authored template's `latex` parses in the engine and contains valid placeholder tokens; `wraps` flag matches presence of the selection token (a static lint test over the catalog).
- **Scanner:** given editor states as fixtures — inline math, block math, math inside blockquotes/callouts, `$` in code fences and inline code, escaped `\$`, currency strings — assert exactly the right ranges are found. (Runs against CM6 headless with Obsidian's markdown parser fixtures.)

# Level 2 — Engine round-trip (browser context: vitest + playwright, real `<math-field>`)

MathLive needs a real DOM; these run in a headless browser.

- **Round-trip suite:** for each battery expression (below): `setLatex` → `getLatex` with no edits must be byte-identical or whitelisted-cosmetic (whitelist is an explicit, reviewed fixture file — every entry is a documented decision).
- **Structural ops:** wrap-selection fraction; placeholder Tab order for each core template; matrix row/col add/remove serialization; bracket auto-height serialization (`\left(`…`\right)`).
- **Clipboard:** copy subtree → paste into placeholder → serialize → expected LaTeX.

# Level 3 — Integration (the `latex` vault, scripted + manual)

- **Scripted path (D22):** use Playwright for browser-context harness tests and local app/computer control for Obsidian GUI demos in the `latex` vault. Do not spend v1 time evaluating `obsidian-testing-framework` unless the chosen path is impossible after three distinct attempts.
- **Integration assertions:** open fixture note → activate equation → structural edit → deactivate → assert file bytes; undo collapses the session; Escape reverts; activate/deactivate-without-edit is byte-neutral; edits outside the active equation never trigger math rewrites; active inline math is visibly embedded in the paragraph; active display math is visibly embedded in the display block; no Obsidian modal or detached editor appears during primary editing.
- **Manual QA checklist per phase** (kept as a note in the vault): cursor-enter from both sides, click activation, boundary exits incl. depth-0 rule for Up/Down, palette open/close cleanliness (no `\query` leakage), IME input, split panes showing the same note, switching files mid-edit, Sync/iCloud external modification while a field is open.

GUI evidence follows D24. Screen recording is preferred. If recording is blocked, the accepted substitute is: screenshot sequence, timestamped keystroke transcript, and direct before/after file-byte diff from the fixture note.

# The regression battery

~40 expressions harvested from real notes (started in Spike A, grown forever after; lives in `tests/fixtures/battery/` as one `.tex` file per case with expected round-trip output):

- Kröger–Vink: `V_{\mathrm{O}}^{\bullet\bullet}`, charge superscripts, `2\,\mathrm{Ce}^{4+} + 2e^- \rightarrow 2\,\mathrm{Ce}^{3+}`
- Dudarev penalty sum with occupation-matrix traces (nested subscripts, `\mathrm{Tr}`)
- `aligned` multi-step derivations; `cases`; `pmatrix`/`bmatrix`/`vmatrix` up to 4×4
- Integrals with bounds, nested fractions in exponents, `\left...\right` three deep
- Font commands: `\mathbb`, `\mathcal`, `\mathbf`, `\mathrm` mixed in one expression
- Known-hostile: `\operatorname`, `\underbrace`, `\overset`, `\phantom` (documenting engine behavior even where the answer is "raw region")

**Rule:** every bug found in real use adds its expression to the battery before the fix lands.

# What is deliberately not tested

Pixel-perfect rendering (MathLive's responsibility; we test structure and bytes, not pixels). Obsidian mobile (out of v1 scope). Performance micro-benchmarks before Phase 5's targeted pass.
