System design: layers, the engine interface, CodeMirror integration, and the sync strategy. Serves [[01 Behavioral Specification]]; build order in [[05 Build Phases]].

Part of [[00 Overview and Doc Map]].

# Engine decision

Phase 0 Spike A passed on 2026-08-03 using `mathlive@0.110.0` **under ratified D28**, not under original strict D16. True serialization via `getValue("latex-expanded")` produced 23/36 strict counted passes and 13 strict counted failures; under D28's edited-equation normalization policy it produced 36/36 counted passes, with both multiline must-pass items (`aligned` #22 and `cases` #25) passing. Items 30 and 33 require the `middle-delimiter-brace` fixup (`\middle{|}` -> `\middle|`) before any commit to a note. The seven sampled natural-edit probes passed under the D28-amended criterion. Use `MathLiveEngine` for v1. Spike B is not warranted unless a later immutable regression invalidates this decision.

# Layers

```
┌──────────────────────────────────────────────┐
│ Obsidian plugin shell (main.ts, settings)     │
├──────────────────────────────────────────────┤
│ CodeMirror 6 integration                      │
│   scanner → activation → in-place widget → sync │
├──────────────────────────────────────────────┤
│ Suggestion box + template registry            │  ← engine-agnostic
├───────────────┬──────────────────────────────┤
│ EditorEngine interface                        │
│   MathLiveEngine   │   (CustomEngine, if      │
│   (default path)   │    Spike B wins)         │
└───────────────┴──────────────────────────────┘
        Storage: plain $...$ / $$...$$ in the note
```

Repo: `/Users/gradyclopton/Projects/obsidian-structured-math`, TypeScript + esbuild, standard sample-plugin layout, core logic in engine-agnostic modules unit-testable in Node. The vault at `ObsidianVaults/latex` is a consumer, never the source tree.

# The EditorEngine interface

The boundary that keeps the engine decision non-load-bearing. The frozen, canonical contract lives in [[07 Repo Conventions and Contracts]] (`core/contracts.ts`); changes require a decision note. Engine assumption: MathLive, with D20 selecting the Spike A candidate version and D21 defining the mechanical route for pass, conditional pass, or fail.

# MathLiveEngine (the default path)

Verified API mapping:

