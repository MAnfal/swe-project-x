# Project

**Grain** gives a codeowner a time-scrubbable map of their domain: an infinite canvas of a
monorepo's packages, a slider over the repository's history, and three levels of disclosure
— which packages changed, what each change was and how it was approached, and the ordered
steps that produced it. It reports; it never blocks, gates, or judges. Deployed prototype,
built for the owner of a package who has been away from the code.

## How work happens here

Non-trivial work runs through the spec-driven loop in `.claude/`:

```
/plan:brainstorm  →  /plan:execute  →  /plan:complete
```

- **Start at `/plan:brainstorm`.** It explores the idea with you and — once you
  approve — writes the plan. Don't improvise a plan instead; the loop exists because
  unplanned multi-file changes are the ones that turn out unreviewable.
- `/plan:list` shows what's active and numbers it; `/plan:execute <#>` runs an
  approved plan and `/plan:complete <#>` ships and closes it.

Read `.claude/README.md` for the loop, and `.claude/resources/project.md` for this
project's principles, commands, and conventions. **Read `project.md` before writing code**
— it holds the rules a reviewer will cite.

## Non-negotiables

These hold whether or not a plan is running:

1. **Tests first, and seen failing.** A test that has never been observed red is not
   evidence that it checks anything.
2. **Evidence, not claims.** "Tests pass" is a claim; the command and its output is
   evidence. A capped or scoped search proves presence, never absence.
3. **Reuse before invention.** Grep for an existing helper before writing a new one.
4. **Never merge your own PR.** The PR is the review surface; the user merges.
5. **Scope is what was asked.** Adjacent problems get reported, not fixed.

## Stack and commands

**`.claude/resources/project.md` holds them.** Stack and versions, the command table the
verification gates run, the Principles, the Convention Map, and the conventions an
implementer would otherwise get wrong — all in one file, kept current by the chunk that
changes each fact.

This file deliberately does **not** restate them. Two copies of a command table drift, and
the copy a session happens to read first wins.

## Recent Work

<!-- One line per completed plan, newest first. Added by /plan:complete. -->

- **Project Grain prototype delivered** 2026-09-20 (`plans/completed/2026-09-20-project-grain-prototype/`):
  six chunks, US1 and US2 both demoed. `project.md` is written and current — stack,
  commands, Principles, Convention Map and Layout all live there, not here. The retro's 21
  framework updates were applied in the same close-out; read its Part 2 before planning
  the next one.
- **Knowledge layer added** 2026-09-19: `.claude/resources/bibles/` holds the engineering
  and prompt-authoring standards the loop cites. Brainstorm, planning, rubric generation,
  implementation and review all route through it.

## Communication instructions.
- Keep your messages short, concise and reflect the user's voice and tone. An ideal response back to the user is 1 - 2 sentences long, states the high level concern and waits for the user for clarifying  question. Only go in details if the user asks you to but treat the depth as layered and reveal more details in layers not at once. 