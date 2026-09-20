<!-- The reviewer reads this. The implementer never does. Items state the RULE being
     verified, not an example copied from the plan. -->

# Chunk 02 — Ingest core — Review Rubric

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

- [ ] Unit tests for topology discovery covering node discovery and edge creation from a
      declared workspace dependency, including a dependency that must not produce an edge
- [ ] Unit tests for attribution covering direct, indirect-with-path, and the precedence
      rule when a package qualifies as both
- [ ] Unit tests for boundary validation covering a reserved key, a duplicate name, and the
      collection size cap
- [ ] A determinism test asserting two runs over one fixture serialize identically
- [ ] A schema test asserting a snapshot without enrichment is valid and one missing a
      required pull-request field is not

## Chunk-Specific Checks

- [ ] Pull-request identity is taken from the GitHub API, not parsed out of commit
      messages — a regex over merge-commit text silently misses rebase-merged PRs
- [ ] The snapshot is defined once as a schema with types derived from it, rather than a
      schema and a parallel hand-written type
- [ ] `enrichment` is optional in the schema, and nothing in this chunk requires it
- [ ] Repository-derived strings used as record keys are validated at the boundary:
      reserved keys rejected, duplicates rejected, records built on a null prototype,
      collection size capped —
      `.claude/resources/sops/planning/boundary-validation.md`
- [ ] The committed fixture is captured API output rather than a hand-authored
      approximation, and includes at least one pull request spanning more than one package
      and one touching files outside any package —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Tests assert the values a consumer receives — the attribution sets, the snapshot —
      not that a mock was called or that an input literal round-tripped —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Ingest takes explicit window and count bounds; no code path fetches without a bound
- [ ] The dependency closure is computed once per snapshot rather than per pull request
- [ ] Topology discovery is a single function, not a provider or plugin interface built for
      a second ecosystem that is a stated non-goal
- [ ] `project.md` was not edited by this chunk; architecture-fact deltas are reported for
      the wave boundary instead
- [ ] The judgment calls the plan enumerated are each explained in the completion report

## Verdict

**PASS** or **FAIL**, then:

- **Issues** — blocking problems, each with file, line, and what's wrong
- **Warnings** — non-blocking, worth fixing
- **Guidance** — what the next iteration should do first

Return this verdict as your final response text. Anything that must survive the review
goes in a file in the chunk directory — a message is not an artifact.
