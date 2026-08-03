The template data model and the palette that makes this feel like Mathcha. Engine-agnostic: templates compile to engine `insert()` calls through the interface in [[02 Architecture]].

Part of [[00 Overview and Doc Map]].

# Template record

```ts
interface MathTemplate {
  id: string;                 // "fraction", "definite-integral"
  title: string;              // "Fraction"
  aliases: string[];          // ["frac", "over"]
  category: string;           // "Calculus", "Layouts", "Brackets", ...
  latex: string;              // insertion body with placeholder tokens
  wraps?: boolean;            // true if latex contains the selection token
  shortcut?: string;          // display hint, e.g. "^" for power
  description?: string;
  favorite?: boolean;         // user state, stored separately from definition
  settings?: "matrix" | "none"; // structures with a settings affordance
}
```

Placeholder conventions (MathLive vocabulary, translated by the engine adapter):

- `#0` — replaced by the current selection (the wrap token). Example fraction: `\frac{#0}{\placeholder{}}` — selection becomes numerator, caret lands in denominator.
- `\placeholder{}` — an empty editable slot; insertion uses `selectionMode: "placeholder"` so the first slot focuses immediately; Tab walks the rest.
- Example definite integral: `\int_{\placeholder{}}^{\placeholder{}} \placeholder{}\,\mathrm{d}\placeholder{}`.

A custom engine (if Spike B wins) maps the same records to AST constructors; the template files don't change. That's the point of keeping templates as data.

# Seed catalog

- Import `obsidian-formula-library`'s MIT catalog: 18 category JSONs, format per file `{ id, structures, items: [ {section, sectionEn} | [name, latex, nameEn] ] }` (verified from source). Write a one-time converter → our `MathTemplate[]`, keeping English titles, generating aliases from LaTeX command names, mapping sections → categories.
- Hand-author the ~40 core structural templates the catalog treats as plain formulas: fraction, roots, scripts, integrals (indefinite/definite/multiple/closed), sum/product/limit, derivative and partial-derivative stacks, vector/hat/bar accents, matrix family, cases, aligned/gathered, bracket pairs (paren/bracket/brace/vert/Vert/ceil/floor/angle), one-sided `\left.`, arrows. These carry the placeholder/wrap tokens the catalog lacks.
- User templates: same JSON schema, loaded from a `templates/` folder in the plugin config dir; hot-reloaded. User entries shadow built-ins on id collision.

# The suggestion box

## Interaction (contract in [[01 Behavioral Specification]])

`\` opens it anchored at the caret; typing filters; Enter inserts; Escape closes cleanly; arrow keys navigate; the query text never leaks into the equation. In text mode it offers the text-mode entries (inline math, math container, align, gather); in math mode, the template catalog.

The palette is allowed to float, like Mathcha's menu, but it is not the editor. Template insertion always targets the active in-document mathfield or the text cursor's document position (D26). Closing the palette leaves the user editing the same note location.

## Reference screenshots (normative for feel, not pixels)

These captures of Mathcha's actual palette define the target interaction. Study them before building the palette.

![[mathcha-palette-text-mode.png]]
*Text-mode palette: mode-aware entries, per-row icons, shortcut hint in the footer. Note composite entries carry a marker dot distinguishing them from plain symbols.*

![[mathcha-palette-math-all.png]]
*Math-mode palette, All view: rendered glyph previews **with visible placeholder boxes**, shortcut hints beside `\power`/`\index`, per-row ⇧ expand buttons, view tabs along the bottom (All / Composite / Categories / Custom / Drawing), and a description footer for the highlighted entry ("Press Shift to expand boxes, square root").*

![[mathcha-palette-categories.png]]
*Categories view: a category rail of glyph icons (trig, arrows, big operators, ×÷, relations, Greek, brackets, fractions) beside the filtered list. Our layout may differ; the two-level navigate-by-glyph structure is the target.*

![[mathcha-iint-inline-boxes.png]]
![[mathcha-iint-expanded-boxes.png]]
*An inserted `\iint` template in the equation: empty placeholder slots rendered as clickable hollow boxes — inline form (limits beside) and Shift-expanded form (limits above/below). MathLive's `\placeholder{}` renders equivalently; the expanded insert is decision D19.*

![[mathcha-palette-inside-numerator.png]]
*The palette invoked from **inside a fraction's numerator**, mid-derivation — the nesting requirement (BS-16) in the wild. The palette anchors near the active slot; insertion targets that slot; the surrounding derivation stays put. This is the depth at which the palette must work, not just at top level.*

## Palette views

Bottom tabs: **All** (everything), **Composite** (templates with slots only), **Categories** (two-level: category rail → filtered list), **Custom** (user templates from the `templates/` folder — same catalog mechanics, user-authored entries only). Mathcha's Drawing view is out of scope v1.

## Per-entry affordances

- Rendered preview with placeholder boxes visible (lazy/virtualized).
- Shortcut hint when the template has one.
- ⇧ expand: for large-operator templates (int/sum/prod/lim families), Shift+Enter inserts the expanded form — limits above/below, full-size — instead of the inline form (D19 approved). Rows carrying this affordance show the ⇧ marker.
- Description footer: the highlighted entry's `description` renders in a single-line bar at the palette's bottom edge.

## Search and ranking

Fuzzy match over `id`, `title`, `aliases` (exact id/alias prefix beats fuzzy title). Use this deterministic scoring formula in v1:

```
score = textMatch + recency + frequency + favorite

textMatch:
  exact id or exact alias:          1000
  id or alias starts with query:     800
  title starts with query:           600
  id/alias/title contains query:     400
  fuzzy subsequence match:           200 - editDistancePenalty

recency:
  most recent item:                   60
  second through twelfth recent:      55, 50, 45, ... 5
  not recent:                          0

frequency:
  min(40, floor(monthlyDecayedCount * 4))

favorite:
  75
```

Context boosts (w5) are a v2 refinement — ship without them, log usage data from day one so the boost rules are informed by real behavior, not guesses.

Sort by score descending, then exact alphabetical `title`, then `id`. This makes ranking tests stable. Favorites do not override a materially worse text match; they only float within plausible matches.

## State

- Recents: ring buffer of template ids with timestamps, persisted via `saveData()`.
- Frequency: per-id counters, persisted, decayed monthly so the list adapts across semesters.
- Favorites: id set, toggled from the palette (keyboard: one modifier key while highlighted).

## Rendering

Each row: rendered preview of the template (engine's static render or KaTeX), title, shortcut hint. Preview rendering must be lazy/virtualized — the catalog is ~2,000 entries and the palette must open in under a frame; render only visible rows.

# Settings surface (v1, deliberately small)

- Default insertion: inline vs display for the `$` shortcut
- Activation: cursor-enter / click-only
- Commit mode: immediate / deferred (see [[02 Architecture]])
- Tab at last slot: exit equation / add matrix row (context-dependent default)
- Matrix Enter behavior: new row / move down
- Recents length; enable/disable `^`, `_`, `$` shortcuts
- No network, no API keys, no telemetry.