- Template insertion: `mf.insert(latex, { selectionMode: "placeholder" })`; wrap-selection via the `#0` token (replaced by current selection); placeholder navigation via `moveToNextPlaceholder` / `moveToPreviousPlaceholder`.
- Shortcuts: `inlineShortcuts` (with `after` context constraints and `inlineShortcutTimeout`), `keybindings` array (spread existing + append). The `\` palette hook: intercept the backslash key ahead of MathLive's own command mode (the studied `mathlive-in-editor-mode` has a `setupBackslashCommandInput` precedent).
- Caret depth for boundary rules: `mf.getElementInfo(mf.position).depth` (pattern lifted from studied source).
- Menu: MathLive ships a context menu; suppress or curate it so it never competes with our palette.
- Raw preservation and normalization: MathLive's cached `getValue("latex")` returns activation-time input byte-identically until an edit occurs; use that behavior plus an explicit dirty flag to back BS-37 for activated-but-unedited equations. Once the user structurally edits an equation, serialize from the engine, apply required fixups such as `middle-delimiter-brace`, and accept D28-normalized LaTeX for that edited equation only.

# CodeMirror integration

Hard constraint from D26: the active editor is a CodeMirror-mounted in-place widget, never an Obsidian `Modal` or detached editor pane for the primary workflow. Inline widgets must preserve sentence flow; display widgets must occupy the math block's document position. Popup surfaces are supporting UI only and must return focus to the active in-document mathfield.

## Scanning

Use Obsidian's Markdown syntax tree, not regex (verified node names from studied source): iterate `syntaxTree(state)`, math ranges are delimited by nodes whose names contain `formatting-math-begin` / `formatting-math-end`, with `math-block` distinguishing display from inline. This automatically excludes code fences, inline code, and escaped `$` (currency false-positives never enter the tree as math).

## Activation model

Differs deliberately from the studied plugin (which renders its widget *beside* the LaTeX): we use `Decoration.replace` over the math range, but **only for the active equation**. Inactive equations remain Obsidian's normal rendered math — zero cost, zero behavior change. A `StateField` tracks the single active range (entered by cursor motion or click via `EditorView.domEventHandlers` on rendered math); the ViewPlugin swaps in the replace decoration for that range only. The replacement DOM mounts the engine's editable field exactly where the equation appears. This sidesteps the two classic replace-decoration problems at scale: cursor trapping (only one replaced range exists at a time) and per-keystroke widget churn across a long note.

Inline activation contract: replacing `$...$` must produce an inline-level DOM node whose baseline, height, and caret boundaries fit the surrounding paragraph. The line may reflow because the equation is typeset, but the user remains in the paragraph and continues typing prose after boundary exit.

Display activation contract: replacing `$$...$$` must produce a block-level DOM node in the same document position as the display equation. It may expand vertically for matrices/aligned content, but it must scroll with the note and behave like part of the note, not like an overlay workspace.

## Sync (the hard part, with known solutions)

Adopted from the studied source, hardened:

- Widget → document: on engine change, dispatch a transaction replacing `[from, to]` with the new LaTeX, tagged with an `Annotation` so our own extension ignores self-inflicted updates. Update the tracked range as `to = from + newLatex.length`.
- Position drift: map the active range through every transaction (`changes.mapPos(from, -1)` / `mapPos(to, 1)` — the studied widget's `mapSourceRange`).
- Widget survival: CodeMirror may rebuild decorations on dispatch; the studied plugin guards with the internal `inputState.composing` flag to keep the focused field's DOM alive. This works but touches a private API — treat as a pinned-version dependency, isolate it in one function, and re-verify per CM update (risk register item).
- Focus protection: in `updateDOM`, never `setValue` a focused field (studied pattern); external document edits refresh only unfocused widgets.
- Commit modes: immediate is the default (D02); deferred (dispatch on blur) ships as a setting and is the safety valve if immediate proves janky in long notes.
- Escape: revert to activation-time value, restore document range, blur (studied semantics).

## Undo strategy

Active-session edits are the engine's own undo domain. On deactivation, the session's document change should coalesce: dispatch intermediate syncs with `addToHistory: false` and write one history-visible transaction on commit (deferred mode gets this free; immediate mode needs the coalescing). Acceptance test in [[06 Testing Strategy]].

# Storage rules

Serialization boundaries per [[01 Behavioral Specification]]: `$latex$` inline, `$$\n…\n$$` display, byte-identical round-trip when unedited, raw-region preservation. The plugin never rewrites math it didn't edit.

# What we reuse from the studied repos

- `mathlive-in-editor-mode` (MizarZh): syntax-tree node names, position mapping, composing-flag guard, boundary-exit-with-depth logic, focused-field protection. Architecture differs (adjacent widget vs our active-range replace), so this is pattern reuse, not a fork.
- `obsidian-formula-library` (strangelion, MIT): template catalog JSONs and category structure as seed data ([[03 Template System and Suggestion Box]]).
- `obsidian-mathlive` (danzilberdan): reference only for MathLive packaging in an Obsidian bundle. Its modal flow is an explicit non-model for this project because D26 requires in-document editing.

# Mobile

MathLive on Obsidian mobile is unproven in this stack (the danzilberdan plugin is desktop-only; the studied plugin ships touch-keyboard support, suggesting it works). v1 targets desktop; mobile is evaluated after Phase 2 with the studied plugin's touch controller as the map. Notes must, regardless, remain fully readable on mobile (they're plain LaTeX — guaranteed by the storage rules).
