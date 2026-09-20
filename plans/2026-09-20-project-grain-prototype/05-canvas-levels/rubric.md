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

- [ ] Unit tests for package-level derivation in `src/lib/view/derive.test.ts`, asserting
      one entry per reaching pull request with its inclusion reason and attached enrichment
- [ ] A unit test asserting a pull request with absent or failed enrichment yields a record
      carrying the pull-request title and a flag marking it a fallback
- [ ] Unit tests for step derivation covering ordered steps with their files, and a pull
      request with no steps yielding an empty chain rather than throwing
- [ ] A unit test asserting the entry-point step is the first step whose files the expanded
      package owns — including a change that touches the package only in a later step
- [ ] A test asserting the ordering of change cards is stable across runs
- [ ] **For each defensive branch or boundary comparison added to the derivation module, a
      test whose input is _constructed_ rather than drawn from a committed snapshot.** Every
      chunk in this plan carrying non-trivial logic has failed review for a guard that no
      fixture exercises — a real fixture only contains the cases that repository happened to
      produce. Grade by attempting to delete each guard and confirming a named test fails
- [ ] Component rendering: **N/A by project constraint** — there is no `jsdom` environment
      and no `@testing-library/react` in this project, and adding either is a dependency
      decision outside this chunk. Presentation behaviour is graded against the component
      source and against the running app, not by demanding a render test

## Chunk-Specific Checks

### The levels

- [ ] Expanding a package reveals exactly one change card per pull request that reached it
      in the selected range, directly or indirectly
- [ ] Level 2 is laid out as a card list anchored to the expanded package rather than as a
      graph of pull-request nodes, with the other packages active in the range reachable
      without collapsing first
- [ ] A change card shows the label, pull-request number, author, merge date, spanned
      packages, and the approach note
- [ ] The approach note is rendered in full and readable without a further interaction —
      not truncated to a chip or hidden behind a control
- [ ] A fallback-labelled change is visually distinguishable from an enriched one, and no
      code path renders a blank card
- [ ] Level 2 renders correctly for a snapshot that carries **no** `enrichment` key at all,
      not only for one where an individual record is missing. The committed catalog contains
      one such snapshot, so this path is reachable from the running app
- [ ] Steps render as an ordered chain, each naming the files it covers, the lines added
      and removed, and a link to the change on GitHub
- [ ] The step where the change entered the expanded package is marked and named beneath
      the chain, and that step is derived from file ownership rather than taken from model
      output
- [ ] Levels replace the view rather than nesting sub-flows inside a node, so the existing
      layout engine remains applicable
- [ ] An expanded package with no changes in range renders an empty state distinct from the
      whole-canvas empty state

### Navigation and onboarding

- [ ] The breadcrumb shows repository → package → change and each segment returns to that
      level
- [ ] Expansion and collapse are reachable from the keyboard with visible focus
- [ ] The onboarding walkthrough is dismissible and replayable, and its dismissal is stored
      as a per-viewer convenience that the page renders correctly without — a cleared or
      blocked store must not break the page

### Conventions — `src/components/**/*.tsx`, `src/app/**/page.tsx`

- [ ] No `ai` or `@ai-sdk/*` import and no model call in a component (Principle 2)
- [ ] No `process.env` read of a credential in a component (Principle 1)
- [ ] Renders a schema-validated snapshot rather than a raw API shape (Principle 5)
- [ ] No state distinction is carried by colour alone — a fallback label, an indirect
      attribution and a focused card each remain distinguishable without colour
- [ ] Any shadcn/ui primitive added under `src/components/ui/**` was generated by
      `pnpm dlx shadcn@latest add <name>` and is neither hand-authored nor hand-edited

### Conventions — `src/lib/**/*.ts`

- [ ] Derivation extends the existing module rather than introducing a second one
- [ ] Standalone functions over plain objects — no class hierarchy, registry, or provider
      interface with a single implementation
- [ ] No `fs` write and no `child_process` (Principle 3)
- [ ] Reads no credential — anything it needs arrives as a parameter (Principle 1)
- [ ] Imports a sibling by **relative specifier with an explicit `.ts` extension**, never
      `@/` — a `src/lib/` module written with `@/` works under Vitest and Next and breaks
      the CLI, and nothing else catches it
- [ ] Any repository-derived string used as a record key goes through
      `assertSafeKey`/`buildRecord` rather than relying on the schema — zod silently drops
      reserved keys rather than rejecting them
- [ ] Each module has a co-located spec

### Conventions — tests

- [ ] Tests assert the value a consumer receives after resolution, never reading back the
      literal they passed in; a transform over a producer's output is tested against that
      producer's real captured output rather than a hand-rolled approximation —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Specs are co-located under `src/` and named `<module>.test.ts(x)`. `vitest.config.mts`
      includes exactly `src/**/*.test.{ts,tsx}`, so a spec outside `src/` is never
      discovered and passes by not running

### Conventions — manifests

- [ ] A new dependency or command is recorded in `.claude/resources/project.md`, and
      `package.json`/`components.json` were changed by the tool that owns them (`pnpm add`,
      the shadcn CLI) rather than hand-edited

### Designs and reporting

- [ ] The screens this chunk builds match the committed mid-fi designs (pages 5, 6 and 9);
      any place the designs contradicted the chunk plan is named in the completion report,
      with the design followed rather than the plan
- [ ] The completion report states that the designs were opened before the presentation
      components were built
- [ ] The judgment calls the plan enumerated are each explained in the completion report —
      card ordering, fallback treatment, and where expansion state lives
- [ ] `project.md` was **not** edited by this chunk; its architecture deltas are reported
      for the lead to apply at the wave boundary. This inverts `project.md`'s own standing
      rule ("the implementer, in the same chunk") and follows this plan's Plan-Specific
      Constraint instead, which exists to avoid two parallel chunks conflicting in that file

## Verdict

**PASS** or **FAIL**, then:

- **Issues** — blocking problems, each with file, line, and what's wrong
- **Warnings** — non-blocking, worth fixing
- **Guidance** — what the next iteration should do first

Return this verdict as your final response text. Anything that must survive the review
goes in a file in the chunk directory — a message is not an artifact.
