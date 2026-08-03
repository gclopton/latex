**STATUS: D01-D28 RATIFIED BY SAM — CLOSED FOR AUTONOMOUS BUILD EXECUTION.** Provenance: D01-D18 drafted by Claude, approved by Sam in chat (2026-08-03). D19 drafted by Claude from Sam's palette screenshots. D20-D25 drafted by Codex to close autonomy gaps; factual claims independently verified by Claude. D26 drafted by Codex after Sam clarified in-document editing is the core requirement. D27 does not exist (the ^/_ binding question was resolved as no-change; number retired). D28 drafted by Claude after the checkpoint-1 review, ratified by Sam 2026-08-03. Sam ratified the full set in the Claude session. NOTE TO ALL AGENTS: this file was clobbered once by a stale-copy rewrite — always re-read the current file immediately before editing it, and never regenerate it from memory.

# Editing feel

| # | Decision | Recommendation | Why | Sam's call |
|---|----------|----------------|-----|------------|
| D01 | Activation: how an equation becomes editable | Cursor-enter AND click, both on by default | Matches "never leave the keyboard" + mouse users lose nothing | |
| D02 | Commit mode default | Immediate (sync per change); deferred available as a setting | Live source updates; deferred is the fallback if perf disappoints | |
| D03 | Escape in an active field | Revert to activation-time value, deactivate | Proven semantics from studied plugin; gives a free "abort" | |
| D04 | Tab at the last slot of the outermost structure | Exit the equation to the right | Mathcha's own behavior (Features doc §2.1 note) | |
| D05 | Enter inside a matrix/cases/aligned | New row below | Mathcha/spreadsheet instinct; exit is what Tab-at-end is for | |
| D06 | Tab at the last matrix cell | Exit the structure (not add-row) | Keeps Tab meaning "forward"; Enter owns row creation (D05) | |
| D07 | Undo granularity after commit | One Obsidian history entry per activation session | Ctrl+Z in the note removes the whole equation edit, not one keystroke of it | |

# Entry points and shortcuts

