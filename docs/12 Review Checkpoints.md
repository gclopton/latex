# Checkpoint 1 — Spike A MathLive Fidelity

This checkpoint happens after the Phase 0 MathLive spike is complete and before the implementation commits fully to the MathLive engine path. The purpose is not to re-debate the whole architecture; it is to confirm that the chosen engine can support the kind of structured, in-document editing Sam wants without corrupting the LaTeX that remains the source of truth.

The implementing agent must provide a written spike report under `docs/reports/`, the generated `results.json`, the 40 battery fixtures, and either a screen recording or D24 fallback evidence for the manual checks. The report must say whether Spike A passed, conditionally passed, or failed under the mechanical D17/D21 rules. It must also list every destructive round-trip, every cosmetic diff, every raw-region fallback, and every expression that did not feel natural to edit.

Sam should inspect this checkpoint by looking at the behavior, not just the score. The key question is whether nested fractions, integrals, matrices, `cases`, `aligned`, scripts, brackets, and physics-style notation feel editable as structures rather than as LaTeX strings. Sam should especially check whether the manual edits resemble the Mathcha screenshots: placeholders visible, cursor movement predictable, and templates inserted into the current equation rather than into a detached editor.

Claude should inspect the spike report for technical interpretation. The main things to evaluate are whether the pass/fail classification is honest, whether any cosmetic diff is truly harmless, whether raw-region fallback is being overused, and whether a conditional pass still leaves a viable v1. Claude should also check whether the implementation is following D21 rather than inventing a new engine route.

This checkpoint blocks moving forward only if the spike result invalidates the selected engine path and the D21 fallback route also cannot proceed. Otherwise, the agent records the decision and continues.

# Checkpoint 2 — Phase 2 In-Document Editing MVP

This is the most important early product checkpoint. It happens after the plugin can create, activate, edit, commit, revert, and reactivate inline and display equations inside the Obsidian document. This checkpoint exists because a popup/modal equation editor would miss the core requirement, even if it technically edits LaTeX.

The implementing agent must demonstrate an inline workflow in the actual `latex` vault: open a normal note, type `$`, create an active inline mathfield at the cursor, build `v=\frac{s}{t}` structurally without exposing raw LaTeX as the primary editing surface, arrow out to the right, and continue typing prose on the same line. The same demo must show reactivation by arrow-entry or click, Escape reverting to the activation-time value, and note-level undo collapsing the committed equation edit into one Obsidian history step.

The implementing agent must also demonstrate a display workflow: create or activate a display equation in its document block, edit it structurally in place, and commit it back to clean `$$...$$` Markdown. The display editor may grow vertically for matrices or aligned content, but it must scroll with the note and behave like part of the note. It must not appear as a separate workspace, modal, or detached editor pane.

Sam should inspect this checkpoint hands-on. The decisive question is whether the editor feels like Mathcha in the way that matters: the equation is where the equation belongs, the surrounding prose remains part of the same writing flow, and leaving the equation feels like moving the caret through a document rather than saving from a dialog.

Claude should inspect the CodeMirror integration and sync logic. The important risks are range drift, document corruption, widget remounting while typing, undo-stack conflict, focus loss, and any hidden modal implementation path. `Modal` usage for primary inline/display editing is a build failure under D26 and [[07 Repo Conventions and Contracts]].

This checkpoint should not be considered passed until file-byte checks prove that clean LaTeX is stored, activation/deactivation without edits is byte-neutral, and edits outside the active equation do not rewrite unrelated math.

# Checkpoint 3 — Phase 3 Template Palette Integration

