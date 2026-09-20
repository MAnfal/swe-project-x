---
id: templates/completion-report
description: Template for a chunk's completion-report.md — the implementer's evidence, read directly by the reviewer
---

# Chunk <NN> — Completion Report

<!-- Written by the implementer, committed with the chunk. The reviewer reads THIS FILE,
     not a relayed summary of it — a claim that only exists in a message cannot be graded
     and will be flagged as having no written artifact. -->

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `<path>` | <created / edited / deleted> | <what it does now> |

## Acceptance criteria

One row per criterion from the chunk plan. "Met" is not a verdict on its own — name the
thing a reader can open or run to see it for themselves.

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| Given …, When …, Then … | yes | `<test name>` in `<path>`, or the command and its output |

## Tests

Red first, then green. A test that has never been observed failing is not evidence that it
checks anything, so both runs go here.

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| `<test name>` | <the failure, verbatim> | <pass> |

**Say which kind of red each one was.** A suite that failed to *import* proves only that
the module was absent — tests-first ordering guarantees that for free, and `0 tests
collected` is an import error wearing a red run's clothes. An assertion that failed
against a *wrong value* is the one that proves the test discriminates. For every guarantee
the plan calls a contract, show the assertion failing against a **plausible wrong
implementation**:

| Contract | Mutation applied | What went red |
| -------- | ---------------- | ------------- |
| <the guarantee> | <the line broken, and how> | <the test name and its assertion> |

If this chunk had nothing testable, say which of types / declarative config / docs it was,
and why that leaves nothing to assert.

## Gates

For each gate in the chunk plan: the exact command, its output, and the base-tree
falsification — the gate run against the tree *without* this chunk's work, which must fail
there. A gate that passes on the base tree asserts something already true.

| Gate | Command | Result | Fails on base? |
| ---- | ------- | ------ | -------------- |
| <name> | `<command>` | <output> | <the command's exit status and the failure it produced> |

Baseline captured at `<path>`: <N errors, M warnings> before this chunk. Gate results above
are the delta against it, not absolute counts.

### If this report quotes a transcript, it carries a self-check

Every verification gate checks the *code*. Nothing checks that the report describes what
the code did — and the reviewer grades several items against the report. A hand-typed
payload is the one piece of evidence in this loop with no falsification behind it.

So: **do not hand-transcribe a response.** Capture each one to its own path and generate
the report block from those files.

- One `curl -o <distinct-path>` per response, plus `-w '%{http_code} %{time_total}'` into
  a `.meta` file, so status and timing are the tool's rather than remembered.
- For any two responses presented as **differing**, run `diff a b` and show its exit
  status. Exit 0 there is the check that catches a duplicated paste — the failure mode is
  a "before and after" pair where both halves are the same body and the prose beneath
  claims they differ.
- Emit the block from the captured files with a script, not by copying them by hand.
- A computed view — a key list, a field comparison, a formatted payload — is produced by
  **running** the command shown, never by reformatting the data in another language.
  Serializers disagree about separators, and the output then claims a provenance it
  doesn't have.
- State in the report that the self-check ran, and prove it is non-vacuous the same way a
  gate does: run it against a tree where it should fail and show that it does.

| Quoted payload | Captured at | Self-check |
| -------------- | ----------- | ---------- |
| <what it shows> | `<path>` | <the command and its exit status> |

## Judgment calls

Every decision the chunk plan asked to be explained, and anything chosen where a reader
would reasonably expect something else.

- **<Decision>** — chose <X> over <Y> because <the constraint that made it right>.

## Deviations from the plan

What the plan said, what was actually done, and why. A plan that turned out to be wrong is
normal and useful — the measurement wins, and this is where the next planner learns it.

- **<What the plan assumed>** — actually <what was true>. <What was done instead.>

## Left alone

Adjacent problems noticed and deliberately not fixed, so the reviewer doesn't read them as
oversights and the next plan can pick them up.

- <what, and where>
