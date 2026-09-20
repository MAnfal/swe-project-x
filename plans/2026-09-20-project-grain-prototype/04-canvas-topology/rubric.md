<!-- The reviewer reads this. The implementer never does. Items state the RULE being
     verified, not an example copied from the plan. -->

# Chunk 04 — Canvas: topology and time — Review Rubric

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

- [ ] Unit tests for window derivation covering the active set for a range and a package
      with no activity in it, including range-boundary dates
- [ ] Unit tests for attribution counts covering direct counts and indirect counts grouped
      by the package they came through
- [ ] Unit tests for the change-volume series and history bounds, including a window with
      no activity
- [ ] A unit test asserting layout returns positioned nodes and is stable for one input
- [ ] A test asserting derivation succeeds on a snapshot whose enrichment is absent

## Chunk-Specific Checks

- [ ] Derivation is separate from rendering: which packages are active and their counts are
      computed by plain functions over plain objects and tested directly, not inside a
      component
- [ ] Dependency edges are not drawn by default; they surface as a per-node count and on
      focus
- [ ] Active and inactive nodes differ by at least one non-colour property
- [ ] The slider shows the repository's full history, the selected range as explicit dates,
      a change-volume indication, and the documented presets
- [ ] The repository picker discovers snapshots present rather than hardcoding repository
      names, so a snapshot baked in a parallel chunk appears without a code change
- [ ] Nothing in the chunk requires a baked snapshot or an enrichment field to render
- [ ] Node positions are computed by a layout function, not inside a component's render
- [ ] A range with no activity anywhere renders an explicit empty state
- [ ] Snapshot types are imported from the schema module rather than re-declared
- [ ] Tests assert the derived values a consumer receives, not the input snapshot —
      `.claude/resources/bibles/swe/testing.md`
- [ ] `project.md` was not edited by this chunk; deltas are reported for the wave boundary
- [ ] The judgment calls the plan enumerated are each explained in the completion report

- [ ] The completion report states whether the mid-fi designs were supplied before the
      presentation components were built, or that the user directed the chunk to proceed
      without them; where the designs contradicted the plan, the contradiction is recorded

## Verdict

**PASS** or **FAIL**, then:

- **Issues** — blocking problems, each with file, line, and what's wrong
- **Warnings** — non-blocking, worth fixing
- **Guidance** — what the next iteration should do first

Return this verdict as your final response text. Anything that must survive the review
goes in a file in the chunk directory — a message is not an artifact.
