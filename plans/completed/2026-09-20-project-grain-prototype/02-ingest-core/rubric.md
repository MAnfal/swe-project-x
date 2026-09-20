<!-- The reviewer reads this. The implementer never does. Items state the RULE being
     verified, not an example copied from the plan.
     Regenerated 2026-09-20 by `generate-chunk-rubric` after chunk 01 merged and wrote
     the Convention Map in `.claude/resources/project.md`. -->

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

Convention: specs are **co-located** with the module they cover, named `<module>.test.ts`,
and live under `src/`. `vitest.config.mts` includes exactly `src/**/*.test.{ts,tsx}` — a
spec outside that pattern is never discovered and passes by not running. A zero exit from
`pnpm test` does not prove a spec ran; grade the **passing count the runner reports**.

- [ ] The snapshot schema module has a co-located spec asserting that a snapshot with
      `enrichment` absent validates, and that one missing a required pull-request field
      does not
- [ ] The topology module has a co-located spec covering `discoverTopology` — nodes
      discovered from the workspace layout, an edge created from a declared workspace
      dependency, and a dependency that must **not** produce an edge
- [ ] The attribution module has a co-located spec covering direct attribution, indirect
      attribution with the reaching path recorded, and the precedence rule when a package
      qualifies as both
- [ ] The boundary-validation behavior has a spec covering a reserved key, a duplicate
      package name, and the collection size cap — each asserting rejection, not truncation
- [ ] The ingest entry point has a co-located spec asserting two runs over one fixture
      serialize identically outside `metadata`
- [ ] The GitHub client module has a co-located spec, or its absence is justified in the
      completion report as covered end-to-end through the ingest spec's stubbed network
- [ ] Every new module under `src/lib/` has a co-located spec — no module ships without
      one (Convention Map, `src/lib/**/*.ts`)
- [ ] Tests assert the value a consumer receives after resolution — the attribution sets,
      the parsed snapshot — never that a mock was called or that an input literal
      round-tripped — `.claude/resources/bibles/swe/testing.md`
- [ ] Each transform is tested against the **producer's real captured output**, not a
      hand-rolled approximation of it — `.claude/resources/bibles/swe/testing.md`

## Chunk-Specific Checks

### From the acceptance criteria

- [ ] Given a repository identifier and a time window, ingest returns an object the
      snapshot schema validates, carrying package topology, the merged pull requests in
      that window, and per-pull-request file and commit detail
- [ ] Each app and package is a node, and an edge exists from A to B exactly when A's
      manifest declares a workspace dependency on B — declared dependencies only, never
      scanned import statements
- [ ] A pull request that changed a file inside a package is recorded as reaching it
      **directly**
- [ ] A pull request reaching a package only through the dependency graph is recorded as
      **indirect**, with the reaching path stored
- [ ] A package qualifying as both direct and indirect for one pull request is recorded as
      direct
- [ ] Two ingests over the same inputs serialize byte-identically apart from `metadata` —
      iteration order and set ordering do not leak into the output
- [ ] Each changed file carries its added and removed line counts, captured at ingest
      rather than left recoverable only by re-fetching, and is attributed to its owning
      package
- [ ] Pull requests merged by squash, by merge commit, and by rebase all appear with their
      commits attached
- [ ] A malicious or malformed repository-derived name is rejected before it is used as a
      record key, rather than written

### From the Convention Map — `src/lib/**/*.ts`

Gates for this area: `pnpm test`, `pnpm lint`, `pnpm typecheck`.

- [ ] The modules are standalone functions over plain objects — no class hierarchy, no
      registry, and no provider interface with exactly one implementation. Topology
      discovery in particular is one function, not a plugin seam built for a second
      ecosystem that ORCHESTRATOR.md § Complexity names as a non-goal
- [ ] No `fs` write and no `child_process` call anywhere in `src/lib/` — the deploy target
      has neither a writable filesystem nor a git binary at request time (Principle 3).
      Read-only reads of committed files are fine
