# Chunk 04 — Review Iteration 1

Reviewed against `rubric.md` in this directory. Base for gate/negative-control checks:
`a2b8565` on `feat/plan--project-grain-prototype`. All checks below were re-derived
independently in the worktree (`.worktrees/04-canvas-topology`), not inherited from the
lead's or the implementer's claims. Working tree left byte-identical to how it was found
(`git status --porcelain` empty at the end of review; every mutation applied during
mutation-testing was restored from a copied backup, never `git checkout --`).

## Universal Checks

- [x] PASS — The change does what the acceptance criteria say. Verified by reading
      `derive.ts`, `layout.ts`, and every component, and by hand-computing attribution
      counts against the committed snapshot (see § Attribution counts below). One caveat
      recorded as a Warning, not a bullet failure: focus + an empty range produces a
      self-contradicting empty-state message (see Warnings).
- [x] PASS — All four gates re-run after the last edit in this worktree, in order, type
      check last: `pnpm lint` exit 0 no output, `pnpm test` `Test Files 10 passed (10) /
      Tests 135 passed (135)`, `pnpm build` exit 0 `○ (Static) prerendered`, `pnpm
      typecheck` exit 0 no output. Gate 2 and Gate 3 re-run with their own negative
      controls (below), both fire correctly and both return clean after restore.
- [ ] FAIL — Two confirmed mutation survivors in `derive.ts`, both edges the fixture never
      exercises. See § Mutation testing for the exact mutants, diffs, and full green runs.
- [x] PASS — `completion-report.md` exists, is thorough, and is committed (`de50039`,
      `5f27970`, plus the report commit).
- [x] PASS — Report shows genuine red runs with real error text, not paraphrased claims:
      `Cannot find package '@/lib/view/derive'`, and — the interesting one —
      `TypeError: default.Graph is not a constructor` at `layout.ts:43:17`, which is a real
      measurement (dagre's default export shape), not a "module missing" stub failure.
- [x] PASS — No new abstraction. Plain functions over plain objects throughout; no class,
      no registry, no provider interface.
- [x] PASS — No principle violated. P1 (no credential in a component — verified, no
      `process.env` hits), P2 (no `ai`/`@ai-sdk` import in components — verified, zero
      hits), P3 (`build-snapshot-index.mts`'s `writeFileSync` is under `scripts/`, which
      the Convention Map explicitly permits to write; `src/lib/` only reads), P4 (snapshot
      regenerated and diffed — see below), P5 (every render path goes through
      `snapshotSchema.parse`, `catalog.ts:29`).
- [x] PASS — Scope: `git diff --stat` against `feat/plan--project-grain-prototype...HEAD`
      touches nothing under `src/lib/ai/`, does not modify `scripts/ingest.mts`, does not
      modify `project.md`, and adds exactly one file under `src/lib/snapshots/`.
- [x] PASS — No secret or credential literal anywhere in the diff (checked for
      `GITHUB_TOKEN`, `ANTHROPIC_API_KEY`, token-shaped strings).
- [x] PASS — No silent failure: `getSnapshot` throws naming the id and the ones it has;
      `activityOf` throws rather than returning a zeroed stand-in; `volumeSeries` throws on
      `bucketCount < 1`.
- [x] PASS — Reuse audit is real, not decorative: `WindowBounds` in
      `src/lib/ingest/github.ts` was found and rejected with a stated reason (parameterizes
      a fetch, not a view range); the snapshot's own `directPackages`/`indirectPackages`
      (computed once by `attribution.ts` at ingest) are read rather than recomputed —
      confirmed by reading `attribution.ts`, which already resolves direct-wins precedence
      per pull request.
- [x] PASS — Baseline captured before any edit (94 passed / 0 lint / 0 typecheck / build
      0), so every gate result above is also the delta.
- [x] PASS — Comments read as true against the code they sit next to. (The comments on the
      two untested branches — `historyBounds` widening, `volumeSeries`'s final-bucket
      clamp — are accurate descriptions of what the code does; the problem is that nothing
      proves it, which is graded above and in Test Coverage.)

## Test Coverage Checks

- [x] PASS — Window derivation: active set for a range, a package with no activity, and a
      pull request on either boundary (`derive.test.ts:74-79`, verified by hand against the
      snapshot: PR 5987 at 09:36:49Z and PR 5989 at 09:22:57Z on 2026-08-31 are exactly the
      two the test names).
- [x] PASS — Attribution counts: direct and indirect grouped by the reaching package.
      Hand-verified against the snapshot JSON for `@xyflow/react` (direct 3: PRs 5992,
      5994, 5987; indirect 2 via `@xyflow/system`: PRs 5997, 5989 — a package reached both
      ways) and `astro-examples` (indirect only, 6 total: 3 via `@xyflow/react`, 2 via
      `@xyflow/svelte`, 1 via `@xyflow/system`) — both match `derive.test.ts` exactly.
      Direct-wins precedence is read off the snapshot (`attribution.ts` resolves it once at
      ingest), not recomputed — confirmed by reading the ingest module, not assumed.
- [ ] FAIL — Change-volume series and history bounds. The "window with no activity" case is
      covered (`volumeSeries(snapshot, 24)` zero-bucket test). Two edges the code
      explicitly implements and comments on are not exercised by any test, because the
      committed fixture has no pull request that lands at or outside its own declared
      window. Confirmed by mutation, mutants applied and reverted, tree clean afterward:
      - `historyBounds`'s widening loop (a merge outside `metadata.window` should widen the
        bounds) — replacing the whole function with
        `return { from: snapshot.metadata.window.since, to: snapshot.metadata.window.until }`
        (deleting the loop entirely) leaves **all 41 tests in `derive.test.ts` +
        `layout.test.ts` + `catalog.test.ts` green**.
      - `volumeSeries`'s final-bucket clamp (`Math.min(bucketCount - 1, …)`) — deleting the
        clamp so `index` can equal `bucketCount` leaves **all 29 tests in
        `derive.test.ts` green**. In production this only misbehaves for a merge landing
        exactly at the widened `history.to`, which the fixture never produces, so the gap
        is real but narrow.
