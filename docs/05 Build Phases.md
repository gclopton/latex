Ordered build with acceptance criteria per phase. Each phase ends usable — no phase depends on a later one to be worth shipping to the vault. Timeline notes assume AI-assisted evenings; they are planning aids, not promises.

Part of [[00 Overview and Doc Map]].

# Continuation rule

The agent should not stop after each phase for approval. If a phase gate passes, commit, tag, write the report, and start the next phase. If a phase gate fails, write `docs/reports/phase-N-blocker.md`, keep working on any same-phase tasks not dependent on the failure, and do not enter Phase N+1 until the gate is green or a documented D21/D24 fallback applies. Conditional Spike A is not a blocker; D21 defines the route.

# Phase 0 — Spikes (≈1 week)

Run [[04 Spikes and Risks]] Spike A (and B if warranted). **Exit:** engine decision recorded at the top of [[02 Architecture]] with the battery results committed to the repo as the first regression fixtures. D20 chooses the Spike A MathLive candidate; D21 chooses the post-spike route.

# Phase 1 — Scaffold + engine-agnostic core (≈1 week)

- Repo `obsidian-structured-math` from the sample-plugin template (TypeScript, esbuild, vitest); dev build copies into the `latex` vault's `.obsidian/plugins/`.
- `EditorEngine` interface; `MathLiveEngine` implementation passing a smoke test in a plain page.
- Template record type, catalog converter for the Formula Library JSONs, hand-authored core structural templates ([[03 Template System and Suggestion Box]]).
- Palette component (search, ranking, recents, keyboard navigation) rendered standalone (storybook-style test page), not yet wired to Obsidian.

**Acceptance:** unit tests green for converter + ranking; palette navigable entirely by keyboard in the test page; engine smoke test inserts a fraction wrapping a selection and Tab reaches the denominator.

# Phase 2 — In-place editing MVP (≈1–2 weeks; the hard phase)

- Syntax-tree scanner; active-range `StateField`; replace-decoration widget hosting the engine; activation by click and by cursor-enter; boundary exits (arrows, Tab, Escape-revert); commit-on-blur and immediate modes; position mapping.
- `$` in text mode opens a new active inline field; command for display container.
- No primary modal/popup editor path. If implementation pressure suggests a modal, stop that path and fix the in-place CodeMirror integration instead (D26).

**Acceptance (the demo that proves the concept):** open a note, type `$`, build `v = \frac{s}{t}` structurally in the paragraph without seeing LaTeX and without a modal; arrow out right; keep typing prose on the same line; reactivate by arrow-in; create and edit one display equation in its document block; Escape reverts an edit; the file on disk contains clean `$v = \frac{s}{t}$`; activate/deactivate with no edit produces a byte-identical file; Obsidian undo after commit removes the whole equation edit in one step. Evidence follows D24: recording preferred, screenshot sequence + transcript + file-byte diff accepted.

# Phase 3 — Palette integration (≈1 week)

- `\` inside an active field opens the palette at the caret; insertion respects selection-wrap and placeholder focus; recents/frequency persist; text-mode palette entries (inline, container, align, gather).
- `^`, `_` shortcuts; curated inline shortcuts.

**Acceptance:** the Mathcha loop works end to end in the note body — `\int` Enter, fill bounds via Tab, `\` `matrix` Enter inside the integrand, fill cells — no mouse, no raw LaTeX visible, no detached equation editor. Evidence follows D24.

# Phase 4 — Structures and clipboard (≈1 week)

- Matrix/environment settings affordance (type, rows, cols, brackets); row/column context menu + keyboard ops; Enter-in-matrix behavior.
- Structural clipboard: dual-payload copy/cut, structure-preferring paste, LaTeX-parsing paste of external text.

**Acceptance:** build a matrix of integrals; copy one integral, paste into two other cells and into a separate equation; convert `pmatrix` → `bmatrix` → `cases`; add/remove rows by keyboard alone. Evidence follows D24.

# Phase 5 — Hardening (≈1 week)

- Deferred/immediate commit setting; undo coalescing verified; raw-region preservation guard (byte-diff on commit); escape hatch command "edit as LaTeX" for anything structural editing can't express; settings tab; IME QA; long-note performance pass (100+ equations).

**Acceptance:** the regression battery from Phase 0 passes through the full in-editor path; a 100-equation note scrolls and edits without jank; a note containing exotic LaTeX survives an edit session byte-identical outside the edited equation.

# Phase 6 — Release packaging (≈2–3 days)

- README, manifest, versions.json, GitHub release workflow; BRAT-installable; optionally submit to community plugins later.

**Acceptance:** installable in a fresh vault from the release artifact; first-run works with zero configuration.

# v2 backlog (explicitly deferred)

Equation tags/references and click-to-jump (Mathcha §2.2/§2.5); multline layout; context-aware palette ranking; manual bracket sizing; display-style toggle for inline operators; mobile editing; per-character color styling in equations.
