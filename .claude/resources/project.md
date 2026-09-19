---
id: resources/project
description: The living record of what this project is — stack, commands, principles, conventions. Every phase of the loop reads it; plans keep it current.
---

# Project Facts

**This file is the single source of truth for what the project looks like.** Every phase of
the loop reads it, and nothing else in `.claude/` names a language, a framework, or a
command — they all defer here. Swap this file and the same framework drives a different
stack unchanged.

Keep it short and true. Delete what does not apply rather than leaving a placeholder that
reads as a fact.

## How this file stays current

It is written and maintained by the loop, not filled in once and left:

| When | Who | What changes |
| ---- | --- | ------------ |
| Before the first plan, if the stack is already known | You | Stack, Commands, Principles |
| Chunk 01 of a bootstrap plan, if it isn't | That chunk, as its deliverable | Stack, Commands, Principles, Convention Map, Layout |
| During a chunk that changes an architecture fact | The implementer, **in the same chunk** | Whichever section the change made false |
| At each wave boundary | The lead | Anything the merged wave invalidated |
| At delivery | `/plan:complete` Part 2 | Conventions learned, gotchas, promoted tribal knowledge |

**An architecture fact changed by a chunk is updated by that chunk.** A new dependency, a
new command, a new kind of file, a moved directory, a new principle — these are not
delivery-time cleanup. A stale Convention Map is read by `generate-chunk-rubric` when it
builds the *next* chunk's rubric, so staleness here compounds into unreviewed work.

**Every claim here is measured, never assumed.** Read versions off what is installed on
disk, and run each command before writing it into the table.
`.claude/resources/prompts/evidence.md` binds this file as much as any plan.

## Stack

<!-- Language, runtime, framework, package manager, test framework — each with the version
     actually resolved on disk, and the date it was read. Not the manifest's ranges. -->

- **Language / runtime**:
- **Package manager**:
- **Test framework**:

## Commands

The verification gates run these. Use the exact invocation, not a description of it. Mark
anything that does not exist yet as `N/A` — a gate skips an `N/A` command rather than
inventing one.

**Bootstrap** is what makes a newly created worktree able to run the gates: installing or
symlinking dependencies, linking gitignored files the app needs (`.env` and friends), and
any codegen. It runs once per worktree, before an implementer is dispatched into it. Get
this wrong and every chunk's first gate run fails for reasons unrelated to its work.

<!-- State where commands run from if it is not the repository root. -->

| Gate | Command |
| ---- | ------- |
| Install | |
| Bootstrap a fresh worktree | |
| Type check | |
| Lint | |
| Unit tests | |
| Build | |
| Run the app | |

<!-- Record any command whose behaviour is surprising — an exit code that does not mean
     what it looks like, a needle that can never fail, a scope that is narrower than it
     appears. A gate written against the assumption instead of the measurement is vacuous. -->

## Principles

The project's constitution: the rules a plan is checked against before it's approved, and
that a reviewer can cite. Keep the list short — five or six you would actually block a PR
over. Each one is a rule, not an aspiration, and each says what it forbids and what a
violation looks like.

Amend deliberately: a principle changed mid-plan invalidates the reasoning of every chunk
approved under it, so record the date and the reason when one changes, and note which
version each plan was checked against.

<!-- Until this section has content, plan-check Step 3b has nothing to check against and
     the rubric's "no principle violated" item grades N/A. That is the expected state for a
     bootstrap plan's first chunk and nowhere else. -->

1.

A chunk that violates a principle needs an explicit justification in the plan's Design
Decisions, or it doesn't ship. "This was easier" is not a justification.

## Convention Map

What each kind of file must satisfy. The `generate-chunk-rubric` skill reads this to build
each chunk's review checks, and the gates listed here are what a chunk touching that area
runs. A path matching several rows collects all of their checks.

Fill it in as the project grows — an empty map means every rubric is only as good as what
the planner remembered that day, and `generate-chunk-rubric` will say so out loud rather
than emit a thin rubric silently.

Globs are written relative to the repository root.

**The `Doc` column points at a bible leaf page** under `.claude/resources/bibles/` — the
page carrying the rule, found by following that bible's `decision-tree.md`. Never cite the
decision-tree itself; a reviewer handed a routing table grades from memory. Use `—` when no
page applies, and the review check ships without a citation rather than with an invented
one.

| Files | Gates | Review checks | Doc |
| ----- | ----- | ------------- | --- |
| | | | |

<!-- Rows worth adding once the stack exists, as illustrations of the shape:

| `src/**/*.service.*` | <test>, <lint> | interface-first; the contract is its own module
  and the implementation declares it | `.claude/resources/bibles/swe/patterns/service-design.md` |
| `.claude/**/*.md` | `—` | frontmatter matches the documented schema; SKILL.md under 500
  lines; description leads with the use case | `.claude/resources/bibles/prompt-engineering/decision-tree.md` |
-->

**Anything under `.claude/` is governed by the prompt-engineering bible** whether or not a
row above matches it. `generate-chunk-rubric` adds those citations on its own — see that
skill's "When the chunk touches `.claude/` itself".

**Test file convention**: <!-- where specs live, how they are named, and what the runner's
include patterns actually match. A spec the runner never matches passes by not running. -->

## Conventions

Things an implementing agent would otherwise get wrong. Add to this as they surface — a
convention learned during execution belongs here in the same change that learned it, not in
a follow-up.

-

## Layout

Where things live, and what belongs where.

```
```

<!-- Call out the boundaries the Principles police, so a reader can tell which side of a
     line a new file belongs on. -->
