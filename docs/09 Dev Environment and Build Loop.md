Exact commands and the development loop, so no session burns time rediscovering the environment. Assumes macOS, node ≥ 20, git configured (both already true on Sam's machine).

Part of [[00 Overview and Doc Map]].

# One-time setup (Phase 1)

```bash
mkdir -p ~/Projects/obsidian-structured-math && cd ~/Projects/obsidian-structured-math
git init -b main
npm init -y
npm i -D typescript esbuild vitest @playwright/test eslint obsidian@latest
npm i mathlive@0.110.0         # D20
npx playwright install chromium
git remote add origin git@github.com:gclopton/obsidian-structured-math.git || true
```

Scaffold per the layout in [[07 Repo Conventions and Contracts]] (adapt the official obsidian-sample-plugin's esbuild config; do not add its bloat). D25 authorizes creating/pushing the GitHub repo when available. If `git remote add` succeeds but `git push` fails because the remote does not exist or auth is unavailable, keep building locally and record the push as a packaging blocker in the current report.

Minimum `package.json` scripts:

```json
{
  "scripts": {
    "dev": "node scripts/dev-watch.mjs",
    "build": "node esbuild.config.mjs production",
    "test:unit": "vitest run tests/unit",
    "test:engine": "vitest run --config vitest.engine.config.ts tests/engine",
    "test:all": "npm run lint && npm run test:unit && npm run test:engine",
    "lint": "eslint ."
  }
}
```

# The build loop

```bash
npm run dev        # esbuild watch → dist/, then copies into the vault plugin dir
```

The dev script's copy step targets:
`/Users/gradyclopton/ObsidianVaults/latex/.obsidian/plugins/structured-math/{main.js,manifest.json,styles.css}`

`scripts/dev-watch.mjs` is responsible for creating that plugin directory if missing. It must copy only the built plugin artifacts, never source files, tests, docs, `.env`, or node_modules.

Reload cycle in Obsidian: with the latex vault open, `Cmd+P` → "Reload app without saving" (or toggle the plugin off/on in Settings → Community plugins for a faster partial reload). First run: enable the plugin in Settings → Community plugins (Restricted mode must be off in this vault — it is a dev vault; keep it that way).

# Tests

```bash
npm run test:unit      # vitest run tests/unit — core/, no DOM
npm run test:engine    # vitest + Playwright chromium tests/engine — real <math-field>
npm run test:all       # lint + unit + engine; phase-gate command whose output goes in reports
npm run lint           # eslint incl. the module-boundary rule — failures block gates
```

`tests/engine` loads MathLive in a real browser page; never jsdom (MathLive needs real layout). Battery fixtures live in `tests/fixtures/battery/*.tex` with expected-output siblings `*.expected.tex` and a `tolerance:` header line (`identical` | `cosmetic`) per [[Open Decisions]] D16.

# Driving Obsidian for demos and integration checks

The agent runs on Sam's Mac and may operate the **latex vault's Obsidian window only** (scope rules in [[08 Agent Working Agreements]]).

- Obsidian's developer console (`Cmd+Option+I`) is available for inspecting the CM6 state during debugging; do not ship code that depends on devtools.
- Acceptance demos: perform the phase's demo sequence by real keyboard/mouse in the vault, recording the screen (`Cmd+Shift+5` → record selected window → save to `~/Projects/obsidian-structured-math/docs/reports/`). Name recordings `phase-N-demo.mov`. If recording is blocked after two attempts, D24 permits `phase-N-demo/` containing screenshots, `keystrokes.txt`, and `file-diff.txt`.
- Integration assertions that need file bytes: after a GUI action, read the note file directly from disk and diff against the trace's expected bytes — the file system is the oracle, not the screen.

# Fixture notes in the vault

Create `ObsidianVaults/latex/dev/` containing: `traces.md` (one note reproducing each keystroke trace's starting state), `battery.md` (every battery expression as display math for visual spot-checks), `long-note.md` (100+ equations, Phase 5 performance target). These are committed to the vault repo — they are part of the test apparatus.

# Versions and releases (Phase 6)

`manifest.json` + `versions.json` per Obsidian plugin conventions; GitHub release with `main.js`, `manifest.json`, `styles.css` attached; BRAT-installable from the repo. Tag `v0.1.0` at Phase 6 gate.
