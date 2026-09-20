<!-- The reviewer reads this. The implementer never does. Items state the RULE being
     verified, not an example copied from the plan. -->

# Chunk 06 — Live analysis — Review Rubric

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

- [ ] Unit tests for repository URL parsing covering accepted forms and rejection of a
      non-GitHub host, a malformed path, and blank input
- [ ] A unit test asserting ingest stops at the configured maximum and reports the
      truncation
- [ ] Unit tests for the enrichment cache covering a hit producing no model call and
      eviction at the configured bound
- [ ] A unit test asserting a failed enrichment call returns the pull-request title marked
      as a fallback

## Chunk-Specific Checks

- [ ] Live analysis runs the existing ingest and enrichment code; no second pipeline,
      schema, or prompt is introduced
- [ ] Ingest performed during a request is deterministic only — enrichment is deferred to
      expansion and never blocks the analysis response
- [ ] Bounds are applied before fetching begins rather than by aborting an unbounded loop,
      and the result reports when the bound truncated it
- [ ] Both route handlers declare the Node.js runtime and an explicit maximum duration
      consistent with the platform ceiling
- [ ] The submitted URL is validated at the boundary before becoming an API path or a cache
      key, and the cache is bounded —
      `.claude/resources/sops/planning/boundary-validation.md`
- [ ] Credentials are read only inside server-side code and do not appear in the built
      client bundle; the gate proving this searched a directory that exists
- [ ] The enrichment cache is keyed by merge SHA using the existing key derivation, and a
      miss is handled as normal rather than as an error
- [ ] Progress is reported with specific phases and counts rather than an indeterminate
      state
- [ ] `Other…` swaps the dropdown in place for the URL input with a back arrow to its left;
      the arrow restores the dropdown and its previous selection
- [ ] Failure states name what went wrong and leave the dropdown usable
- [ ] No surface claims that analysis continues after the tab closes or that a retry resumes
      partially fetched work; retry restarts, and no durable job state was introduced
- [ ] No request-time dependency on a writable filesystem, a git subprocess, or a
      background worker
- [ ] No test calls the real GitHub or model API, and assertions are on returned records —
      `.claude/resources/bibles/swe/testing.md`
- [ ] `project.md` was not edited by this chunk; deltas are reported for the wave boundary
- [ ] The judgment calls the plan enumerated are each explained in the completion report

- [ ] The completion report states whether the mid-fi designs were supplied before the
      presentation components were built, or that the user directed the chunk to proceed
      without them; where the designs contradicted the plan, the contradiction is recorded

- [ ] The screens this chunk builds match the committed mid-fi designs; any place the
      designs contradicted the chunk plan is named in the completion report, with the
      design followed rather than the plan

## Verdict

**PASS** or **FAIL**, then:

- **Issues** — blocking problems, each with file, line, and what's wrong
- **Warnings** — non-blocking, worth fixing
- **Guidance** — what the next iteration should do first

Return this verdict as your final response text. Anything that must survive the review
goes in a file in the chunk directory — a message is not an artifact.
