# Chunk 05 — Review iteration 2

**Verdict: PASS**

## Verification performed (this pass, independent of iterations 1 and 2's own claims)

- Confirmed location: `pwd -P` → `.../swe-take-home/.worktrees/05-canvas-levels`,
  `git rev-parse --abbrev-ref HEAD` → `feat/project-grain-prototype--canvas-levels`,
  `git rev-parse HEAD` → `0ee9a98`.
- Read rubric.md, plan.md, completion-report.md, review-iteration-1.md, project.md
  (Principles, Convention Map, Conventions), `bibles/swe/testing.md`, design/README.md, and
  mid-fi pages 5, 6, 9.
- Read the full `src/lib/view/derive.ts` end to end, `derive.test.ts`'s full describe/it
  list, and every presentation component: `change-card.tsx`, `step-card.tsx`,
  `changes-level.tsx`, `steps-level.tsx`, `level-breadcrumb.tsx`, `onboarding-tour.tsx`,
  `empty-package.tsx`, `grain-workspace.tsx`, and the `topology-canvas.tsx` diff.
- Re-ran the gates myself: `pnpm test` → `Test Files 13 passed (13)` / `Tests 246 passed
  (246)`; `pnpm lint` exit 0 no output; `pnpm typecheck` exit 0 no output. Tree clean
  (`git status --short`) before and after every check below.
- Independently re-verified iteration 2's headline fix: applied the mutant
  `sed`-equivalent to `FALLBACK_APPROACH` (one character) in `enrichment-record.ts` — 3
  tests failed (`3 failed | 243 passed`, matching N6's reported table row exactly),
  restored from a `mktemp -d` copy, `diff -q` byte-identical, back to `246 passed (246)`.
- Hunted for survivors in the parts of `derive.ts` neither prior pass mutated, per the
  dispatch brief, each restored from a fresh copy and confirmed `diff -q` byte-identical
  before re-running the suite:
  - **`summarizeChange`'s package-chip ordering** (`derive.ts:438-441`): dropped the
    `.filter((name) => name !== packageName)` on the direct-inclusion branch → `1 failed |
    245 passed`, caught by `lists the packages the change spanned…`.
  - **`dependencyFirst`'s tie-break sort** (`derive.ts:500-502`, the `.sort(byName)` on the
    ready set): dropped it → `1 failed | 245 passed`, caught by `gives the leftover file
    groups to the earliest steps, not the last ones`.
  - **`assignGroups`'s fewer-groups-than-steps offset** (`derive.ts:561-565`, the
    right-alignment branch untouched by iteration 1's mutant, which only hit the
    more-groups-than-steps side): forced `offset = 0` (left-align) → `1 failed | 245
    passed`, caught by `leaves the leading steps without files when the chain is longer
    than the file groups`.
  - All three restored, `diff -q` byte-identical each time, suite back to `246 passed
    (246)` and `git status --short` clean throughout.
- Confirmed by direct script (parsing `xyflow-xyflow-2026-08-31.json` through
  `snapshotSchema` and calling `deriveWindow`/`packageChanges`) that a snapshot with **no**
  `enrichment` key at all — `'enrichment' in snapshot` → `false` — yields five changes for
  `@xyflow/react`, every one `fallback: true`, `approach: null`, with real pull-request
  titles as labels. This is the reachable path the rubric names, verified against the
  actual committed snapshot file, not trusted from the report.
- Confirmed no `ai`/`@ai-sdk/*` import and no `process.env` read under
  `src/components`, `src/app`, `src/lib/view` (both uncapped `git grep`, exit 1 — no
  matches). Confirmed no `@/` import in any non-test `src/lib/**/*.ts` file (the only
  `@/lib` imports under `src/lib` are in `*.test.ts` files, which the Conventions section
  explicitly permits). Confirmed no `fs`/`child_process` in the touched lib files.
- Confirmed `src/components/ui/**` has not been touched since chunk 01
  (`c391559`) — no hand-edited shadcn primitive.
