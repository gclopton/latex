Two timeboxed spikes settle the engine question with evidence instead of estimates, before any large build. Then the standing risk register. Referenced by [[05 Build Phases]] as Phase 0.

Part of [[00 Overview and Doc Map]].

# Spike A — MathLive fidelity against real lecture math

**Question:** does MathLive faithfully edit and round-trip the LaTeX Sam actually writes — especially multiline (`aligned`, `cases`, `gathered`), its historically weakest area?

**Procedure (timebox: one evening):**

1. Use `mathlive@0.110.0` (D20). Do not search for another version unless installation fails.
2. Create `spikes/mathlive-fidelity/` in the plugin repo with:
   - `index.html` — one `<math-field>`, a textarea showing `getValue()`, buttons for `setValue`, `getValue`, insert-template `\frac{#0}{\placeholder{}}`, next/previous placeholder, and clear.
   - `battery.json` — generated from [[11 Spike A Battery]], preserving id, name, latex, tolerance, and `mustPass` flags.
   - `run-roundtrip.mjs` — Playwright script that loads each item, calls `setValue(latex)`, waits one frame, reads `getValue()`, classifies the byte diff against D16, and writes `results.json`.
   - `manual-checklist.md` — the seven edit-naturally checks from [[11 Spike A Battery]], each with a pass/fail checkbox and notes field.
3. For automated round-trip: `setValue(latex)` → wait for MathLive to settle → `getValue()` → classify `identical`, `cosmetic`, or `destructive` using the D16 whitelist. Anything not automatically classifiable as identical/cosmetic is destructive until manually justified in `results.json`.
4. For manual structural editing: perform only the sampled checks listed in [[11 Spike A Battery]]. Record `natural: true/false`, a one-sentence reason, and the final serialized LaTeX.
5. Save `spikes/mathlive-fidelity/results.json` and summarize it in `docs/reports/phase-0.md`.

`results.json` schema:

```json
{
  "mathliveVersion": "0.110.0",
  "date": "2026-08-03",
  "items": [
    {
      "id": 1,
      "input": "...",
      "output": "...",
      "tolerance": "cosmetic",
      "diffClass": "identical | cosmetic | destructive | raw",
      "roundtripPass": true,
      "naturalEditPass": null,
      "notes": ""
    }
  ],
  "summary": {
    "countedPasses": 0,
    "countedFailures": 0,
    "mustPassAligned": false,
    "mustPassCases": false,
    "decision": "pass | conditional | fail"
  }
}
```

**Pass (D17):** ≥36/40 battery items edit naturally AND round-trip within their tolerance class, with `cases` (#25) and basic `aligned` (#22) among the passes. "Cosmetic" is defined exhaustively by D16: whitespace, brace normalization, `\left\right` insertion — anything else is destructive. The battery, tolerance classes, and edit-naturally checks are fully specified in [[11 Spike A Battery]]; the rule is pure counting, no judgment. **Conditional pass:** threshold met except the multiline must-pass items → v1 scopes multiline environments to raw-region editing (structural per-line), engine question stays settled. **Fail:** below threshold on single-line items → Spike B's result decides. D21 closes the routing: do not stop for Sam after pass/conditional/fail unless both spikes cannot run.

# Spike B — custom-engine reality check

**Question:** is Codex's from-scratch architecture viable on the timeline intuition — *including the rendering layer its plan omitted*?

**Procedure (timebox: one week of evenings, AI-assisted):**

1. Implement the minimal vertical slice: AST (symbol, text, fraction, script, matrix only), deterministic serializer, path-based cursor/selection, keyboard editing, **typeset rendering** (KaTeX fonts/CSS conventions — this is the part under test), and Tab navigation.
2. Evaluate honestly: does a nested fraction-in-matrix *look* like typeset math (baseline alignment, script sizing, spacing)? Does cursor movement feel natural? What fraction of the week went to layout?

**Interpretation:** if the slice feels right and layout cost was modest, the custom path is credible and buys total control. If layout consumed the week and still looks off, MathLive's nine years of that work wins. Both spikes can run in the same week; A is cheap enough to run first and may make B moot.

**Decision rule:** A passes → MathLiveEngine, proceed to Phase 1. A conditional → MathLiveEngine with scoped multiline. A fails and B promising → custom engine, replan [[05 Build Phases]] timeline. A fails and B sobering → hybrid (MathLive per-line inside our own multiline shell) — design doc before proceeding.

The "promising" vs "sobering" distinction is mechanical: Spike B is promising only if the vertical slice implements all five listed structures, renders nested fraction-in-matrix with baseline/script spacing acceptable enough to read in a lecture note screenshot, and consumes less than 60% of the timebox on layout. Otherwise it is sobering. If screenshots are ambiguous, classify as sobering and choose the hybrid route; that is the conservative path.

# Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| CM6 ↔ widget sync bugs (range drift, lost edits) | High | Adopt proven patterns from studied source (annotation-tagged dispatch, `mapPos` range mapping); deferred-commit mode as fallback; round-trip tests in [[06 Testing Strategy]] |
| `inputState.composing` guard uses a private CM API | Medium | Isolate in one function; pin CM-affecting deps; re-verify on every Obsidian update; fallback = deferred commit (no mid-input dispatch at all) |
| Undo stacks fighting (engine vs CodeMirror) | Medium | Session-coalescing design in [[02 Architecture]]; explicit acceptance test; worst case = deferred commit makes it moot |
| MathLive multiline weakness | High (to scope, not to project) | Spike A resolves before build; conditional-pass path defined above |
| Destructive round-trip of unusual LaTeX | High | Never `setValue`→`getValue` rewrite math the user didn't activate; byte-diff guard on commit: if user made no structural edit, emit activation-time bytes |
| IME / international input inside fields | Medium | MathLive handles IME internally (its win over contenteditable); test Chinese/accented input in Phase 2 QA |
| Performance: long notes, many equations | Medium | Only the active equation gets a widget; inactive = Obsidian's normal rendering; palette virtualized |
| Obsidian mobile | Low (v1 desktop) | Storage is plain LaTeX so mobile reading is unaffected; evaluate editing post-Phase 2 |
| MathLive upstream changes | Low | Pin version; the engine interface confines the blast radius |
| Palette shortcut collisions with user's other plugins | Low | All shortcuts configurable; no global hotkeys beyond Obsidian command registry |
