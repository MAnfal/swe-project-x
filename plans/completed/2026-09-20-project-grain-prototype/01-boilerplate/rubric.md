<!-- The reviewer reads this. The implementer never does. Items state the RULE being
     verified, not an example copied from the plan. -->

# Chunk 01 — Boilerplate — Review Rubric

Grade each item PASS, FAIL, or N/A with the reason. A FAIL needs the evidence that
produced it: the file, the line, and what's wrong.

Items carrying a `.claude/resources/bibles/…` path cite the rule they check. **Open the
page before grading that item** — a cited rule graded from memory fails correct work as
often as it passes a violation.

## Universal Checks

- [ ] The change does what the acceptance criteria say, verified by reading the code — not
      by trusting the report
- [ ] Every verification gate was run **after the last edit**, and each one can actually
      fail (a gate that passes on the base tree proves nothing)
- [ ] New behavior has tests covering the happy path, the error path, and the edges
- [ ] `completion-report.md` exists and is committed — without it the evidence below
      cannot be graded
- [ ] The tests were observed failing before the implementation existed, and the report
      shows the red run — not just the green one
- [ ] Any abstraction introduced is justified in the plan's Design Decisions; no layer,
      base class, or indirection appears that the chunk didn't need
- [ ] No principle in `.claude/resources/project.md` is violated without a recorded
      justification
- [ ] No unrelated files touched; no scope beyond the chunk
- [ ] No secrets, credentials, or keys in the diff
- [ ] No silent failures — errors surface with context rather than being swallowed
- [ ] No duplicated logic that an existing helper already covers
- [ ] Error and warning counts are graded against the captured baseline, not absolutely
- [ ] Comments and docs the change touches are still true after it

## Test Coverage Checks

- [ ] A spec exists at the location the project documents for specs, and the report shows
      the runner discovering and executing it — not merely exiting zero

## Chunk-Specific Checks

- [ ] The application starts, and every gate command recorded in `project.md` was run and
      exited zero; the report gives each exact invocation, not a description of it
- [ ] Every version in `project.md`'s Stack was read from what is installed on disk, with
      the date read — not copied from a manifest range or from the plan
- [ ] The Commands table has no placeholder row: each cell is a runnable invocation or an
      explicit `N/A`
- [ ] Principles are rules a reviewer could block a PR over, each stating what it forbids;
      they cover secrets reaching the client, model calls in the render path, request-time
      filesystem or git dependencies, and hand-authored data standing in for captured
      pipeline output
- [ ] The Convention Map has a row per kind of file the project will contain, and rows
      covering test specs and data fixtures cite
      `.claude/resources/bibles/swe/testing.md`
- [ ] The Test file convention names where specs live and matches the runner's include
      pattern — verified against a real file, not asserted
- [ ] `.gitignore` was extended, not replaced: the pre-existing worktree entry survives
- [ ] `.env.example` is committed with empty values; no `.env` file and no dependency
      directory is tracked
- [ ] Configuration the scaffolder already provides was not hand-rewritten
- [ ] No product code ships in this chunk — no ingest, schema, canvas, or route handler
- [ ] The judgment calls the plan enumerated are each explained in the completion report

## Verdict

**PASS** or **FAIL**, then:

- **Issues** — blocking problems, each with file, line, and what's wrong
- **Warnings** — non-blocking, worth fixing
- **Guidance** — what the next iteration should do first

Return this verdict as your final response text. Anything that must survive the review
goes in a file in the chunk directory — a message is not an artifact.
