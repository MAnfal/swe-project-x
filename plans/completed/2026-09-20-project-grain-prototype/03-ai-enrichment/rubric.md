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
      that a later live-ingest chunk can reuse
- [ ] `mergeCommitSha` is nullable in the merged schema, so the chunk has a stated, tested
      rule for a pull request that has none — and Gate 2's accessor matches whatever rule
      was chosen
- [ ] Each step carries the commit it came from: the merged `enrichmentEntrySchema`
      requires `{ commitSha, summary }` per step with at least one step. A step list of
      bare phrases, or a degraded record written with an empty step array, fails this
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
- [ ] The default model id is `claude-haiku-4-5`, read from an environment variable rather
      than hardcoded at the call site, so escalating the model needs no code change
- [ ] `output_config.effort` is **not** set — effort errors on Haiku 4.5, which is not an
      Opus-family model. Grade the request options actually passed to `generateObject`
- [ ] The payload is bounded before the call, not after: Haiku 4.5's context is 200K while
      the merged schema permits 1000 commits and 3000 files per pull request, so a
      pathological record must be capped rather than sent whole. The report says what was
      capped and how
- [ ] The completion report carries measured input/output token totals per repository, not
      just a pull-request count. Those numbers are the evidence any later decision to
      escalate the model would rest on, and they cannot be recovered after the bake
- [ ] The `approach` notes are graded by **reading several baked records**. If they read as
      restatements of what changed rather than how it was done, that is the documented
      trigger to escalate the model (ORCHESTRATOR.md § Design Decisions 10) — report it as a
      finding with quoted examples rather than passing it silently
- [ ] `project.md` was not edited by this chunk; deltas are reported for the wave boundary
- [ ] The judgment calls the plan enumerated are each explained in the completion report

### From the Convention Map — `src/lib/**/*.ts`

Gates for this area: `pnpm test`, `pnpm lint`, `pnpm typecheck`.

- [ ] The enrichment module is standalone functions over plain objects — no class
      hierarchy, no registry, and no provider interface with exactly one implementation.
      A "model provider" seam built for a second vendor is the abstraction
      ORCHESTRATOR.md § Complexity rejects by name
- [ ] No `fs` write and no `child_process` call anywhere under `src/lib/` (Principle 3).
      Writing the baked snapshot happens in `scripts/`, which may write files
- [ ] `ANTHROPIC_API_KEY` is not read inside `src/lib/` (Principle 1) — the key or a
      configured client arrives as a parameter from the script or route handler that read it
- [ ] Sibling modules are imported by **relative specifier with an explicit `.ts`
      extension**, never `@/`. The CLI runs under bare Node, which strips types without
      reading tsconfig `paths`, so an `@/` import works under Vitest and Next and breaks
      `scripts/ingest.mts` — and nothing else catches it
- [ ] Every new module under `src/lib/` has a co-located `*.test.ts`
- [ ] Enrichment reuses `enrichmentEntrySchema` / `enrichmentSchema` exported from
      `src/lib/snapshot.ts` rather than declaring a second definition of the same shape
      (Principle 5 — one snapshot schema). A narrower schema shaped for `generateObject`
      is fine; a parallel hand-written type or a second snapshot schema is not
- [ ] Any repository-derived string used as an `enrichment` key goes through
      `assertSafeKey` / `buildRecord` from `src/lib/snapshot.ts`, not through the Zod
      schema. Measured on zod 4.6.5: `z.record` accepts `{"__proto__": …}` and silently
      drops the key rather than rejecting it, and `.refine` cannot see it either

### From the Convention Map — `scripts/**`

Gates for this area: `pnpm lint`, `pnpm typecheck`.

- [ ] The CLI stays **thin**: it parses arguments and sequences `src/lib/` functions, and
      holds no enrichment domain logic of its own
- [ ] Reading `ANTHROPIC_API_KEY` here is legal (Principle 1), and writing the baked
      snapshot here is legal (Principle 3 forbids filesystem writes only on paths
      reachable from a route handler; a CLI is not one)
- [ ] It imports `src/lib/` by relative specifier with an explicit extension, never `@/`
- [ ] No co-located spec for the script — the logic it drives is tested in `src/lib/`
- [ ] The bake path extends `scripts/ingest.mts` rather than adding a second CLI

### From the Convention Map — `src/**/*.test.ts`

Gates for this area: `pnpm test`, `pnpm lint`, `pnpm typecheck`.

- [ ] Specs assert the value a consumer receives after resolution, never read back the
      literal handed in, and never assert merely that a mock was invoked —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Specs live under `src/` named `<module>.test.ts`. `vitest.config.mts` includes
      exactly `src/**/*.test.{ts,tsx}`; a spec outside that is never discovered and
      passes by not running
- [ ] The reported passing count is asserted, not just a zero exit — a spec outside the
      include pattern is skipped silently while the run still exits 0

### From the Convention Map — `src/**/snapshots/**/*.json`

Gate for this area: `pnpm test`.

- [ ] Every committed snapshot is **captured output of the bake pipeline**, committed as
      written, and regenerated by re-running the producer rather than edited by hand
      (Principle 4); the completion report names the exact command that produces each —
      `.claude/resources/bibles/swe/testing.md`
- [ ] No snapshot contains a credential, and no snapshot carries a token in a URL

### From the Convention Map — manifests and config

Gates for this area: `pnpm install`, `pnpm build`, `pnpm typecheck`.

- [ ] Any new dependency was added with `pnpm add` rather than by hand-editing
      `package.json`, and the lockfile is committed with it
- [ ] **Plan constraint overrides the map here.** The Convention Map says a new dependency
      or command is recorded in `project.md` in the same chunk; this plan forbids chunks
      02–06 from editing that file, to avoid a parallel-wave merge conflict. Grade
      instead: `project.md` is **unmodified** in the diff, and every architecture-fact
      delta appears in the completion report's "project.md deltas" section

### Parallel-wave boundary

- [ ] The diff does not create, edit or delete
      `src/lib/snapshots/xyflow-xyflow-2026-08-31.json` — that path belongs to the chunk
      running in parallel, and this chunk's own bakes use their own window-qualified names
- [ ] No file under `src/lib/view/`, `src/components/` or `src/app/page.tsx` is touched

## Verdict

**PASS** or **FAIL**, then:

- **Issues** — blocking problems, each with file, line, and what's wrong
- **Warnings** — non-blocking, worth fixing
- **Guidance** — what the next iteration should do first

Return this verdict as your final response text. Anything that must survive the review
goes in a file in the chunk directory — a message is not an artifact.