- [x] PASS — Layout: `layout.test.ts` asserts positioned nodes come back for a known graph
      and that two calls on the same input return the same positions
      (`returns the same positions for the same input`). Verified this actually
      discriminates: replacing the dagre-derived `x`/`y` with constants (`x: 0, y: 0`) kills
      `separates a dependent from its dependency along the flow axis` — reverted after.
- [x] PASS — `derive.test.ts:95-98` and `catalog.test.ts:33-38` both derive successfully
      from the committed snapshot, which genuinely has no `enrichment` key (confirmed by
      reading the JSON).

## Chunk-Specific Checks

- [x] PASS — Derivation (`derive.ts`) is plain functions over plain objects, imported and
      tested directly in `derive.test.ts`; no React import anywhere in the file.
- [x] PASS — `deriveWindow` filters `snapshot.packages.edges` to active-active pairs for
      `dependencyEdges`, and only touched packages carry `reachEdges`. Verified against the
      snapshot: all `devDependencies` edges in this fixture happen to target untouched
      tooling packages, so this fixture alone cannot prove the filter is active-based
      rather than kind-based — but the code (`derive.ts:207`) filters strictly by the
      active set regardless of `kind`, and the mutation that dropped the active-filter
      entirely (returning all edges unconditionally) was killed by two tests
      (`draws a dependency edge only when both ends are active`,
      `returns an empty active set for a range nothing landed in`). Reach vs dependency is
      dashed-violet vs solid-grey in `topology-canvas.tsx:111-114`, confirmed by reading
      the component.
- [x] PASS — Neither distinction rests on colour alone. `package-node.tsx`: untouched sets
      `opacity-45` **and** `border-dashed`, active sets `border-solid`; direct vs indirect
      differs in visible text ("N direct" vs "N via X") and in the accessible name
      (`aria-label`), not only in the amber/violet swatch colour.
- [x] PASS — Confirmed by gate 3, re-run independently with its own negative controls: file
      missing → exit 1; the actual source → exit 0 printing the exact class literals.
- [x] PASS — Slider shows full history (`min={min} max={max}` off `historyBounds`), the
      selected range as explicit dates (`dayMonth`/`dayMonthYear` formatters), volume
      clustering (histogram behind the track, square-root scale, a documented and
      reasoned judgment call), and all four documented presets (7d/30d/90d/all,
      `time-slider.tsx:24-29`).
- [x] PASS — Repository picker: `RepositoryPicker` never names a repository; rows come from
      `listSnapshots()`. Gate 2 re-run independently (script below) returns PASS scanning
      38 files (tracked + untracked union), and the negative control (planting
      `["xyflow/xyflow"]` in an **uncommitted** file) correctly fires — the union with
      `git ls-files --others --exclude-standard` is real, not just claimed.
- [x] PASS — Derivation succeeds on the un-enriched snapshot (see Test Coverage above); the
      picker renders it with `enriched: false` and no crash.
