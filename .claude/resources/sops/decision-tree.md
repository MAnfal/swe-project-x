---
id: sops/decision-tree
description: Routing table for standard operating procedures — match the task, read the SOP, follow it
---

# SOPs — Decision Tree

Standard operating procedures define **how** to perform a specific operation. Prompts say
when; SOPs say how; bibles say what good looks like. They are procedures, not suggestions.

**Looking for a standard rather than a procedure?** That's the bibles —
`.claude/resources/bibles/README.md`. An SOP is a sequence you run once at a known moment
("before planning a rename, do these four greps"); a bible page is a rule that holds
whenever you're in its territory ("an orchestrator contains no domain logic"). If you want
to know *what shape the answer should be*, you want a bible.

## Who reads these, and when

- **Planners** — every applicable Planning SOP, during planning Phase 2.5.
- **Implementers** — check for an applicable SOP before starting a chunk.
- **Rubric generation** — link the relevant SOP as a conditional review check.

## Planning SOPs

Run during plan authoring, before the plan is presented for approval.

| I need to… | Read |
| ---------- | ---- |
| Write a verification gate that calls a script or package command | `planning/verify-tooling-commands.md` |
| Plan a deletion, rename, or cleanup sweep | `planning/grep-pattern-checklist.md` |
| List the files a chunk should touch | `planning/dynamic-discovery.md` |
| Plan a "create X" deliverable | `planning/audit-before-create.md` |
| Introduce a new utility, helper, or abstraction | `planning/reuse-audit.md` |
| Assert a file exists ("replaces", "modifies", "updates the stub at", "delete") | `planning/verify-file-references.md` |
| Turn request or source data into object keys, or drop an upstream guarantee | `planning/boundary-validation.md` |
| Check a drafted plan for the recurring accuracy defects | `planning/accuracy.md` |

## Implementation SOPs

Follow during chunk execution when the task matches.

| I need to… | Read |
| ---------- | ---- |
| Move, rename, or extract files | `implementation/file-move-checklist.md` |

## Adding one

Create the file under `planning/` or `implementation/`, add a routing row above, and — if
it came from a retro finding — say so in its Origin section. An SOP with no routing row is
an SOP nobody will find.
