---
name: adr-distill
description: Distills a planning doc, proposal, or design spec into an Architecture Decision Record (ADR) under docs/adr/, verifying the ADR against the actual implementation and recording any deltas. Use when the user wants to turn a proposal into an ADR, preserve a design decision in version history, or reconcile a decision record with shipped code.
---

# ADR Distill

Turn a planning/proposal/design document into a permanent Architecture Decision Record, aligned with the code as it actually exists.

## When to use

- The user asks to "distill", "convert", or "summarize" a doc into an ADR or decision record.
- A proposal in `docs/` has been (partially) implemented and its decision should be preserved in version history.
- An existing ADR needs to be checked against the implementation and updated.

Do NOT use this skill to write ADRs for decisions that have no source material — ask the user for context instead.

## Conventions in this project

- ADRs live in `docs/adr/` and are named `NNNN-short-title.md` with zero-padded sequential numbers (e.g. `0001-procedural-resident-characters.md`). Check `docs/adr/` for the next available number.
- ADRs are immutable decision records: when a decision is reversed, write a new ADR that supersedes the old one rather than editing history. Updating an *unshipped* ADR's accuracy (as below) is fine.
- Keep the source proposal file intact unless the user asks otherwise; link to it from the ADR via a `Source proposal:` line.
- If the proposal references files by path (images, modules) that have moved, update the references.

## Structure

Use `template.md` in this skill's directory as the ADR skeleton. Sections:

1. **Header**: title, `Status` (Proposed/Accepted/Superseded), `Date`, `Source proposal` link.
2. **Context**: the problem and the hard constraints that force a decision. Pull from the proposal's "Current State", "Goals", and non-goals. Keep it to what a future reader needs to understand the decision — not the full history.
3. **Decision**: what was decided, stated concretely, including key design boundaries and quantitative targets (performance budgets, size limits). This is the core of the ADR.
4. **Alternatives considered**: a table of rejected options with *why each was rejected*. This is the highest-value section for future readers — preserve the reasoning, especially version- or platform-specific caveats (e.g. extension support, dependency constraints).
5. **Consequences**: what becomes easier, what becomes harder or ruled out, and any load-bearing risks with their mitigations.

## Process

1. **Read the source doc fully.** Identify the decision, rationale, rejected alternatives, constraints, and quantitative targets.
2. **Verify against the implementation.** Do not trust the proposal blindly. Grep/read the referenced modules to check:
   - Do the proposed types/interfaces exist? Are they persisted as described, or derived/recomputed?
   - Does the runtime architecture match (pools, managers, render paths)?
   - Were proposed mechanisms (compaction strategies, counters, proxies, migration plans) actually built, or replaced with something simpler/different?
   - Do referenced file paths still exist?
3. **Record every mismatch as an explicit delta.** In the Decision section, mark deviations with "**Delta from proposal:**" and explain what was actually done. If a delta introduces a new risk (e.g. recomputing instead of persisting creates a backward-compat hazard), add it to Consequences.
4. **Drop implementation detail** that belongs in tickets or code: delivery phases, task lists, test plans, file-by-file integration notes, risks that never materialized. The ADR records *what was decided and why*, not *how the work was scheduled*.
5. **Write the ADR** from `template.md`, keeping it to roughly one screen of prose plus the alternatives table.
6. **Check the README and other top-level docs for staleness.** An accepted ADR often invalidates user-facing claims. Read `README.md` (and `ROADMAP.md` / `notes.md` if relevant) and verify:
   - Feature descriptions still match the decision (e.g. architecture bullets, "how it works" claims).
   - The project-structure tree lists new modules introduced by the decision and doesn't describe removed responsibilities.
   Update what is stale, and where the README describes architecture, link to the ADR (e.g. `docs/adr/0001-....md`) so the README stays a summary and the ADR holds the rationale. Don't add ADR links to purely user-facing sections (controls, getting started) that don't discuss internals.
7. **Report** the deltas you found, the ADR path, any README/docs updates made, and suggest the appropriate status (`Accepted` if implemented, `Proposed` if not yet built). Only set the status the user asked for, or propose it as a follow-up.

## Tone

Write for a future reader who was not in the room: state decisions as facts, reasons as they were known at the time, and deltas honestly. Prefer short declarative sentences over preserving the proposal's phrasing.
