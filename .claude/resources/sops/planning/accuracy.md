---
id: sops/planning/accuracy
description: The recurring accuracy defects to check a drafted plan for, before it is presented
---

# SOP: Planning Accuracy Checks

Run over the drafted chunks before presenting the plan. Each of these has shipped more than
once.

## A convention rename needs a whole-tree grep, not a list

For a rename of something that documentation reproduces as examples, do not trust an
enumerated list of files to update. Grep the whole tree for the old form first, then again
after the sweep, and sort the remaining hits into:

- **Stragglers** — still teaching the old form. Update them.
- **Intentional** — counter-examples, forbidden-pattern samples. Leave them, with a note.

The enumerated list always misses the file nobody remembered, and the misses have no
relationship to the listed items beyond mentioning the same concept.

## "Zero occurrences" gates can be unsatisfiable

A gate phrased as "zero occurrences of X" is unsatisfiable when the code legitimately has
no string literal to find — for example when a contract exports typed constructors instead
of string constants. The code fully satisfies the intent and the gate can never pass.

Phrase it as "no **untyped** literals", or exempt the typed positions explicitly. A reviewer
who meets an unsatisfiable gate should grade the substance and flag the phrasing as drift.

## A surface-agnostic criterion needs its surfaces enumerated

When an acceptance criterion's subject is "the operation" rather than a place, the chunk
must list **every surface that can trigger it** — or say "all surfaces" and enumerate them.
Naming one surface in a plan step reads as the scope to the implementer, and the other
callers ship unchanged. That is a plan gap, not an implementer error.

## Cross-path work defaults to the path the author knows

Instrumentation, logging, and migration chunks quietly cover only the path the plan author
had in mind. State the paths in scope explicitly. Absence of an explicit list means **all
paths**, and covering only one requires a justification in the plan.

## Origin

Each section is a defect that reached review or production at least twice.
