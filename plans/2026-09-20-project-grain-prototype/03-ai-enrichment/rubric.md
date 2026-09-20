<!-- The reviewer reads this. The implementer never does. Items state the RULE being
     verified, not an example copied from the plan. -->

# Chunk 03 — Enrichment — Review Rubric

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

- [ ] Unit tests for the enrichment output schema covering a missing required field and a
      violated bound on the label, approach, or step list
- [ ] A unit test asserting a failing or schema-violating model response still produces a
      record labelled with the pull-request title, with the failure reported
- [ ] A unit test asserting an already-enriched pull request produces no model call
- [ ] A test validating every committed snapshot against the chunk 02 schema with
      enrichment populated

## Chunk-Specific Checks

- [ ] The enrichment record carries a label, a one-line approach note, and an ordered step
      list, with the bounds enforced by the schema rather than requested in prose
- [ ] The approach note describes how the change was made, not a restatement of what
      changed — graded by reading several baked records, not by field presence alone
- [ ] Enrichment is keyed by merge commit SHA, and the key derivation lives in one place
      that chunk 06 can reuse
- [ ] A model failure degrades to the pull-request title and is counted and reported; no
      code path can yield an empty label
- [ ] No test calls the real model API, and assertions are on the returned record rather
      than on whether a mock was invoked —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Committed snapshots are output of the bake pipeline, not hand-edited afterwards —
      `.claude/resources/bibles/swe/testing.md`
- [ ] The bake command extends the existing CLI rather than introducing a second one
- [ ] Credentials are read only in server-side code; no public environment variable carries
      a key, and no key appears in a snapshot
- [ ] The model input is bounded to metadata rather than full patches, or the report
      explains why that was insufficient
- [ ] `project.md` was not edited by this chunk; deltas are reported for the wave boundary
- [ ] The judgment calls the plan enumerated are each explained in the completion report

## Verdict

**PASS** or **FAIL**, then:

- **Issues** — blocking problems, each with file, line, and what's wrong
- **Warnings** — non-blocking, worth fixing
- **Guidance** — what the next iteration should do first

Return this verdict as your final response text. Anything that must survive the review
goes in a file in the chunk directory — a message is not an artifact.
