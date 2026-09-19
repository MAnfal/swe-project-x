---
id: templates/chunk
description: Template for a chunk's plan.md — what the implementer reads
---

---
chunk: <NN>
title: <Chunk Title>
branch: <type>/<plan-name>--<chunk-name>
base: <the plan branch — always; chunks are never stacked on each other>
execution: parallel | sequential   # when the branch is cut, not what the PR targets
depends: [] | [NN, NN]
file-limit-waived: false
file-limit-reason: ""
---

# Chunk <NN> — <Title>

<!-- This file lives at plans/<plan-name>/NN-<chunk-name>/plan.md -->

## Context

<Why this change is needed. What's wrong or missing today. Enough that an agent reading
only this file understands the point.>

## Acceptance Criteria

- Given <state>, When <action>, Then <outcome>
- Given <state>, When <action>, Then <outcome>

## What To Do

<The implementation work. This is the implementer's primary instruction set.>

- Prefer a **discovery command** (grep/find) over a hardcoded file list, so the chunk stays
  valid if files move before it executes. Hardcode only stable paths where the path is the
  interface.
- What to change in each matched file.
- Code snippets where the change is non-obvious.
- Edge cases to watch for.

### Tasks

Ordered and individually checkable. The implementer ticks each one as it lands and commits
the updated list, which is what makes a chunk resumable **mid-flight** — a fresh session
reads the boxes instead of re-deriving progress from a diff.

Format: `T### [P] — <verb> <exact file path> — <what changes>`

`[P]` marks a task that can run in parallel with its neighbours: different files, no
dependency on their output. Omit it when the task touches a file another task also touches,
or needs something an earlier task produces.

Order within a chunk: failing tests first, then the types and contracts they need, then the
implementation, then integration, then cleanup.

- [ ] T001 — write failing test `<path>` — <what it asserts, and why it fails today>
- [ ] T002 [P] — create `<path>` — <what it contains>
- [ ] T003 — edit `<path>` — <the change>

A task with no file path is not a task — it is a wish. If you cannot name the file, the
chunk is not planned yet.

<!-- If this chunk has 3+ non-mechanical judgment calls, enumerate them here as:
     "You may X or Y; explain your choice in the completion report." -->

<!-- If this chunk names specific third-party API calls, add: "Verify this API surface
     against the installed package before relying on it." Docs and reality diverge. -->

## Test Plan

Tests come first, and they are seen failing before any implementation exists. A test
written after the code passes on the first run tells you nothing — you never observed it
capable of failing, which is the only thing that makes it evidence.

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |

Order: contract and interface tests, then integration, then unit. Record the red run's
output in the completion report, not just the green one.

If this chunk genuinely has nothing testable (pure types, declarative config, docs), write
`N/A — <reason>` here rather than leaving it blank.

## Reuse Audit

One of: `Reuse: importing <X> from <Y>` / `Consolidation: moving duplicated <X> into <Y>` /
`New: no existing implementation found`.

## Reference Files

Files the implementer must read before starting, with one line on why each matters.

Include the **bible leaf pages** that govern this chunk's work — found by following the
relevant bible's `decision-tree.md`, never by citing the tree itself. The "Why" names the
rule to follow, not "read for context". If no bible page applies, list none; a padded table
teaches the implementer to skim.

| File | Why |
| ---- | --- |
| `.claude/resources/project.md` | Stack, commands, conventions |
| `.claude/resources/bibles/<bible>/<leaf>.md` | <the specific rule this chunk must satisfy> |
| `<path>` | <what rule or pattern it carries> |

## External Dependencies

Packages, services, or APIs this chunk touches, and what it does with each. The
implementer researches current docs for these before implementing.

- `<name>` — <what this chunk does with it>

## Verification Gates

Commands that must all pass. If any fails, the chunk is blocked — do not deliver.

Read `.claude/resources/prompts/gates.md` first. Capture a baseline before running
anything that emits errors, and grade the delta.

```bash
set -e

# Gate 1: <standard gates from .claude/resources/project.md>

# Gate 2: <chunk-specific assertion>
```

**Prove each gate can fail.** Run every gate against the base commit — the tree with none
of this chunk's work applied — and record the exact command, its exit status, and the
failure evidence. If a gate exits 0 on base it proves nothing: revise it and record the
revision.

## Deliverables

- [ ] `completion-report.md` in this directory, **committed**, written from
      `.claude/resources/templates/completion-report.md` — the reviewer reads the file, not
      a relayed summary of it.
- [ ] <anything else this chunk must produce>

## Artifacts Checklist

Mark each: ✓ done, — not needed (with reason), or ☐ to do. A planning-time reminder for
side effects, not a gate.

- ☐ New tests for new behavior
- ☐ Existing tests updated for changed behavior
- ☐ Docs / conventions updated for changed behavior
- ☐ Generated code re-run, if a schema or contract changed
- ☐ `.claude/resources/project.md` updated, if this chunk changed an architecture fact —
      a dependency, a command, a new kind of file, a moved directory, a principle