- [ ] No credential is read below the route/script boundary: `GITHUB_TOKEN` is not read
      inside `src/lib/` (Principle 1). The token is passed in by the caller
- [ ] The snapshot is defined **once** as a Zod schema with its TypeScript types derived
      from it, not a schema alongside a parallel hand-written type (Principle 5 — one
      schema, one ingest path)
- [ ] `enrichment` is optional in the schema and nothing in this chunk requires it, so a
      snapshot without it renders

### From the Convention Map — fixtures

Gate for this area: `pnpm test`.

- [ ] The committed fixture is **captured output of the real producer**, committed as
      written — it carries the incidental fields a real API response has and a
      hand-written file would not bother with (Principle 4);
      `.claude/resources/bibles/swe/testing.md`
- [ ] The fixture covers the cases the chunk's logic actually branches on: at least one
      pull request spanning more than one package, and one touching files outside any
      package
- [ ] The fixture is regenerated by re-running the producer, not edited by hand — the
      completion report says which command produces it

### From the Convention Map — manifests and config

Gates for this area: `pnpm install`, `pnpm build`, `pnpm typecheck`.

- [ ] Any new dependency was added with `pnpm add` rather than by hand-editing
      `package.json`, and the lockfile is committed with it
- [ ] **Plan constraint overrides the map here.** The Convention Map says a new dependency
      or command is recorded in `project.md` in the same chunk; this plan forbids chunks
      02–06 from editing that file, to avoid a parallel-wave merge conflict. Grade
      instead: `project.md` is **unmodified** in the diff, and every architecture-fact
      delta appears in the completion report's "project.md deltas" section for the lead to
      apply at the wave boundary

### Boundary validation

- [ ] Repository-derived strings used as record keys are validated **at the boundary**:
      `__proto__`, `constructor` and `prototype` rejected; duplicate package names
      rejected explicitly rather than last-write-wins; keyed records built on
      `Object.create(null)`; package and pull-request counts capped with a message naming
      the limit rather than a silent truncation —
      `.claude/resources/sops/planning/boundary-validation.md`

### Correctness of approach

- [ ] Pull-request identity is taken from the GitHub API, not parsed out of commit
      messages — a regex over merge-commit text silently misses rebase-merged pull
      requests, which leave no merge commit and no number
- [ ] Ingest takes explicit window and maximum-count bounds, and no code path fetches
      without one (Principle 6). The bound is set at the call site, not discovered mid-loop
- [ ] The dependency closure is computed once per snapshot, not once per pull request
- [ ] A timestamp appears only inside the declared `metadata` block, and the determinism
      assertion excludes that block and nothing else — an over-broad exclusion would hide
      real non-determinism
- [ ] The topology file list is fetched with one recursive tree request rather than a
      per-directory walk
- [ ] Every GitHub API call was verified against the **installed** `@octokit/rest` (22.0.1)
      rather than assumed from the plan; where the measurement contradicted the plan, the
      report records the measurement and what changed
- [ ] The Reuse Audit was actually run — searched by name, by algorithm, and by problem —
      and its result is recorded, including the "none found" outcome
- [ ] Each judgment call the plan enumerated (indirect path cardinality, the `enrichment`
      key, the pull-request cap) is explained in the completion report with its rationale

### Gate falsifiability

- [ ] Each of the chunk's four gates was proven able to fail: gates 1 and 4 against the
      base commit's missing module, gate 2 against the absent fixture, gate 3 against the
      absent guard. The report shows the exact command, its exit status, and the failure
      output — not an assertion that it would fail
- [ ] Negative controls were run per assertion: canary planted, gate fires, canary removed,
      gate returns clean. No sabotaged file was restored with `git checkout --`

## Verdict

**PASS** or **FAIL**, then:

- **Issues** — blocking problems, each with file, line, and what's wrong
- **Warnings** — non-blocking, worth fixing
- **Guidance** — what the next iteration should do first

Return this verdict as your final response text. Anything that must survive the review
goes in a file in the chunk directory — a message is not an artifact.