- [x] PASS — `layoutGraph` is a standalone function; `topology-canvas.tsx` calls it inside a
      `useMemo`, memoized on the view/focus, not inlined in JSX.
- [x] PASS — Empty state renders (`grain-workspace.tsx:132`, gated on
      `view.changeCount === 0`) with the exact copy from design page 7. See Warnings for a
      compound-state caveat that does not defeat this bullet on its own.
- [x] PASS — `PackageEdge`, `PullRequestRecord`, `Snapshot` imported from
      `src/lib/snapshot.ts` in `derive.ts:1`; `Snapshot`, `snapshotSchema` imported in
      `catalog.ts:1`. No re-declaration found.
- [x] PASS — Checked against `bibles/swe/testing.md` directly. Every assertion in
      `derive.test.ts`/`layout.test.ts`/`catalog.test.ts` reads the function's return value
      (`view.*`, `positioned[…]`, `listSnapshots()[…]`), not an echoed literal. The one
      place a test reads `snapshot.enrichment` is a stated precondition, not a resolved
      value being asserted.
- [x] PASS — `project.md` diff is empty (`git diff --stat … -- .claude/resources/project.md`
      shows nothing); the "project.md deltas" section is present, detailed, and each item
      is independently plausible (checked #2's `prebuild` claim directly against
      `package.json`).
- [x] PASS — All three judgment calls (range in state vs URL, histogram vs sparkline, focus
      on click vs hover) are explained with reasoning in the report.
- [ ] FAIL — The report never states that the mid-fi designs were supplied before the
      presentation components were built. It is true — `git merge-base --is-ancestor
      887056f de50039` confirms the design commit is an ancestor of this chunk's first
      commit — but that fact has to be dug out of git history; the rubric asks the
      completion report to say it, and it does not. Low severity: the report cites
      specific design pages throughout ("design page 7", "page 4/11 vs the plan"), which
      only makes sense if the designs were already in hand, so this is a documentation gap
      rather than a process one.
