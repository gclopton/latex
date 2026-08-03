Repository layout, code rules, and the frozen contracts. The contracts in this doc are copied verbatim into the repo as source files in Phase 1; after that, the repo files are canonical and changes require a decision note in `docs/decisions/`.

Part of [[00 Overview and Doc Map]].

# Repository

`/Users/gradyclopton/Projects/obsidian-structured-math` — its own git repo, GitHub `gclopton/obsidian-structured-math`. The `latex` vault is a consumer only: dev builds copy `main.js`/`manifest.json`/`styles.css` into `ObsidianVaults/latex/.obsidian/plugins/structured-math/`. Plugin identity per D18: id `structured-math`, name "Structured Math", `isDesktopOnly: true`. D25 authorizes Codex to create the local repo, commits, tags, and remote push when credentials/tooling permit; remote creation failure is a final packaging blocker, not an implementation blocker.

```
obsidian-structured-math/
  manifest.json  package.json  esbuild.config.mjs  tsconfig.json  versions.json
  src/
    main.ts  settings.ts
    core/                 ← engine-agnostic; MUST NOT import from engine/ or obsidian
      contracts.ts        ← the frozen interfaces below
      templates/          ← registry, catalog converter, ranking
      palette/            ← suggestion box component + state
      clipboard.ts
    engine/
      mathlive/           ← MathLiveEngine (sole engine unless Spike A fails)
    editor/               ← CodeMirror/Obsidian integration; imports core + engine via contracts only
      scanner.ts  activeRange.ts  widget.ts  sync.ts  keymap.ts
  tests/
    unit/                 ← vitest, Node
    engine/               ← vitest + playwright (real DOM)
    fixtures/battery/     ← regression battery (immutable, see 08)
  docs/reports/           ← phase-gate reports + demo recordings
```

# Module boundary rules (mechanically enforced)

1. `core/` imports nothing from `engine/`, `editor/`, or `obsidian`. It compiles and tests in bare Node.
2. `editor/` talks to the engine exclusively through `core/contracts.ts` types.
3. `engine/mathlive/` is the only module importing `mathlive`.
4. Enforced with an eslint `no-restricted-imports` rule committed in Phase 1 — a violation is a build failure, not a review comment.

# Code rules

- TypeScript strict; no `any` except at the MathLive boundary, where each use carries a comment naming the untyped API.
- Dependencies: `mathlive@0.110.0` (D20), `obsidian`, dev-tooling only. Any new runtime dependency requires a decision note.
- The one sanctioned private-API touch — CodeMirror `inputState.composing` — lives in a single function `withComposingGuard()` in `sync.ts` with a comment linking the risk register entry. No other private API access.
- Primary math editing must be implemented in `editor/` as an in-place CodeMirror widget (D26). `Modal` imports are allowed only in settings, secondary structure configuration, or the raw-LaTeX escape hatch; using `Modal` for normal inline/display equation editing is a build failure.
- No network calls anywhere. No telemetry.
- Every file ≤ ~300 lines; split before exceeding.

# Frozen contract: EditorEngine

```ts
// core/contracts.ts — changes require a decision note.
export interface EngineMountOptions { inline: boolean; initialLatex: string; }

export interface EditorEngine {
  mount(host: HTMLElement, opts: EngineMountOptions): void;
  destroy(): void;

  /** Current serialization. Must be stable: no edit ⇒ identical string (BS-37 support). */
  getLatex(): string;
  /** Replace content without firing onChange. */
  setLatex(latex: string): void;

  /** Insert template latex; `#0` = wrap current selection; `\placeholder{}` slots.
   *  Focus lands on the first placeholder (BS-14/15). */
  insertTemplate(latex: string): void;
  nextPlaceholder(): void;
  prevPlaceholder(): void;

  focus(): void;
  blur(): void;
  caretInfo(): { atStart: boolean; atEnd: boolean; depth: number };

  /** Structural clipboard payload for the current selection, or null if none. */
  selectionPayload(): { latex: string } | null;

  onChange(cb: (latex: string) => void): () => void;        // returns unsubscribe
  onBoundaryExit(cb: (dir: "left" | "right" | "up" | "down") => void): () => void;
  onPaletteRequest(cb: (anchor: DOMRect) => void): () => void;  // "\" pressed
}
```

# Frozen contract: MathTemplate

```ts
export interface MathTemplate {
  id: string;
  title: string;
  aliases: string[];
  category: string;
  latex: string;            // insertion body; may contain #0 and \placeholder{}
  wraps: boolean;           // must equal latex.includes("#0") — linted
  shortcut?: string;        // display hint only
  description?: string;
  mode: "math" | "text";    // which palette offers it
}
```

Palette state (recents ring, frequency counters, favorites) is plugin data, never part of the template definition files.

# Commit conventions

Conventional-commit style (`feat:`, `fix:`, `test:`, `docs:`), one logical change per commit, tests in the same commit as the code they cover. Phase gates are tagged `phase-0` … `phase-6`.

# External references

Use the pinned repo states in D23. Clone reference repositories under `/Users/gradyclopton/Projects/reference/` only, with folder names matching the repo name. Reference clones are read-only study material and are not vendored into the plugin repo.