This checkpoint happens after the suggestion box is wired into both text mode and active math mode. The purpose is to verify the core speed loop: the user can call templates by typing `\`, search quickly, insert the desired structure, fill placeholders, and keep moving without touching raw LaTeX.

The implementing agent must demonstrate the palette opening at the caret, not in an unrelated part of the screen. In math mode, it must insert templates into the active in-document mathfield. In text mode, it must offer entries such as inline math, math container, align, and gather. The typed query must never leak into the note or equation after insertion or cancellation.

The demo must cover search, keyboard navigation, Enter insertion, Escape cancellation, recents, frequency ranking, aliases, rendered previews, placeholder focus, `^` and `_` shortcuts, and Shift+Enter expanded insertion for large-operator templates under D19. It must also show inserting a template inside another template, such as an integral inside a matrix cell or a fraction inside an integral bound.

Sam should inspect whether the palette feels fast enough for class notes. The exact visual design does not have to match Mathcha pixel-for-pixel, but the workflow should match the Mathcha screenshots: palette near the caret, visible previews/placeholders, quick filtering, keyboard-first insertion, and immediate return to the active equation.

Claude should inspect the template schema, ranking implementation, persistence model, and catalog merge logic. The main question is whether the system can scale from a curated core catalog to hundreds or thousands of symbols/templates without becoming slow, noisy, or hard to extend.

This checkpoint should produce a short report listing any templates that are still awkward to insert, any ranking problems noticed during real use, and any missing physics/mechanics aliases that should be added before serious testing.

# Checkpoint 4 — Phase 4 Structures and Structural Clipboard

This checkpoint happens after the plugin supports the workflows that make Mathcha much faster than plain LaTeX: nesting templates, editing matrices and cases structurally, copying subexpressions as structures, and pasting them into other structures without flattening them into inert text.

The implementing agent must demonstrate building a matrix of integrals, copying one integral, pasting it into multiple other cells, and then continuing to edit the pasted integrals through placeholders and structural navigation. The demo must also show converting among `pmatrix`, `bmatrix`, `cases`, and related environments; adding and deleting rows or columns; using Enter and Tab correctly inside matrix-like structures; and pasting external LaTeX into an active slot as editable structure when possible.

Sam should test this checkpoint with real theoretical mechanics or physics expressions, not toy algebra alone. Good candidates include indexed tensors, variational derivatives, Hamiltonian or Lagrangian expressions, Poisson brackets, matrix-valued operators, nested integrals, and repeated substitutions. The review question is whether copy/paste and nesting actually reduce writing time compared with raw LaTeX.

Claude should inspect the structural clipboard design, serialization rules, environment mutation code, and tests around nested structures. The main risks are losing placeholder state, corrupting matrix row/column structure, serializing copied content differently depending on where it is pasted, and making copy/paste work only for simple cases.

This checkpoint should not pass unless copied structures remain editable after paste, serialization is deterministic, and the same operation works inside nested templates as well as at the top level of an equation.

# Checkpoint 5 — Phase 5 Hardening and Real-Use Readiness

This checkpoint happens after the full editor path works and the agent has focused on reliability. The purpose is to decide whether the plugin is safe enough to use in live class or research notes where losing momentum or corrupting notation would be unacceptable.

The implementing agent must run the full automated suite: unit tests, engine round-trip tests, structural operation tests, scanner tests, integration file-byte tests, and the full regression battery through the in-editor path. The agent must also perform GUI QA in the `latex` vault with a long note containing at least 100 equations, split panes showing the same note, switching files mid-edit, Escape/undo/redo checks, activation from both sides, click activation, boundary exits, palette cancellation, and raw-region preservation.

Sam should inspect the plugin by taking actual notes for a short session. The review should focus on trust and speed: whether equations remain readable, whether the caret behaves predictably, whether undo feels safe, whether long notes stay responsive, and whether the escape hatch to raw LaTeX is available without becoming the normal workflow.

Claude should inspect the hardening report and code paths that protect user data. The highest-risk areas are immediate versus deferred commit, byte-neutral activation, raw-region preservation, synchronization after external edits, performance in long notes, and private CodeMirror API usage.

This checkpoint should produce a known-limitations report. Any limitation that could silently corrupt notes, strand the cursor, destroy unusual LaTeX, or make the editor unusable during a lecture blocks release. Cosmetic limitations, missing v2 conveniences, and unsupported exotic structures can ship only if they preserve source bytes and are documented.

# Checkpoint 6 — Phase 6 Release Packaging

This checkpoint happens after the plugin is functionally ready and before treating it as installable outside the development vault. It is mostly a repository, packaging, and reproducibility review.

The implementing agent must verify that `manifest.json`, `versions.json`, build scripts, release artifacts, README, and BRAT installation path are correct. A fresh vault install must work with zero configuration. The release artifact must contain only the expected plugin files: `main.js`, `manifest.json`, and `styles.css`, plus any intentionally required assets. It must not contain tests, docs, source maps unless intentionally chosen, `.env`, local vault data, API keys, or development-only files.

Sam should inspect the install flow and first-run behavior. The useful question is whether a future reinstall or fresh vault setup would be straightforward without remembering hidden local steps.

Claude should inspect packaging correctness, repository cleanliness, versioning, release notes, and whether the README accurately describes the current behavior without promising v2 features. Claude should also check for security or privacy mistakes such as network calls, telemetry, accidental local paths, or bundled secrets.

This checkpoint passes when the plugin installs cleanly in a fresh vault, the release is reproducible from the committed source, and the development vault is no longer the only environment where the plugin works.