- [ ] FAIL — Design page 10 ("Time slider anatomy," owned by chunk 04 per the design
      README's table, not deferred to another chunk) documents `↕ resize` and
      `Home / End jump to repo start / end` as part of the slider's keyboard model, visible
      in the footer hint on both the dark (p.10) and light (p.11) renders. Neither is
      built, and neither is mentioned in § Deviations. Checked the installed
      `@base-ui/react` primitive directly
      (`node_modules/@base-ui/react/slider/thumb/SliderThumb.js:317-320`): on a two-thumb
      range, `Home`/`End` do not jump to the slider's `min`/`max` — they clamp to just
      beside the *other* thumb (`sliderValues[index-1] + step*minStepsBetweenValues` /
      `sliderValues[index+1] - step*minStepsBetweenValues`), which is not "jump to repo
      start/end" as the design specifies. No drag-the-whole-range gesture exists either.
      The report's § Judgment calls and § Deviations are otherwise unusually thorough about
      naming every other design deviation (edge labels, the `Expand` affordance, theme, the
      branch chip) — this one specific gap was missed.

### From the Convention Map — `src/lib/**/*.ts`

- [x] PASS — Standalone functions, no class/registry/provider.
- [x] PASS — No `fs` write, no `child_process`, anywhere under `src/lib/`. `fixture.ts` and
      `replay.ts`-style reads (`readFileSync`) are reads, which the principle allows.
- [x] PASS — No credential read under `src/lib/`.
- [x] PASS — All sibling imports are relative with an explicit `.ts` extension (checked
      every `import` line in `src/lib/view/*.ts`).
- [~] N/A (with a note) — `fixture.ts` has no co-located `*.test.ts`. Same shape as the
      existing `src/lib/ingest/fixtures/replay.ts`, which also has none — this chunk is
      consistent with a precedent the codebase already set for test-support-only modules,
      whose correctness is exercised indirectly (every spec that calls `loadSnapshot()`
      would fail if it were broken). Not counted as a bullet failure given the precedent,
      but worth someone deciding explicitly rather than by accretion.

### From the Convention Map — components and pages

- [x] PASS — Zero `ai`/`@ai-sdk` imports in any component; nothing rendered waits on a
      model call.
- [x] PASS — Zero `process.env` reads in components or pages.
- [x] PASS — `page.tsx` reaches every snapshot through `getSnapshot()`/`listSnapshots()`,
      which run every entry through `snapshotSchema.parse` in `catalog.ts:29`.
- [x] PASS — Confirmed already under Chunk-Specific.

### From the Convention Map — `src/components/ui/**`

- [x] PASS — `git diff --stat … -- src/components/ui/` is empty. `slider.tsx` is untouched
      since chunk 01's install; the two-handle capability was measured against the
      installed primitive rather than assumed (`_values`/`SliderThumb` array logic cited
      correctly in the report).

### From the Convention Map — `src/**/*.test.ts`, `src/**/*.test.tsx`

- [x] PASS — Consumer-value assertions throughout (see above).
- [x] PASS — Every spec reads the real replayed snapshot via `loadSnapshot()`, not a
      hand-rolled approximation.
- [x] PASS — All new specs live under `src/lib/view/*.test.ts`, matched by
      `vitest.config.mts`'s `src/**/*.test.{ts,tsx}`.
- [x] PASS — The reported count is asserted, not just the exit code — the report table
      cites the actual `Tests 135 passed (135)` string, and I independently reproduced it.

### From the Convention Map — `src/**/snapshots/**/*.json`

- [x] PASS — Re-ran `node scripts/build-snapshot-index.mts` after `cp`-ing the generated
      file aside; the regenerated file was byte-identical (`diff` empty). The snapshot file
      itself: T000's command is exact and reproducible per the plan's Context section;
      the report names the command precisely.
- [x] PASS — Not hand-edited: no diff against a clean regeneration.
- [x] PASS — No `enrichment` key confirmed by reading the JSON's top-level keys
      (`metadata`, `packages`, `pullRequests`).

### From the Convention Map — manifests and config

- [x] PASS — `pnpm-lock.yaml` is untouched (`git diff --stat` empty); `package.json`
      gained exactly the `prebuild` script line, no dependency change — consistent with "no
      new dependency."
- [x] PASS — `project.md` unmodified; deltas reported in the completion report.

### Deployment and parallel-wave boundary

- [x] PASS — `pnpm build` + `pnpm start` + `curl` measurement in the report is real and its
      logic holds: the snapshot's merge SHA is traced into `.next/server/chunks/ssr/*.js`
      and no `src/lib/snapshots` path exists anywhere under `.next`.
- [x] PASS — Build-time-generated index (`scripts/build-snapshot-index.mts` →
      `catalog.generated.ts`), not a hand-maintained array.
- [x] PASS — Confirmed via `git diff --stat` above: no `src/lib/ai/` file, no
      `scripts/ingest.mts` change.

## Mutation testing — commands and outcomes

All applied to a copy-backed file (`cp` to `/tmp`, restored with `cp` back, never
`git checkout --`), `git status --porcelain` empty before and after each.

```
# 1. Invert direct/indirect precedence in derive.ts's `state` field — KILLED
sed -i "s/state: directCount > 0 ? 'direct' : indirectCount > 0 ? 'indirect' : 'untouched',/state: indirectCount > 0 ? 'indirect' : directCount > 0 ? 'direct' : 'untouched',/" derive.ts
pnpm test -- --run derive.test.ts
  -> 1 failed: "keeps direct and indirect counts separate on a package that is both"

# 2. Remove the active-active filter on dependencyEdges — KILLED
dependencyEdges: snapshot.packages.edges.filter(...) -> dependencyEdges: snapshot.packages.edges,
pnpm test -- --run derive.test.ts
  -> 2 failed: "returns an empty active set...", "draws a dependency edge only when both ends are active"

# 3. Remove the final-bucket clamp in volumeSeries — SURVIVED
Math.min(bucketCount - 1, Math.max(0, ...)) -> Math.max(0, ...)
pnpm test -- --run derive.test.ts
  -> 29 passed (29). No test lands a merge at the exact upper boundary of a wide history.

# 4. Delete historyBounds's widening loop entirely — SURVIVED
historyBounds() -> return { from: window.since, to: window.until } (loop deleted)
pnpm test -- --run derive.test.ts layout.test.ts catalog.test.ts
  -> 41 passed (41). No fixture pull request lands outside the declared window.

# 5. Invert the indirectVia sort comparator — KILLED
.sort((a,b) => b.count - a.count || ...) -> .sort((a,b) => a.count - b.count || ...)
pnpm test -- --run derive.test.ts
  -> 2 failed: order-dependent assertions on astro-examples/react-examples

# 6. layout.ts: return x:0, y:0 instead of dagre's positions — KILLED
pnpm test -- --run layout.test.ts
  -> 1 failed: "separates a dependent from its dependency along the flow axis"

# 7. layout.ts: remove the known-node guard on setEdge (phantom-node comment) — SURVIVED,
   but weakly: the existing test only checks returned node ids, which are always taken
   from the input `nodes` array regardless of this guard, so the test cannot distinguish
   "phantom dropped" from "phantom created." Noted as a Warning, not counted with #3/#4
   since nothing in the current wiring (topology-canvas.tsx) ever calls layoutGraph with
   an edge referencing an absent node — the guard is defensive, not exercised in the app.
```

Gate re-runs (independent scripts, not copy-pasted from the report):

```
$ bash gate2.sh            # corpus union of tracked + untracked
gate 2: scanning 38 source files
gate 2: PASS
$ echo '["xyflow/xyflow"]' > src/components/canvas/__canary_uncommitted.ts && bash gate2.sh
gate 2: scanning 39 source files
FAIL: "xyflow/xyflow" is hardcoded in source: .../__canary_uncommitted.ts:1:...
$ rm __canary_uncommitted.ts   # git status clean after

$ bash gate3.sh
gate 3: PASS — inactive: opacity-45 + border-dashed; active: border-solid
$ mv package-node.tsx /tmp/backup && bash gate3.sh
FAIL: src/components/canvas/package-node.tsx is missing
$ mv /tmp/backup package-node.tsx   # git status clean after
```

## Verdict

**FAIL**

### Issues (blocking)

1. **Two mutation survivors on edges the derivation module explicitly implements and
   documents, with zero test exercising them.** `historyBounds`'s widening loop
   (`derive.ts:74-93`) and `volumeSeries`'s final-bucket clamp (`derive.ts:114`) can both
   be deleted without a single test failing, because the committed fixture happens to have
   no pull request outside its declared window and none landing exactly on the widened
   upper boundary. This is exactly the "test that cannot fail" failure mode the previous
   chunk was rejected for. Fix: add one snapshot-independent unit test per branch — a
   synthetic snapshot (still schema-valid, doesn't need to be the committed fixture for
   this specific case) with a pull request outside `metadata.window`, and a `volumeSeries`
   case with a merge timestamped exactly at `history.to`.

2. **A design-fidelity gap on a page this chunk owns, undisclosed.** Design page 10 (chunk
   04's, per the design README) specifies `Home`/`End` jump to the slider's full bounds and
   a whole-range resize gesture; neither is built, and — checked directly against
   `@base-ui/react`'s `SliderThumb.js` — the primitive's actual `Home`/`End` behavior on a
   two-thumb range does something different (clamps next to the other thumb) from what the
   design's footer hint promises. The report discloses four other design deviations
   carefully but misses this one. Fix: either implement it (a `onKeyDown` handler on the
   slider root overriding Home/End, or a drag handler on the lit segment) or add it to
   § Deviations with the same rigor as the other four.

3. **The completion report does not state that the designs preceded implementation**, as
   the rubric requires verbatim. It is true (`git merge-base --is-ancestor 887056f de50039`
   confirms it), but it has to be verified from git history rather than read off the
   report. Fix: one sentence in the report.

### Warnings (non-blocking)

- **Focus persisting into an empty range produces a self-contradicting empty state.** When
  `focused` is set and the user scrubs into a range with no activity, `TopologyCanvas`
  still narrows to the focused package's neighbourhood (one node), while `EmptyWindow`'s
  copy says "All {packageCount} packages are dimmed because none were reached" — the
  canvas the user sees does not match the sentence describing it. Neither the plan nor the
  designs depict this compound state, so it is not a rubric-item failure, but it is a real,
  reachable bug (scrub the slider while a node is focused). Cheapest fix: clear `focused`
  when `range` changes in `grain-workspace.tsx`'s `setRange`-driven flow, matching what
  `selectRepository` already does for repository switches.
- **`layout.ts`'s known-node guard is untested in a way that would matter if the wiring
  ever changed** — mutation #7 above. Low priority since nothing in `topology-canvas.tsx`
  currently calls `layoutGraph` with a dangling edge reference.
- **`fixture.ts` has no co-located spec.** Consistent with the existing
  `src/lib/ingest/fixtures/replay.ts` precedent, so not failed, but the precedent itself
  was never explicitly ratified anywhere — worth a one-line convention entry if it's meant
  to be a rule rather than an accident.

### Guidance

Fix Issue 1 first — it is the one the lead specifically asked to be checked for, it is
confirmed and reproducible, and it is cheap (two small synthetic-snapshot test cases, no
production code needs to change since the current behavior is already correct). Then
either build or disclose the slider's Home/End and resize behavior (Issue 2). Issue 3 is a
one-sentence addition. The Warning about focus-plus-empty-range is worth fixing in the same
pass since the code path is already open (`grain-workspace.tsx`), even though it isn't
blocking.