| # | Decision | Recommendation | Why | Sam's call |
|---|----------|----------------|-----|------------|
| D08 | `$` in text mode | Immediately opens an empty active inline field | The Mathcha shortcut (§2.1); typing raw `$...$` remains possible via Escape | |
| D09 | Display math entry | Palette (`\math-container`) + an Obsidian command with assignable hotkey; no `$$` auto-trigger in v1 | `$$` auto-detection has messy edge cases; command is unambiguous | |
| D10 | `^` and `_` in math mode | Always active (insert script templates) | Mathcha §8; core speed shortcut | |
| D11 | Palette trigger | `\` inside math; in text mode `\` also opens the text-mode palette | Mirrors Mathcha exactly (§1.3); single muscle memory | |
| D12 | Inline large operators (∫, Σ) | Engine default (small, limits beside); display-style toggle deferred to v2 | Matches Mathcha's inline behavior (§2.1); avoids v1 UI | |

# Palette behavior

| # | Decision | Recommendation | Why | Sam's call |
|---|----------|----------------|-----|------------|
| D13 | Recents list length / frequency decay | 12 recents; frequency counters decay ~monthly | Adapts across semesters without a settings burden | |
| D14 | Structure settings UI (matrix rows/cols/brackets) | v1: context menu + palette commands (add row, to-bmatrix, …); floating gear widget deferred to v2 | Cuts significant UI work from v1; keyboard path unaffected | |

# Project and engine

| # | Decision | Recommendation | Why | Sam's call |
|---|----------|----------------|-----|------------|
| D15 | Engine assumption pending Spike A | MathLive; Spike A decision rule executes mechanically per its doc | The verified-API path; custom engine only on Spike A fail + Spike B pass | |
| D16 | Spike A "cosmetic diff" definition | Allowed: whitespace, brace normalization (`x^2`→`x^{2}`), `\left\right` insertion around paired delimiters. Destructive: any command substitution, dropped tokens, reordered arguments | Makes the pass rule pure counting — no judgment left to the agent | |
| D17 | Spike A pass threshold | ≥36/40 battery items edit naturally AND round-trip lossless-or-cosmetic; `cases` + basic 2-row `aligned` must be among the passes | Concrete, checkable, weights the known weak spot | |
| D18 | Plugin identity | id `structured-math`, name "Structured Math", repo `obsidian-structured-math`, `isDesktopOnly: true` for v1 | Mobile editing unproven (risk register); rename is cheap now, painful later | |

# Amendments

| # | Decision | Recommendation | Why | Status |
|---|----------|----------------|-----|--------|
| D19 | Shift+Enter in the palette inserts the expanded form of large-operator templates (limits above/below, full size — `\limits`/display variants); plain Enter inserts the inline form | Adopt for v1 | Mathcha's per-row ⇧ affordance (reference screenshots in [[03 Template System and Suggestion Box]]) is insertion-time and cheap; D12's *post-hoc* toggle on existing equations remains v2 | **APPROVED** |

# Autonomy gap closures

| # | Decision | Rule | Why | Status |
|---|----------|------|-----|--------|
| D20 | MathLive version for Spike A | Use `mathlive@0.110.0`, the latest npm version observed on 2026-08-03, as the Spike A candidate. Pin this exact version in `package.json`. Do not upgrade during v0.1 unless a decision note records the reason. | Removes the version-selection bootstrap gap. Latest stable is the conservative candidate because the project depends on current MathLive APIs. | **APPROVED** |
| D21 | Spike A outcome routing | Apply the decision rule mechanically. Pass -> MathLiveEngine. Conditional pass -> MathLiveEngine with multiline environments scoped to raw-region editing in v1; continue the build. Fail on single-line battery -> run Spike B. If Spike B is promising -> custom engine and replan only affected phase estimates. If Spike B is sobering -> hybrid MathLive-per-line multiline shell and continue after writing `docs/decisions/D21-engine-route.md`. Do not stop for Sam unless both spikes cannot run. | Prevents a conditional or failed spike from becoming a prompt-for-approval moment. | **APPROVED** |
| D22 | Integration test path | Use Playwright plus local app/computer control for Obsidian demos. Do not evaluate `obsidian-testing-framework` for v1 unless Playwright/computer-control is impossible after three distinct attempts. If it is impossible, document the failed attempts and use file-byte unit/integration tests plus manual GUI screenshots for the phase gate. | Removes "or if viable" ambiguity. | **APPROVED** |
| D23 | External reference pinning | Study these exact repo states unless unavailable: `MizarZh/mathlive-in-editor-mode@f47277fc1be0c0920a372bfb8cfcbd5e3b1e543a`, `strangelion/obsidian-formula-library@ed25a986bca72c742dd1d2dc3777b607f0f5c79a`, `danzilberdan/obsidian-mathlive@df125634f20443a68209e9b9bf9f83f0ed8f2da7`. Clone under `~/Projects/reference/` or inspect through GitHub, but record any local clone path in the phase report. | Prevents upstream drift from changing the map mid-build. | **APPROVED** |
| D24 | Demo evidence fallback | Preferred evidence is a screen recording saved under `docs/reports/`. If macOS permissions, app state, or tool limits block recording after two attempts, use a screenshot sequence plus a timestamped keystroke transcript plus before/after file-byte diff. This satisfies phase gates. | Keeps GUI evidence useful without making screen recording a blocking system-permission problem. | **APPROVED** |
| D25 | Repo and remote autonomy | Codex may create `/Users/gradyclopton/Projects/obsidian-structured-math`, initialize git, create commits/tags, and push to `git@github.com:gclopton/obsidian-structured-math.git` if the remote exists or can be created with available GitHub tooling. If remote creation/auth fails, continue all local implementation and record the push as a final packaging blocker, not a build blocker. | Prevents repository plumbing from stopping implementation. | **APPROVED** |
| D26 | Primary editing surface | Primary math editing must happen in place inside the Obsidian document editor. Active inline math occupies the inline equation's exact document position; active display math occupies the display block's document position. A detached modal/popup equation editor is prohibited for the v1 primary workflow. Floating UI is allowed only for contextual palettes, autocomplete, tooltips, context menus, structure settings, and the raw-LaTeX escape hatch. | Matches Sam's Mathcha screenshots and the actual speed requirement: the user must keep typing in the note, seeing and editing the equation where it belongs. A modal would recreate the Obsidian pain point instead of solving it. | **APPROVED** |

# Post-checkpoint amendments

| # | Decision | Rule | Why | Status |
|---|----------|------|-----|--------|
| D28 | Post-edit serialization policy | Engine-normalized LaTeX is accepted for equations the user actually edited. Hard invariants unchanged: activated-but-unedited equations remain byte-identical (BS-37); never-activated equations are never rewritten (BS-39). For classifying edited-equation output, the D16 cosmetic whitelist is extended with: whitespace changes; brace addition/removal around single-token arguments (`x^2` <-> `x^{2}`, `\tfrac{1}{2}` <-> `\tfrac12`); `'` <-> `^{\prime}`; `\mathrm` argument restructuring with identical rendering (`\mathrm{O_O}` <-> `\mathrm{O}_{O}`). Hard constraint: normalized output must be standard, compilable LaTeX — nonstandard emissions (e.g., `\middle{\|}`-style bracing of `\middle` delimiters) are DESTRUCTIVE and require a fixup table in the sync layer before any commit to the note. Doc 11's edit-naturally criterion is amended accordingly: the check is that the intended structural change occurred and every other difference falls within this whitelist. | The spike's honest serialization data (see plugin repo `docs/reports/phase-0-review.md`) shows MathLive re-normalizes whole edited equations; churn is a one-time cost per hand-written equation since new equations are born in engine style; the compilability clause protects Pandoc/LaTeX export paths. | **RATIFIED** |
