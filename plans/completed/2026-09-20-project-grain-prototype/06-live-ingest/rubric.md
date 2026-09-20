<!-- The reviewer reads this. The implementer never does, and plan.md must not
     reference it. Separate documents prevent teaching to the test.
     Items state the RULE being verified, not an example copied from the plan. -->

# Chunk 06 — Live analysis — repository URL entry, bounded ingest, on-demand enrichment — Review Rubric

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

One item per module gaining new behavior. Specs are co-located as `<module>.test.ts` under
`src/` — `vitest.config.mts` includes exactly `src/**/*.test.{ts,tsx}`, so a spec outside
`src/` is never discovered and passes by not running.

- [ ] Unit tests for the repository-URL parser/validator, co-located with it, covering the
      accepted forms **and** each rejection class separately: a non-GitHub host, a path
      with extra segments beyond owner/repo, and a blank value
- [ ] Unit tests for the bounded-ingest wrapper, co-located with it, asserting the maximum
      is applied **before** fetching begins and that the truncation is reported in the
      returned value — not merely logged
- [ ] Unit tests for the enrichment cache, co-located with it, asserting (a) a second
      request for the same merge SHA produces no model call and (b) the cache evicts at
      its bound rather than growing without limit
- [ ] A spec covering the enrichment fallback: a failing enrichment yields the pull
      request's title marked as a fallback, never a blank node
- [ ] Every one of the above asserts on **the record the consumer receives**, never that a
      mock was called, and never by reading back a literal the test itself passed in —
      `.claude/resources/bibles/swe/testing.md`
- [ ] No test reaches the real GitHub or Anthropic API; stubbing is at the client boundary
- [ ] Each defensive branch introduced by this chunk has a **constructed-input** test that
      pins it. A branch no fixture reaches is a branch a mutation survives — this is the
      failure mode that produced the first review FAIL on chunks 02, 03, 04 and 05

## Chunk-Specific Checks

### Route handlers — `src/app/**/route.ts`

- [ ] Each route handler declares `export const runtime = 'nodejs'` — the Edge runtime
      supports neither Octokit nor the AI SDK
- [ ] Each route handler is **thin**: it sequences and wires `src/lib/` functions and holds
      no domain logic. If a business rule changed, the edit would land in `src/lib/`, not
      in the handler — `.claude/resources/bibles/swe/patterns/orchestrator-pattern.md`
- [ ] Every fetch is bounded **before** it starts, not by breaking out of an unbounded loop
      partway through (Principle 6)
- [ ] Credentials are read in the route handler and nowhere below it; no `src/lib/` or
      `src/components/` module reads `process.env` for a token or key (Principle 1)
- [ ] The function's maximum duration is declared explicitly rather than left to the
      platform default

### Boundary validation — the URL is request-derived data that becomes an API path and a cache key

- [ ] The submitted URL is validated at the boundary before use, reduced to owner and
      repository only, and rejected with a stated reason otherwise —
      `.claude/resources/sops/planning/boundary-validation.md`
- [ ] The enrichment cache rejects reserved keys (`__proto__`, `constructor`, `prototype`)
      and is built so a hostile key cannot reach the prototype
- [ ] The cache is bounded in size at the point it is constructed, not policed after the
      fact

### `src/lib/**/*.ts`

- [ ] Standalone functions over plain objects — no class hierarchy, registry, or provider
      interface with a single implementation
- [ ] No `fs` write and no `child_process` (Principle 3)
- [ ] Reads no credential — a token or model arrives as a parameter (Principle 1)
- [ ] Imports a sibling by **relative specifier with an explicit `.ts` extension**, never
      `@/`
- [ ] Each new module has a co-located spec

### `src/components/**/*.tsx`

- [ ] No `ai` / `@ai-sdk/*` import and no model call on any component path (Principle 2).
      The client requests enrichment over the route, it does not generate it
- [ ] No `process.env` read of a credential (Principle 1)
- [ ] Renders a schema-validated snapshot rather than a raw API shape (Principle 5) — the
      live path produces the same validated snapshot the baked path does
- [ ] A state distinction is never carried by colour alone
- [ ] Any shadcn primitive used is generated by the CLI, not hand-authored or hand-edited;
      an existing primitive is reused rather than patched

### Acceptance criteria

- [ ] `Other…` appears in the repository dropdown, and choosing it replaces the dropdown
      **in place** with a URL input carrying a back arrow to its left
- [ ] The back arrow restores the dropdown with its previous selection intact
- [ ] A validation error renders against the input **without discarding what was typed**
- [ ] Progress is reported at least once per ten pull requests processed and names what is
      happening — not an indeterminate spinner
- [ ] After a live analysis completes, the canvas behaves exactly as it does for a baked
      snapshot: slider, all three levels, and the direct/indirect badges
- [ ] A change expanded for the first time generates its label, approach note and steps on
      demand; expanded again in the same session it makes **no further model call**
- [ ] A window holding more pull requests than the configured maximum stops at the maximum
      and says so in the UI, rather than fetching without bound
- [ ] An invalid URL, an unreadable repository, and an exhausted rate limit are each
      reported with what went wrong, and the dropdown remains usable afterwards
- [ ] A retry restarts the analysis, and **no surface claims partial progress was kept or
      that work continues after the tab closes** — the plan forbids resumable or detached
      analysis, so copy implying either is a FAIL even where the design pages show it
- [ ] No credential name appears in the built client bundle

### Design conformance — resolved contradiction, read this before grading

The designs (`plans/2026-09-20-project-grain-prototype/design/mid-fi.pdf`, pages 1, 2, 3
and 8) were drawn before the no-background-jobs constraint was settled, and pages 3 and 8
carry copy that implies detached or resumable work. The plan resolves this explicitly:
**build the design's layout, write copy that matches what the prototype actually does.**
Grade accordingly — do not fail copy for diverging from pages 3 and 8, and do not pass
copy that promises behaviour the prototype lacks.

- [ ] The repository field states, progress view and error surfaces follow the **layout and
      hierarchy** of design pages 1, 2, 3 and 8
- [ ] Where the implementation departs from the design, the completion report records the
      contradiction rather than diverging silently
- [ ] The report states that the design pages were opened before the presentation
      components were written

### Reuse

- [ ] Ingest and the snapshot schema are imported, not reimplemented — a second ingest path
      in this chunk is a defect
- [ ] The enrichment function and its merge-SHA key derivation are imported, not
      re-derived; a second enrichment prompt is a defect
- [ ] The existing repository picker is extended, not replaced
- [ ] The existing level and card components render the live result unchanged
- [ ] Each reuse is recorded in the completion report as `Reuse: importing <X> from <Y>`,
      and every new module is justified

### Documentation and deltas

- [ ] A README section covers running locally and deploying, naming both environment
      variables. The README is stock `create-next-app` boilerplate on the base branch — it
      is replaced, not appended to, and no stale boilerplate section survives that
      contradicts it
- [ ] The completion report carries a "project.md deltas" section. **`.claude/resources/project.md`
      itself is NOT edited in this chunk** — the plan assigns that to the lead at the wave
      boundary, so an edit to it is out-of-scope, and an absent deltas section is the
      omission
- [ ] Every claim in the deltas section names the command that measured it, not a
      recollection

## Verdict

**PASS** or **FAIL**, then:

- **Issues** — blocking problems, each with file, line, and what's wrong
- **Warnings** — non-blocking, worth fixing
- **Guidance** — what the next iteration should do first

Return this verdict as your final response text. Anything that must survive the review
goes in a file in the chunk directory — a message is not an artifact.