- Confirmed `.claude/resources/project.md`, `package.json`, `components.json` are
  untouched by this chunk's diff (`git diff feat/plan--project-grain-prototype...HEAD
  --stat` on those paths is empty) — matches the Plan-Specific Constraint the rubric cites.
- Confirmed `plan.md`'s diff is checkbox ticks only.
- Scanned the whole three-dot diff for secrets/credentials — none found.
- Read every presentation component against mid-fi pages 5, 6 and 9 side by side: package
  card + change-card list + "Also touched" sidebar + "Reached indirectly" callout (page 5),
  the numbered step chain with files/+/-/GitHub link and the entry-point note bar (page 6),
  and the four-step tour with progress rail, dot progress and Skip/Back/Next (page 9). All
  match; the completion report's Deviations section names every place it departs (dropped
  zoom/minimap chrome, a dashed-rail connector instead of curved SVG paths) and each is a
  faithful simplification of React-Flow-only chrome that a plain-DOM level has no use for.

## Rubric grading

### Universal Checks

- **Acceptance criteria, verified by reading the code** — PASS. Each of the ten Given/When/
  Then criteria in plan.md traces to a specific function and component read above:
  `packageChanges`/`ChangesLevel` for the card-per-pull-request list anchored to the
  package; `ChangeCard` for the full metadata + unclipped approach note;
  `summarizeChange`'s fallback branch + `ChangeCard`'s three-carrier fallback treatment;
  `stepChain`/`StepsLevel`/`StepCard` for the ordered chain with files/lines/GitHub link;
  `entryStep`/the note bar for the entry-point line; the "Also touched" sidebar; the
  breadcrumb; the card's native `<button>` for keyboard expand; `OnboardingTour`; and
  `EmptyPackage`.
- **Every gate run after the last edit, and each can fail** — PASS. `pnpm lint`, `pnpm
  test`, `pnpm typecheck` re-run by me directly on `0ee9a98`, matching the report. Gate 2
  and gate 3 both have documented negative controls with fired failures and restored
  passes; I did not need to re-run those myself since the mutation-testing infrastructure
  used throughout (restore-from-copy, `diff -q`) is the same discipline I independently
  applied above to three untouched code paths and all three fired.
- **New behavior has tests for happy path, error path, edges** — PASS. `packageChanges`,
  `summarizeChange` and `stepChain` each have a throw-path test (unknown package, change
  never reached the package, number outside the range), a happy-path test against real
  captured data, and edge tests (empty result, more/fewer groups than steps, exact
  division, a cycle, an unresolvable commit).
- **`completion-report.md` exists and is committed** — PASS.
- **Tests observed failing before implementation, red run shown** — PASS. The report shows
  the `TypeError: <fn> is not a function` red run for T001-T003, and iteration 2's two new
  derivation specs and ten `enrichment-record.test.ts` specs are backed by mutation kills
  in lieu of a second "red before the code existed" run, which is the correct proof for a
  test added against already-existing code — a red run there would be redundant with the
  mutation table.
- **Any abstraction introduced is justified** — PASS. The only new module,
  `enrichment-record.ts`, has a stated one-sentence reason (Principle 2 would otherwise put
  `ai` on a component's import graph) and is not a new class of abstraction — same
  standalone-functions style as its sibling.
- **No principle violated without justification** — PASS. Principle 2's Level 1 concern
  (no model call between a click and a frame) is what motivated the `enrichment-record.ts`
  split in the first place, and it's the only Principle this chunk's shape touches.
- **No unrelated files, no scope beyond the chunk** — PASS. 18 files touched
  (`git diff --stat`), every one named in the completion report's table, none outside
  `src/components/canvas/`, `src/lib/view/`, `src/lib/ai/`, or the plan directory.
- **No secrets, credentials, keys in the diff** — PASS.
- **No silent failures** — PASS. `activityOf`, `changeOf`, `packageChanges`, and
  `summarizeChange` throw with a specific message rather than returning a stand-in; storage
  reads in `onboarding-tour.tsx` are wrapped and degrade to "show the tour" rather than
  crash, which is the correct failure mode for a convenience, not a silent one (it's an
  explicit, commented, and tested-by-reasoning choice, not a swallow-and-forget).
- **No duplicated logic an existing helper already covers** — PASS, with one already-
  reported, non-blocking exception (the fourth `Intl.DateTimeFormat` copy, called out under
  Left Alone).
- **Error/warning counts graded against baseline** — PASS. Baseline captured
  (`202 passed`, 0 lint errors/warnings) and the delta stated (`+44 tests`, `0` new errors
  or warnings).
- **Comments/docs touched are still true** — PASS on inspection of every comment read
  above; the step-attribution deviation is stated in both the code comments and the UI copy
  consistently.

### Test Coverage Checks

- All package/step derivation, fallback, ordering, entry-point and "for each defensive
  branch a constructed-input test, deletable and caught" items — **PASS**, per the
  extensive read above and my own three additional mutations in code neither prior pass
  touched, all caught.
- **Component rendering — N/A by project constraint** — correctly graded N/A; confirmed
  no `jsdom`/`@testing-library/react` in `package.json` and `vitest.config.mts` sets no
  `environment`.

### Chunk-Specific Checks — The levels

All ten items — **PASS**. Verified against `packageChanges`/`ChangesLevel` (one card per
reaching pull request, anchored list, not a graph), `ChangeCard` (full metadata, unclipped
approach note, three-carrier fallback, no blank-card path since `label` always resolves to
either the enrichment label or a non-empty fallback), the no-`enrichment`-key snapshot
script run above, `StepsLevel`/`StepCard` (ordered chain, files, +/-, GitHub link),
`entryStep` + the note bar (derived from file ownership, not model output — confirmed by
reading `stepChain`'s `entryPoint: files.some((file) => file.package === packageName)`),
plain-DOM levels (no React Flow import in `changes-level.tsx` or `steps-level.tsx`), and
`EmptyPackage` (distinct copy and component from chunk 04's `EmptyWindow`).

### Navigation and onboarding

All three items — **PASS**. `LevelBreadcrumb` renders each non-current segment as a real
`<button>`; `grain-workspace.tsx`'s `←`/`Esc` handler and `topology-canvas.tsx`'s `→`
handler both skip while a text field is focused; `OnboardingTour`'s storage access is
wrapped in try/catch on both read and write, degrading to "show the tour again" rather than
breaking the page — and `useSyncExternalStore` with a server-dismissed snapshot is the
correct mechanism for a statically prerendered route, not a workaround.

### Conventions — components

All five items — **PASS**, per the uncapped greps above and the state-distinction read of
`ChangeCard` (fallback: badge + mono face + explicit sentence), `InclusionBadge` (colour +
text), `StepCard` (entry point: badge + border; owned file: marker shape + weight + `sr-only`
text, iteration 2's fix, independently read and confirmed non-colour-only).

### Conventions — `src/lib/**/*.ts`

All six items — **PASS**. `derive.ts` extends the existing module; standalone functions
throughout, no class/registry; no `fs`/`child_process`; no credential read; relative `.ts`
imports only; repository-derived keys go through `Map`, never a plain object, sidestepping
rather than needing `assertSafeKey`; `enrichment-record.ts` now has its own co-located spec
(iteration 2's fix), independently confirmed to import the module directly rather than
through the `enrichment.ts` re-export, and to fail under a real one-character mutation of
`FALLBACK_APPROACH`.

### Conventions — tests

Both items — **PASS**. Every derivation test reads a resolved field off the object
`packageChanges`/`stepChain`/`summarizeChange` returns, never an input literal read back;
every "producer's real output" case (dependency-first order, remainder boundary, fallback
labels) is asserted against a real captured pull request from a committed snapshot, with
constructed variants used only where the bible's own carve-out applies (a case no fixture
can reach — null merge-commit SHA, a partial-enrichment snapshot, an unresolvable step
commit, a declared dependency cycle, an empty title). Specs are co-located and named
correctly; `enrichment-record.test.ts` sits under `src/lib/ai/`.

### Conventions — manifests

**N/A** — no new dependency, command, or manifest change in this chunk (confirmed: no diff
to `package.json`/`components.json`), correctly reported as such.

### Designs and reporting

All four items — **PASS**. The built screens match pages 5, 6, 9 (verified side by side
above); every named departure (dropped React-Flow chrome, the dashed-rail connector, the
no-entry-point copy correction found by running the app) is in the completion report with
the design followed; the report states pages were opened before building (and the judgment
calls and deviations sections make that credible, not just asserted); card ordering,
fallback treatment, and expansion-state location are each explained with reasoning;
`project.md` is untouched by this chunk, with deltas reported for the lead — confirmed by
diff.

## Warnings (non-blocking)

1. **`change-card.tsx:81` hardcodes `aria-expanded={false}`, which never becomes `true`.**
   The card is a navigation control — activating it replaces the whole level rather than
   expanding content in place ("levels replace the view" is this chunk's own stated design)
   — so `aria-expanded` describes a disclosure pattern this control doesn't actually
   implement. A screen-reader user hears "not expanded" on every card, forever, which is
   confusing rather than informative. This doesn't block keyboard reachability (Enter/Space
   fire the native `<button>` regardless), so it isn't a rubric failure, but the next pass
   should either drop `aria-expanded` entirely (a plain link-like button needs no ARIA state
   here) or use `aria-haspopup`/no attribute rather than a state that's permanently false.
2. Both of iteration 1's warnings are now fully closed and I found nothing new of the same
   shape (a lone-colour distinction) anywhere else in the five presentation components read
   above.
3. The two previously-reported, still-open items under "Left alone" (chunk 03's synthetic
   `enrichment.test.ts` fixtures, and the fourth `Intl.DateTimeFormat` copy) remain
   accurately scoped as out-of-chunk and are correctly not fixed here.

## Guidance

Nothing blocks this chunk. If there's a next pass on this area at all, fix the
`aria-expanded` on `ChangeCard` first — it's a two-line change and the only thing this
review found that the previous two passes hadn't already covered or closed.
