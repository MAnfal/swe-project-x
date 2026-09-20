<!-- The reviewer reads this. The implementer never does. Items state the RULE being
     verified, not an example copied from the plan. -->

# Chunk 05 — Canvas: change clusters and step chains — Review Rubric

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

- [ ] Unit tests for package-level derivation asserting one entry per reaching pull request
      with its inclusion reason and attached enrichment
- [ ] A unit test asserting a pull request with absent or failed enrichment yields a record
      carrying the pull-request title and a flag marking it a fallback
- [ ] Unit tests for step derivation covering ordered steps with their files and a pull
      request with no steps
- [ ] A test asserting the ordering of change nodes is stable across runs

## Chunk-Specific Checks

- [ ] Expanding a package reveals exactly one node per pull request that reached it in the
      selected range, directly or indirectly
- [ ] A change node shows the label, pull-request number, author, merge date, spanned
      packages, and the approach note
- [ ] The approach note is readable without a further interaction rather than truncated to
      a chip or hidden behind a control
- [ ] A fallback-labelled change is visually distinguishable from an enriched one, and no
      code path renders a blank node
- [ ] Steps render as an ordered chain, each naming the files it covers, the lines added
      and removed, and a link to the change on GitHub
- [ ] The step where the change entered the expanded package is marked and named beneath
      the chain, and that step is derived from file ownership rather than taken from model
      output
- [ ] Level 2 presents changes as cards anchored to the expanded package, with the other
      packages active in the range reachable without collapsing first
- [ ] The breadcrumb shows repository → package → change and each segment returns to that
      level
- [ ] Expansion and collapse are reachable from the keyboard with visible focus
- [ ] Levels replace the view rather than nesting sub-flows inside a node, so the existing
      layout engine remains applicable
- [ ] Derivation extends the existing module rather than introducing a second one
- [ ] An expanded package with no changes in range renders an empty state distinct from the
      whole-canvas empty state
- [ ] The onboarding walkthrough is dismissible and replayable, and its dismissal is stored
      as a per-viewer convenience that the page renders correctly without
- [ ] Tests run against captured snapshots rather than hand-rolled fixtures —
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
