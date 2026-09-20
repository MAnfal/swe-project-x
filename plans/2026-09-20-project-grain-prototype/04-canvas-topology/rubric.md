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
- [ ] Dependency edges are drawn between touched packages only; untouched packages carry
      none, and an indirect reach is visually distinct from a direct dependency edge
- [ ] Neither the active/inactive distinction nor the direct/indirect distinction rests on
      colour alone
- [ ] Active and inactive nodes differ by at least one non-colour property
- [ ] The slider shows the repository's full history, the selected range as explicit dates,
      a change-volume indication, and the documented presets
- [ ] The repository picker discovers snapshots present rather than hardcoding repository
      names, so a snapshot baked in a parallel chunk appears without a code change
- [ ] Nothing in the chunk requires a baked snapshot or an enrichment field to render
- [ ] Node positions are computed by a layout function, not inside a component's render
- [ ] A range with no activity anywhere renders an explicit empty state
- [ ] Snapshot types are imported from `src/lib/snapshot.ts` rather than re-declared
- [ ] Tests assert the derived values a consumer receives, not the input snapshot —
      `.claude/resources/bibles/swe/testing.md`
- [ ] `project.md` was not edited by this chunk; deltas are reported for the wave boundary
- [ ] The judgment calls the plan enumerated are each explained in the completion report

- [ ] The completion report states whether the mid-fi designs were supplied before the
      presentation components were built, or that the user directed the chunk to proceed
      without them; where the designs contradicted the plan, the contradiction is recorded

- [ ] The screens this chunk builds match the committed mid-fi designs; any place the
      designs contradicted the chunk plan is named in the completion report, with the
      design followed rather than the plan

### From the Convention Map — `src/lib/**/*.ts`

Gates for this area: `pnpm test`, `pnpm lint`, `pnpm typecheck`.

- [ ] The derivation and layout modules are standalone functions over plain objects — no
      class hierarchy, no registry, and no provider interface with one implementation
- [ ] No `fs` write and no `child_process` call under `src/lib/` (Principle 3). Reading a
      committed snapshot is a read and is fine
- [ ] No credential is read under `src/lib/` (Principle 1)
- [ ] Sibling modules are imported by **relative specifier with an explicit `.ts`
      extension**, never `@/`. Specs may keep `@/`, since they only run under Vitest
- [ ] Every new module under `src/lib/` has a co-located `*.test.ts`

### From the Convention Map — components and pages

Gates for this area: `pnpm lint`, `pnpm build`, `pnpm typecheck`.

- [ ] No `ai` or `@ai-sdk/*` import anywhere in a component, and no model call reached
      while rendering (Principle 2) — nothing the canvas draws waits on a model
- [ ] No `process.env` read of a credential in a component or page (Principle 1)
- [ ] Components render a schema-validated `Snapshot` rather than a raw GitHub API shape
      (Principle 5); the snapshot is parsed once at the boundary, not trusted implicitly
- [ ] A state distinction is never carried by colour alone

### From the Convention Map — `src/components/ui/**`

Gates for this area: `pnpm lint`, `pnpm typecheck`.

- [ ] Any shadcn/ui primitive this chunk needs was generated by
      `pnpm dlx shadcn@latest add <name>` and is **not hand-edited**. If the installed
      slider could not do two handles, the completion report says what was measured and
      the fix is a wrapper or a different primitive — never a patch to the generated file

### From the Convention Map — `src/**/*.test.ts`, `src/**/*.test.tsx`

Gates for this area: `pnpm test`, `pnpm lint`, `pnpm typecheck`.

- [ ] Specs assert the value a consumer receives after resolution, never read back the
      literal handed in — `.claude/resources/bibles/swe/testing.md`
- [ ] The transform is tested against the producer's **real captured output** — the
      replayed snapshot — not a hand-rolled approximation of one
- [ ] Specs live under `src/` named `<module>.test.{ts,tsx}`. `vitest.config.mts` includes
      exactly `src/**/*.test.{ts,tsx}`; a spec outside that is never discovered and passes
      by not running
- [ ] The reported passing count is asserted, not just a zero exit

### From the Convention Map — `src/**/snapshots/**/*.json`

Gate for this area: `pnpm test`.

- [ ] `src/lib/snapshots/xyflow-xyflow-2026-08-31.json` is **captured output of the real
      producer** — the committed ingester replayed over chunk 02's committed transcript —
      and carries the incidental fields a real response has (Principle 4);
      `.claude/resources/bibles/swe/testing.md`
- [ ] It is not hand-authored and not hand-edited after generation, and the completion
      report names the exact command that regenerates it
- [ ] It carries no `enrichment` key, and the report shows the byte-identical result of
      re-running the command

### From the Convention Map — manifests and config

Gates for this area: `pnpm install`, `pnpm build`, `pnpm typecheck`.

- [ ] Any new dependency was added with `pnpm add` rather than by hand-editing
      `package.json`, and the lockfile is committed with it
- [ ] **Plan constraint overrides the map here.** The Convention Map says a new dependency
      or command is recorded in `project.md` in the same chunk; this plan forbids chunks
      02–06 from editing that file. Grade instead: `project.md` is **unmodified** in the
      diff, and every architecture-fact delta appears in the completion report's
      "project.md deltas" section

### Deployment and parallel-wave boundary

- [ ] Whatever makes the picker's snapshot list is verified to survive a production build,
      not only `pnpm dev` — the report shows `pnpm build` followed by the built app
      actually listing the snapshot. A bare runtime directory read of a source folder is
      not traced into the serverless bundle, so "it works in dev" is not evidence
- [ ] The list is not a hand-maintained literal of repository names. A build-time-generated
      index is acceptable; a hardcoded array is not
- [ ] The diff touches no file under `src/lib/ai/`, and does not modify
      `scripts/ingest.mts` — those belong to the chunk running in parallel

## Verdict

**PASS** or **FAIL**, then:

- **Issues** — blocking problems, each with file, line, and what's wrong
- **Warnings** — non-blocking, worth fixing
- **Guidance** — what the next iteration should do first

Return this verdict as your final response text. Anything that must survive the review
goes in a file in the chunk directory — a message is not an artifact.
