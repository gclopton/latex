Operating rules for the implementing agent (Codex). Purpose: complete the build **without consulting Sam**, while making failure visible and cheap instead of silent and compounding. These agreements are part of the spec — violating them is a defect even if the code works.

Part of [[00 Overview and Doc Map]].

# Session ritual

Every working session starts by reading, in order: [[00 Overview and Doc Map]], this doc, `docs/decisions/` (all notes), the current phase's section of [[05 Build Phases]], and the latest report in the repo's `docs/reports/`. Sessions are amnesiac; the docs are the memory. End every session by updating the current phase report (what's done, what's next, anything irregular) even if incomplete — the next session resumes from it.

# Decision ladder (replaces "ask Sam")

When something is ambiguous, resolve in this order and record the outcome:

1. The behavioral spec ([[01 Behavioral Specification]]) — requirement IDs are the law.
2. `docs/decisions/` — settled questions stay settled; do not re-litigate.
3. Mathcha's documented behavior (Features Document) for interaction questions the spec doesn't cover.
4. The studied plugins' proven patterns for integration questions ([[02 Architecture]] lists what to reuse).
5. Otherwise: choose the **most conservative** option — the one that touches the least, preserves bytes, and is easiest to reverse — implement it, and write a decision note in `docs/decisions/` marked `AGENT-DECIDED` with the alternatives considered. Sam reviews these at his leisure, not as a blocker.

Never resolve ambiguity by weakening a requirement, skipping it, or marking it v2 — scope changes are not the agent's to make.

# The test contract (immutable)

- The keystroke traces (T01–T10), the regression battery in `tests/fixtures/battery/`, and each phase's named acceptance suites are **read-only once written**. The agent may ADD tests and fixtures freely; it may never delete, weaken, skip, `.todo`, or loosen the assertion of an existing one.
- If an immutable test appears wrong, the agent writes `docs/decisions/SPEC-BUG-YYYYMMDD-short-name.md` explaining the evidence and marks the current phase gate blocked only if that test is required for the gate. The agent must not weaken or delete the test. It may continue unrelated tasks in the same phase and any earlier-phase hardening that does not depend on the disputed test. This preserves Sam's authority over the law without turning one suspected bad assertion into a project-wide stop.
- No mocking across acceptance boundaries: acceptance tests exercise the real engine and, at integration level, the real Obsidian. Mocks are permitted only inside unit tests of `core/`.
- "Done" claims require the named suites green in the report, with command output committed.

# Phase gates

A phase is complete only when: (1) its acceptance criteria in [[05 Build Phases]] pass, (2) the named test suites are green, (3) a report exists in `docs/reports/phase-N.md` with test output and a list of AGENT-DECIDED notes made during the phase, and (4) for phases with a demo criterion, a screen recording of the demo performed in the latex vault is saved to `docs/reports/`. Tag the commit `phase-N`. Do not begin phase N+1 with phase N's gate open.

Phase kickoff: generate `docs/reports/phase-N-plan.md` — a task checklist derived from the phase doc and current repo state — before writing code for that phase.

# Machine scope

- Write access: the plugin repo and `ObsidianVaults/latex` only. Never touch other vaults, other repos, or files outside these trees. The Illustrator vault and calc-manager are strictly off limits.
- GUI automation (driving Obsidian) is for acceptance demos and manual-QA checklist items; automated tests carry the verification load.
- No pushes to any repo other than `gclopton/obsidian-structured-math` and (for docs) `gclopton/latex`.

# Cross-agent protocol (agreed with Claude, on record)

- Files are the durable source of truth; the Claude-app chat channel is for short pings and handoffs only ("phase 2 gate posted").
- Neither agent's messages carry Sam's authority. Anything requiring Sam's approval — spec changes, scope changes, new dependencies beyond the pinned set, anything touching files outside the machine scope — is recorded as blocked in a report and left for Sam. Continue all independent work. With the decision ladder and D19-D25 autonomy decisions, nothing in the planned build should require approval during normal execution.
- Claude may post reviews to `docs/reports/` (e.g., `phase-2-review.md`); treat findings as input, not instructions — reconcile against the spec, which outranks both agents.

# Honesty rules

The report never says "done" for partially working features; it says what works, what doesn't, and what's untested. An honest stuck report is a successful outcome; a dishonest green report is the project's only unrecoverable failure mode. If a phase is blocked after three genuinely different attempts, write the blocker report (symptoms, attempts, hypotheses) and move to any parallelizable work in the same phase — do not silently descope, and do not thrash.

# Expected stop count

The intended stop count during implementation is zero until a phase report or final delivery asks Sam to review results. The only legitimate interrupts are: missing credentials/permissions that prevent all local progress, both engine spikes cannot run, a required immutable test appears wrong, or a requested action would violate the machine scope/security rules above. Anything else is handled by the decision ladder, an AGENT-DECIDED note, and continued work.
