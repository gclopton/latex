Plan for **obsidian-structured-math**: an Obsidian plugin that recreates the *functionality* of Mathcha's math editor — structured, keyboard-first, template-driven math editing — while storing nothing but ordinary Markdown with `$...$` / `$$...$$` LaTeX.

# Goal

Type math-heavy lecture notes in class, in Obsidian, at Mathcha speed. The user manipulates fractions, matrices, integrals, and subexpressions as structural objects; LaTeX is the storage and interchange format, never the primary editing surface.

# What success looks like

![[mathcha-derivation-exemplar.png]]

A real worked derivation in Mathcha — the target experience for lecture notes in Obsidian: step-by-step lines built structurally, an empty template awaiting input directly in the document, boxed emphasis around results. Two features visible here are explicitly **v2, not v1 scope**: the `[1] [2] [3]` equation tags/references, and the red/blue coloring of subexpressions. Do not build them in v1; do not break the door to them either.

# Guiding principles

1. **LaTeX is the only source of truth.** Disable the plugin and every note remains valid, readable Markdown + LaTeX. No proprietary blocks, no hidden metadata as canonical state.
2. **Recreate behaviors, not UI.** The contract is [[01 Behavioral Specification]] — Mathcha's *interaction model* (suggestion box, slots, structural clipboard), not its pixels.
3. **Edit in the document, not beside it.** Active equations are edited at their actual inline or display position in the Obsidian note (D26). A popup/modal equation editor is not an acceptable primary workflow.
4. **Keyboard-first.** Every operation reachable without the mouse; the suggestion box preserves input flow (Mathcha's own docs call it "the core of editor").
5. **Never corrupt a note.** LaTeX the editor can't represent survives round-tripping untouched. Serialization is deterministic — no churn when nothing changed.
6. **Engine-agnostic core.** The palette, template registry, clipboard, and CodeMirror layer are built against a small engine interface, so the MathLive-vs-custom decision ([[04 Spikes and Risks]]) is not load-bearing for ~70% of the code.

# Current state

- Dev/test vault: `/Users/gradyclopton/ObsidianVaults/latex` (repo `gclopton/latex`, branch `main`). Plugin repo to be created at `/Users/gradyclopton/Projects/obsidian-structured-math`.
- Reference sources studied: Mathcha Features Document (behavior contract); pinned repo states from D23: `MizarZh/mathlive-in-editor-mode@f47277fc1be0c0920a372bfb8cfcbd5e3b1e543a` (CM6 integration pitfalls, solved); `strangelion/obsidian-formula-library@ed25a986bca72c742dd1d2dc3777b607f0f5c79a` (MIT template catalog, 18 category JSONs); `danzilberdan/obsidian-mathlive@df125634f20443a68209e9b9bf9f83f0ed8f2da7` (modal reference); MathLive API on `mathlive@0.110.0` (D20).
- Key engine route: run Spike A mechanically. A pass uses MathLiveEngine; a conditional pass uses MathLiveEngine with raw-region multiline v1; a fail triggers Spike B and then the D21 routing rule. Do not stop for approval unless both spikes cannot run.

# Doc map (reading order)

1. [[01 Behavioral Specification]] — requirement IDs (BS-xx) and normative keystroke traces (T01–T10). The contract everything else serves.
2. [[02 Architecture]] — layers, the engine interface, CodeMirror integration design, sync strategy.
3. [[03 Template System and Suggestion Box]] — template data model, palette search/ranking/recents, seed catalog import.
4. [[04 Spikes and Risks]] — the week-one spikes that settle the engine question, plus the risk register.
5. [[05 Build Phases]] — ordered phases with acceptance criteria.
6. [[06 Testing Strategy]] — unit, round-trip, integration, and the regression battery.
7. [[07 Repo Conventions and Contracts]] — repo layout, module boundaries, the frozen `EditorEngine` and `MathTemplate` contracts.
8. [[08 Agent Working Agreements]] — autonomy rules for the implementing agent: decision ladder, immutable test contract, phase gates, machine scope. **Read every session.**
9. [[09 Dev Environment and Build Loop]] — exact setup, build, test, and demo-recording commands.
10. [[10 Core Template Catalog]] — the hand-authored structural templates, normative LaTeX strings.
11. [[11 Spike A Battery]] — the 40-expression battery with tolerance classes and pass rule.
12. [[12 Review Checkpoints]] — the deliberate Sam/Claude inspection gates, with evidence and pass/fail expectations.
13. `decisions/` — [[Open Decisions]] (D01-D26 approved) plus any AGENT-DECIDED or SPEC-BUG notes made during the build.

All decisions needed to start the build are closed (D01-D26 approved 2026-08-03). The build is specified for unsupervised execution under the working agreements.

# Out of scope (v1)

Mathcha's drawing area, handwriting symbol recognition, picture boxes, document management, chemistry, and free-position canvas. Equation tags/references are a designated v2 feature. OCR is explicitly not a goal (exists in other plugins).
