The contract: what the editor must do, keystroke by keystroke. Every requirement has an ID (`BS-xx`) cited by tasks and tests. Defaults marked `(Dxx)` were approved in [[Open Decisions]] and are closed — no builder may reinterpret them. The keystroke traces at the end are normative: they are acceptance tests in prose form.

Part of [[00 Overview and Doc Map]].

# Modes and containers

- **BS-01** Text mode is ordinary Obsidian Markdown editing; the plugin adds only entry points into math.
- **BS-02** Typing `$` in text mode immediately opens an empty active inline math field at the cursor (D08).
- **BS-03** Display math is inserted via the text-mode palette (`\math-container`) or an Obsidian command with assignable hotkey. No `$$` auto-trigger in v1 (D09).
- **BS-04** An equation is either **inactive** (Obsidian's normal rendered math, untouched by the plugin) or **active** (an editable structured field replacing the rendered form in place; `$` delimiters hidden).
- **BS-04A** Primary editing is always in-document (D26). Active inline math occupies the same line and cursor location as the inline equation. Active display math occupies the same block location as the display equation. The user must never be moved into a detached modal/popup equation editor for normal creation or editing.
- **BS-04B** Floating UI may appear near the caret only as supporting UI: template palette, autocomplete, context menu, tooltip, structure settings, or raw-LaTeX escape hatch. Closing that UI returns focus to the in-place active equation, not to a separate editor surface.
- **BS-05** Activation: cursor entering the range via arrow keys, or click on the rendered math (D01, both always on).
- **BS-06** Deactivation paths — boundary exit, Tab-out, Escape, click outside, pane/file switch — every one either commits or reverts explicitly. No silent abandonment.
- **BS-07** Inline large operators use the engine's inline style (small, limits beside). Display-style toggle is v2 (D12).

# The suggestion box

- **BS-08** `\` opens the palette anchored at the caret: in math mode the template catalog; in text mode the text-mode entries (inline math, math container, align, gather) (D11).
- **BS-09** Typing filters live after every character by id, title, alias, and LaTeX command with fuzzy matching; exact id/alias/command prefix matches rank above fuzzy title matches. Example: `\` opens the palette, then `s`, `i`, `n` progressively narrows toward `\sin`.
- **BS-10** Ranking: text match > recency > frequency > favorite (weights in [[03 Template System and Suggestion Box]]).
- **BS-11** Arrow keys navigate; Enter inserts; Escape closes with zero residue — the typed query never appears in the equation or the note.
- **BS-12** With an empty query, the palette shows recently used templates first, then frequent/favorite/default entries. Recents (12, D13) and frequency (monthly decay, D13) persist across sessions.
- **BS-13** Entries with shortcuts display the hint beside the title.

# Templates and slots

- **BS-14** Composite templates create structures with editable slots; insertion with no selection focuses the first slot.
- **BS-15** Insertion with a selection wraps it: fraction puts the selection in the numerator and focuses the denominator; bracket pairs enclose it.
- **BS-16** Templates nest without special cases — the palette works identically inside any slot.
- **BS-17** Tab advances to the next slot; Shift+Tab previous.
- **BS-18** Tab at the last slot of the outermost structure exits the equation to the right (D04).
- **BS-19** `^` and `_` insert script templates in math mode, always active (D10).

# Navigation and selection

- **BS-20** Arrow keys move spatially through the expression (into numerators, scripts, cells) per engine conventions.
- **BS-21** ArrowLeft/ArrowRight at the equation's leftmost/rightmost boundary exit into surrounding text.
- **BS-22** ArrowUp/ArrowDown exit only at nesting depth 0; inside nested structures they navigate the structure.
- **BS-23** Selection is structural: contiguous nodes within one slot, or a whole node; Shift+arrows extends structurally.

# Structural clipboard

- **BS-24** Copy/Cut place two payloads: internal structured form and plain LaTeX.
- **BS-25** Paste inside an active field prefers structure; paste outside yields LaTeX; external text that parses as LaTeX inserts structure, otherwise a text node.

# Matrices and layout environments

- **BS-26** `\matrix` inserts 2×2 with parentheses; palette commands and the cell context menu provide: change environment (matrix/pmatrix/bmatrix/Bmatrix/vmatrix/Vmatrix/cases/aligned/gathered/array), insert/delete row/column. Floating settings widget is v2 (D14).
- **BS-27** In cells: Tab next cell, Shift+Tab previous; Tab at the last cell exits the structure (D06); Enter inserts a new row below (D05).
- **BS-28** Environments serialize to their standard LaTeX (`\begin{pmatrix}…\end{pmatrix}` etc.).

# Brackets

- **BS-29** Bracket-pair templates produce auto-height `\left…\right` pairs; searchable as pairs (paren, bracket, brace, vert, Vert, ceil, floor, angle).
- **BS-30** One-sided auto-height via `\left.` / `\right.` templates.
- **BS-31** Force-normal and manually sized brackets are v2; literal typed brackets stay literal.

# Undo, Escape, commit

- **BS-32** Inside an active field, undo/redo is the field's structural undo.
- **BS-33** A committed activation session is one Obsidian history entry: note-level undo removes the session's whole change (D07).
- **BS-34** Escape reverts the equation to its activation-time value and deactivates (D03).
- **BS-35** Commit mode: immediate sync per change (default), deferred-on-blur as a setting (D02).

# Storage

- **BS-36** Inline serializes to `$latex$` (no interior padding); display to `$$⏎latex⏎$$`.
- **BS-37** Deterministic: activate → deactivate with no structural edit ⇒ byte-identical file. Enforced by a commit-time guard: if no edit occurred, emit activation-time bytes verbatim.
- **BS-38** LaTeX the engine cannot represent structurally is preserved and re-emitted byte-identically (raw regions).
- **BS-39** The plugin never rewrites math it did not activate.

# Reference: the inline lifecycle in pictures

Mathcha screenshots showing the exact sequence the requirements above describe. Normative for behavior, not pixels.

![[mathcha-lifecycle-1-text-palette.png]]
*1. Text mode, `\` pressed: the text-mode palette opens at the caret (BS-01, BS-08); `\inline-math` highlighted with its `$` shortcut in the footer.*

![[mathcha-lifecycle-2-empty-inline-field.png]]
*2. After insertion: an empty active inline math field sits **in the sentence**, at the cursor position — not in a modal (BS-02, BS-04A). This tiny green box is the whole point of D26.*

![[mathcha-lifecycle-3-palette-in-field.png]]
*3. `\` inside the field: the math-mode palette opens (Categories view, matrix family) — same trigger, different catalog (BS-08, BS-16).*

![[mathcha-lifecycle-4-matrix-in-sentence.png]]
*4. A `\bmatrix` inserted and being edited cell-by-cell, mid-sentence, in the paragraph's flow (BS-04A, BS-26, BS-27). The floating gear is Mathcha's structure-settings affordance — ours is the context menu in v1, gear in v2 (D14).*

![[mathcha-nested-matrix-inline.png]]
*5. The nesting requirement stress-tested (BS-16, trace T06): a matrix inside a matrix cell, sibling cells holding √2 and φ, a triple integral with attached limits — all inline in a sentence. Every slot is a full editing context; there are no special cases. Note the line grows tall and the paragraph reflows around it — permitted explicitly by the D26 activation contract.*

# Keystroke traces (normative)

Each trace: starting state → key sequence → exact resulting file bytes. `⌦` marks the caret. These become integration tests verbatim.

**T01 — inline fraction (BS-02, BS-04A, BS-14, BS-17, BS-18, BS-36)**
Text: `The speed is ⌦` → keys: `$` `v` `=` `\` `f` `r` `a` `c` `Enter` `s` `Tab` `t` `Tab` → visible behavior: an editable inline mathfield appears at `⌦` in the sentence; no modal or detached editor opens → file: `The speed is $v=\frac{s}{t}$` with caret after the closing `$`.

**T02 — wrap selection (BS-15)**
Active inline field containing `x+1`, all selected → `\` `f` `r` `a` `c` `Enter` `2` `Tab` → file: `$\frac{x+1}{2}$`.

**T03 — scripts (BS-19)**
Active field, caret after `E=mc` → `^` `2` `ArrowRight` → serializes `E=mc^{2}`.

**T04 — matrix fill (BS-04A, BS-26, BS-27)**
Active display field embedded in the note body → `\` `p` `m` `a` `t` `Enter` `a` `Tab` `b` `Tab` `c` `Tab` `d` `Tab` → contains `\begin{pmatrix}a & b \\ c & d\end{pmatrix}`, caret exited the matrix; the display field remains in the document flow the whole time.

**T05 — matrix row growth (BS-27)**
Caret in cell `c` of T04's matrix → `Enter` → matrix has 3 rows, caret in first cell of the new middle-following row; serialization gains one `\\` row.

**T06 — nesting (BS-16)**
Caret in a matrix cell → `\` `i` `n` `t` … select definite integral, `Enter` → integral template with placeholders sits inside the cell; Tab walks its slots before continuing to the next cell.

**T07 — Escape revert (BS-34, BS-37)**
File contains `$a+b$` → activate, type `x`, press `Escape` → file bytes exactly `$a+b$`; equation inactive.

**T08 — byte neutrality (BS-37)**
File contains `$$⏎E_U = \frac{U_{\mathrm{eff}}}{2}\sum_{I,\sigma}\mathrm{Tr}[n^{I\sigma}-n^{I\sigma}n^{I\sigma}]⏎$$` → activate via arrow-in, arrow-out the other side, no edits → file byte-identical.

**T09 — session undo (BS-33)**
From T01's result: `Cmd+Z` once → file back to `The speed is ` exactly; a second `Cmd+Z` undoes whatever preceded the trace.

**T10 — structural paste (BS-24, BS-25)**
In an active field containing a definite integral, select the whole integral node, `Cmd+C`, move to an empty matrix cell, `Cmd+V` → the cell contains an editable integral (placeholders navigable), not a flat string; serialization matches the copied LaTeX.
