# ADR NNNN: <short decision title>

Status: <Proposed | Accepted | Superseded by ADR-XXXX>
Date: <YYYY-MM-DD>
Source proposal: `<path/to/source-doc.md>`

## Context

<The problem that forced a decision, in a few sentences. Then the hard constraints as a bullet list: invariants that must hold, budgets, compatibility requirements, things explicitly out of scope.>

Constraints:

- <invariant or requirement>
- <invariant or requirement>

## Decision

<What was decided, stated concretely and completely enough that a reader could recognize whether the code follows it. Include key design boundaries (one sentence, bolded if it's the crux) and quantitative targets.>

<If the implementation diverged from the source proposal, note each divergence inline:>

- **Delta from proposal:** <what was actually done instead, and why if known>.

## Alternatives considered

| Candidate | Why not selected |
|---|---|
| <option> | <rejection reason; preserve platform/version-specific caveats> |
| <option> | <rejection reason> |

## Consequences

Easier:

- <benefit unlocked by this decision>

Harder / ruled out:

- <cost, limitation, or non-goal this decision locks in>
- <load-bearing risk and its mitigation>
