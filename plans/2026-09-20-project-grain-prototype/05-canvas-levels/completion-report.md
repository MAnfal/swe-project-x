# Chunk 05 — Completion Report

Branch `feat/project-grain-prototype--canvas-levels`, base commit
`0914657489e0fb34adf1c7375a5e3738e0e081df`.

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `src/lib/view/derive.ts` | edited (+336 / −1) | Chunk 04's derivation module gains Level 2 and Level 3: `ChangeInclusion`, `ChangeSummary`, `StepDetail`, `StepChain`, `summarizeChange`, `packageChanges`, `changeOf`, `stepChain`, and the private `realEnrichment` / `dependencyFirst` / `fileGroups` / `assignGroups` helpers. No second module. |
| `src/lib/view/derive.test.ts` | edited (+379) | 32 new specs across T001 (package-level derivation), T002 (the fallback path) and T003 (step derivation). |
| `src/lib/view/fixture.ts` | edited (+92) | Test support for constructed inputs: `enrichedSnapshot`, `snapshotMissingEnrichmentFor`, `snapshotWithEnrichment`, `snapshotWithoutMergeCommitSha`, `snapshotWithExtraEdges`, `snapshotWithTitle`. Each varies exactly one field of the **real captured snapshot** and re-parses through `snapshotSchema`; the snapshot files are never edited (Principle 4). |
| `src/lib/ai/enrichment-record.ts` | **created** (+66) | The model-free half of the enrichment contract — `enrichmentKey`, `FALLBACK_APPROACH`, `FALLBACK_STEP_SUMMARY`, `MAX_LABEL_CHARS`, `isFallbackEnrichment`, `fallbackEnrichment`. See Deviations: `derive.ts` needs two of these and is imported by client components, and `enrichment.ts` imports `ai`. |
| `src/lib/ai/enrichment.ts` | edited (+21 / −50) | Those six symbols moved out and are **re-exported** from here, so chunk 03's public surface is unchanged. Nothing else in the module changed. |
| `src/components/canvas/change-card.tsx` | **created** | The Level 2 change card (design page 5) — label, `#N · author · merged date`, package chips, the approach note **in full**, step count. Also exports `PackageChips` and `InclusionBadge`, reused by Level 3. |
| `src/components/canvas/step-card.tsx` | **created** | The Level 3 step card (design page 6) — position, `your package` badge on the entry point, files, `+N −M`, `Open on GitHub`. |
| `src/components/canvas/changes-level.tsx` | **created** | The Level 2 screen: anchored package card, the change list, the `Also touched` sidebar, the hidden-package count, the `Reached indirectly` callout. |
| `src/components/canvas/steps-level.tsx` | **created** | The Level 3 screen: change header with the approach note, `How it was built`, the left-to-right chain, the entry-point line, `Next change →`. |
| `src/components/canvas/level-breadcrumb.tsx` | **created** | `repository / package / change`, each non-current segment a button returning to that level, plus the level indicator and its keyboard hint. |
| `src/components/canvas/onboarding-tour.tsx` | **created** | The four-step walkthrough (design page 9), with the progress rail, dot progress, `Skip tour` / `Back` / `Next`, and the dismissal persisted in `localStorage`. |
| `src/components/canvas/empty-package.tsx` | **created** | Level 2 with no changes — distinct from chunk 04's `EmptyWindow`. |
| `src/components/canvas/grain-workspace.tsx` | edited (+189 / −…) | Holds the expansion state, switches the three levels under one persistent slider, renders the breadcrumb and the replay control, and owns the `←`/`Esc` back-out handler. |
| `src/components/canvas/topology-canvas.tsx` | edited (+53) | Level 1 gains the `Expand N changes →` affordance on the focused package and the `→` key that fires it, per design page 4. |

### Reuse

- `Reuse: importing deriveWindow, historyBounds, volumeSeries, nearestActivity, activityOf, presetRange, WindowView, PackageActivity, DateRange, HistoryBounds from src/lib/view/derive.ts` (chunk 04).
- `Reuse: extending src/lib/view/derive.ts rather than creating a second derivation module.`
- `Reuse: importing enrichmentKey, isFallbackEnrichment, fallbackEnrichment from src/lib/ai/enrichment-record.ts` (chunk 03's logic, relocated — the fallback **label rule** is not re-derived in `derive.ts`; mutant M4 below proves the reuse is load-bearing).
- `Reuse: importing listSnapshots, getSnapshot, SnapshotEntry from src/lib/view/catalog.ts` — the snapshots directory is never read directly.
- `Reuse: importing Badge from src/components/ui/badge, Button from src/components/ui/button, Dialog/DialogContent/DialogDescription/DialogTitle from src/components/ui/dialog` (chunk 01). No new shadcn primitive was generated; the CLI was not run.
- `Reuse: importing EmptyWindow, RepositoryPicker, TimeSlider, TopologyCanvas from src/components/canvas/` (chunk 04).
- `Reuse: importing loadSnapshot, snapshotWithDeclaredWindow from src/lib/view/fixture.ts` (chunk 04).
- **Local-persistence helper: none existed.** `git grep -n -E "localStorage|sessionStorage|useLocalStorage|window\.storage" -- src scripts` → exit 1, no output. The wrapped accessors in `onboarding-tour.tsx` are the first in the tree.

## Acceptance criteria

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| One change card per pull request that reached the expanded package, directly or indirectly, laid out as a list anchored to the package | yes | `packageChanges — the changes that reached a package (T001) > returns one entry per pull request that reached the package in the range` asserts `changes.length === activity.direct + activity.indirect === 36`, and that every number is distinct. Layout: `src/components/canvas/changes-level.tsx` renders a `<ul>` of `ChangeCard`s beside the package card — no React Flow. Screenshotted in the running app. |
| A card shows label, number, author, merge date, spanned packages, and the approach note in full | yes | `… > carries the enrichment label and the approach note in full` asserts the full 157-character approach string, the label, the author and the URL; `… > lists the packages the change spanned…` and `… > puts the expanded package last…` assert the chips. `change-card.tsx` renders `{change.approach}` as a `<p>` with no truncation class — gate 2 pins the field's presence. |
| A change whose enrichment failed or is absent shows the pull request's own title and is distinguishable | yes | Three specs: `falls back to the pull request title for a snapshot with no enrichment at all` (the real un-enriched capture), `falls back for one pull request when the snapshot has enrichment for the others`, `treats a degraded enrichment record as a fallback rather than as a real label`. Plus `never yields an empty label, even when the pull request has no title`. Treatment is described under Judgment calls; verified in the app on `xyflow-xyflow-2026-08-31`. |
| Steps render as an ordered left-to-right chain, each step naming its files, lines added/removed, and a GitHub link | yes (with one measured limitation) | `stepChain … > returns the enrichment steps in order, numbered from one`, `> links each step to its own commit on the pull request`, `> accounts for every changed file exactly once across the chain`. Rendered as a horizontal `<ol>` in `steps-level.tsx`. **Limitation:** the snapshot records files per pull request, not per commit — see Deviations. |
| The first step whose files the expanded package owns is marked as the entry point and named beneath the chain | yes | `> marks the first step whose files the expanded package owns as the entry point`, `> never marks more than one step as the entry point, for any change in the capture` (sweeps 100+ package/change pairs), `> reports no entry point when the change never named the expanded package`. The line beneath the chain is the note bar in `steps-level.tsx`; screenshotted reading *"Step 3 is where this change entered `@xyflow/react`."* |
| Other packages with activity are listed alongside, each reachable without collapsing first | yes | `Also touched` sidebar in `changes-level.tsx`, one button per active package calling `onOpenPackage`. Exercised in the running app: from `playwright` the sidebar's `@xyflow/svelte` button moved the breadcrumb to `xyflow/xyflow/@xyflow/svelte` with 32 cards, without passing through Level 1. |
| The breadcrumb shows repository → package → change, each segment returning to that level | yes | `level-breadcrumb.tsx`; non-current segments are `<button>`s. In the app the trail read `xyflow/xyflow / @xyflow/react / Changed fitView padding default…` at Level 3. |
| A change card can be expanded and collapsed from the keyboard alone | yes | The card is a single `<button>` with `aria-expanded`, so Enter/Space fire natively; `←`/`Esc` collapse. Exercised with the keyboard only: `ArrowRight` on the focused node → Level 2, `ArrowLeft` → back to Level 2 from Level 3, `ArrowLeft` again → Level 1, each confirmed by reading the level indicator back out of the DOM. |
| A first visit shows a dismissible walkthrough introducing the slider and the three levels, replayable afterwards | yes | `onboarding-tour.tsx`, four steps. In the app: it opened unprompted on the first visit, `Skip tour` dismissed it, a fresh page load reported `{"tourOpen": false}`, and the header's `Replay tour` button reopened it at `1 of 4` with `localStorage` still `"true"`. |
| A package expanded in a window with no changes says so rather than rendering an empty canvas | yes | `empty-package.tsx`. Exercised: `playwright` expanded, then the `7d` preset → *"Nothing reached `playwright` — No change touched `tests/playwright`… between Sep 13 and Sep 20, 2026."* Distinct wording and distinct component from chunk 04's `EmptyWindow`. |

## Tests

The red run was captured **before** any of the four new functions existed. Full output:
`Test Files 1 failed | 11 passed (12)` / `Tests 30 failed | 202 passed (232)`, every failure
`TypeError: <fn> is not a function`.

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| `packageChanges — the changes that reached a package (T001)` (10 specs) | `TypeError: packageChanges is not a function` at `derive.test.ts`; the throw-assertion form reported `expected [Function] to throw error matching /no package named/ but got '(0 , __vite_ssr_import_1__.packageChanges) is not a function'` | pass |
| `packageChanges — the fallback path (T002)` (6 specs) | `TypeError: packageChanges is not a function` / `TypeError: changeOf is not a function` | pass |
| `stepChain — how one change was built (T003)` (12 specs) | `TypeError: changeOf is not a function` | pass |
| `changeOf` (2 specs) | `TypeError: changeOf is not a function`; the negative form `expected [Function] to throw error matching /no change numbered/ but got '(0 , __vite_ssr_import_1__.changeOf) is not a function'` | pass |

Green: `pnpm test` → `Test Files 12 passed (12)` / `Tests 234 passed (234)`, exit 0.
Baseline was `12 passed (12)` / `202 passed (202)`. Delta **+32 tests, 0 failures**.

### Mutation evidence

"Tests first, seen failing" proves a test fails when the module is *missing*; it proves
nothing about a test failing when the module is *wrong*. Every new guard and boundary
comparison was therefore deleted or inverted in turn, with the suite run against the
mutant and the file restored from a `mktemp -d` copy (never `git checkout --`), each
restore verified byte-identical with `diff -q`.

| Mutant | Killed by | Result |
| ------ | --------- | ------ |
| M1 — `realEnrichment`: drop the "no `enrichment` key at all" guard | `falls back to the pull request title for a snapshot with no enrichment at all`, `yields an empty chain rather than throwing when the change has no enrichment` | `2 failed \| 231 passed` |
| M2 — `realEnrichment`: drop the `hasOwnProperty` guard | `falls back for one pull request when the snapshot has enrichment for the others`, `never yields an empty label, even when the pull request has no title` | `2 failed \| 231 passed` |
| M3 — `realEnrichment`: treat a degraded record as a real one | `treats a degraded enrichment record as a fallback rather than as a real label`, `yields an empty chain for a degraded enrichment record` | `2 failed \| 231 passed` |
| M4 — `summarizeChange`: use `pullRequest.title` instead of the shared `fallbackEnrichment` label | `never yields an empty label, even when the pull request has no title` | `1 failed \| 232 passed` |
| M5 — `summarizeChange`: drop the "never reached this package" throw | `throws when asked to summarize a change that never reached the package` | `1 failed \| 232 passed` |
| M6 — `packageChanges`: order newest-merge-first instead of oldest-first | `orders the changes by merge date, oldest first` | `1 failed \| 232 passed` |
| M7 — `packageChanges`: drop the unknown-package throw | `throws for a package the snapshot does not contain` | `1 failed \| 232 passed` |
| M8 — `changeOf`: return `undefined` instead of throwing | `throws rather than returning undefined for a number outside the range` | `1 failed \| 232 passed` |
| M9 — `dependencyFirst`: drop the cycle branch | `still covers every file when the declared dependencies form a cycle` | `1 failed \| 232 passed` |
| M10 — `fileGroups`: drop the root-files group | four specs including `accounts for every changed file exactly once across the chain` | `4 failed \| 229 passed` |
| M11 — `assignGroups`: left-align instead of right-align when steps outnumber groups | `leaves the leading steps without files when the chain is longer than the file groups` | `1 failed \| 232 passed` |
| M12 — `stepChain`: link the pull request for every step instead of resolving the commit | `links each step to its own commit on the pull request` | `1 failed \| 232 passed` |
| M13 — `stepChain`: always build a commit URL, even for an unresolvable SHA | `falls back to the pull request link for a step naming a commit it does not contain` | `1 failed \| 232 passed` |
| M15 — `entryPoint`: compare `files.length > 0` instead of the package name | three specs including `never marks more than one step as the entry point, for any change in the capture` | `3 failed \| 231 passed` |

**One mutant survived, and it exposed real dead code.** M14 — "mark *every* step whose
files the package owns, not just the first" — left `234 passed (234)`. The tie-break
`entryStep === null && …` could never fire, because a package's files form exactly one
group and a group is assigned to exactly one step. Rather than leave an unpinned branch I
**deleted the guard** and added
`never marks more than one step as the entry point, for any change in the capture`, which
sweeps every touched package × every change in the enriched capture (`checked > 100`)
asserting `marked.length <= 1` and `entryStep === marked[0]?.position ?? null`.

A re-mutation confirms the remaining pair is equivalent, not untested: **M14b** — scan the
chain in reverse to pick the *last* owning step instead of the first — still passes
(`234 passed`), which is exactly what the new invariant test proves must happen. Recorded
as an equivalent mutant with its proof, not as a gap.

Nine of the guards above take **constructed** inputs rather than committed-snapshot ones,
because the fixtures cannot contain the case: a partially-enriched snapshot (the committed
invariant is "absent, or complete — never partial", `src/lib/ai/baked-snapshots.test.ts`), a
null `mergeCommitSha` (measured: 0 of 242 captured pull requests have one), a step naming a
commit the pull request does not contain (`resolveSteps` rejects those at bake time), a
pull request with no title, and a declared dependency cycle.

## Gates

Baseline captured at
`/private/tmp/claude-501/-Users-anfal-Projects-hobby-projects-swe-take-home/db93d2b0-7890-495e-8e1f-bd20c218f06b/scratchpad/baseline/`
on the base commit **before any edit**: `pnpm lint` exit 0 with **no output** (0 errors,
0 warnings); `pnpm test` `Test Files 12 passed (12)` / `Tests 202 passed (202)`;
`pnpm build` exit 0; `pnpm typecheck` exit 0 with no output. Every result below is the
delta against that, and the delta is **0 new errors and 0 new warnings**.

All four standard gates were re-run **after the last edit**, in order, type check last.

| Gate | Command | Result | Fails on base? |
| ---- | ------- | ------ | -------------- |
| Lint | `pnpm lint` | exit **0**, no output. Delta vs baseline: 0 errors, 0 warnings. | n/a — a regression gate; it passes on base by design. It *did* fire on this chunk mid-flight: two `react-hooks/set-state-in-effect` **errors** in `onboarding-tour.tsx` (`Avoid calling setState() directly within an effect`), fixed by moving to `useSyncExternalStore` — see Judgment calls. |
| Tests | `pnpm test` | `Test Files 12 passed (12)` / `Tests 234 passed (234)`, exit **0** | n/a — a regression gate. The 32 new specs were all observed red first (see Tests). |
| Build | `pnpm build` | exit **0**, `✓ Compiled successfully`, `Finished TypeScript`, `○ (Static) prerendered as static content` for `/` | n/a — a regression gate. |
| Type check | `pnpm typecheck` | exit **0**, no output. Run **last**. | n/a — a regression gate. |
| Gate 2 — the change card renders the approach note | see block below | `gate 2 PASS — corpus 20 files, card_src=src/components/canvas/change-card.tsx, approach hits=4`, exit 0 | **yes.** Against the base commit (read with `git ls-tree` / `git show`, mutating nothing): `FAIL: no change card component found (corpus was 13 files)`, exit **1**. |
| Gate 3 — the test runner really executed tests | `out=$(pnpm test 2>&1); echo "$out" \| grep -Eq '[1-9][0-9]* (passed\|passing)'` | `gate 3 PASS — runner reported: Tests  234 passed (234)`, exit 0 | **No, and it cannot** — it is a vacuity guard on the runner, not a content gate, and the base tree already runs 202 tests. Reported as a false pass rather than claimed as a base-tree falsification. Its negative control is below and it does fire. |

Gate 2 as run (the plan's version, with the corpus count surfaced in the failure message):

```bash
corpus=$(git ls-files 'src/components/**' | wc -l | tr -d ' ')
[ "$corpus" -gt 0 ] || { echo "FAIL: no component files tracked at all" >&2; exit 1; }
card_src=$(git ls-files 'src/components/**' | grep -iE 'change.*card.*\.tsx$' | head -1)
[ -n "$card_src" ] || { echo "FAIL: no change card component found (corpus was $corpus files)" >&2; exit 1; }
grep -qE '\bapproach\b' "$card_src" || { echo "FAIL: the change card does not render the approach note" >&2; exit 1; }
```

The plan's gate 2 was **not** vacuous — `[ -n "$card_src" ]` already fails on an empty
corpus, since an empty `git ls-files` yields an empty `card_src`. The explicit `corpus`
count was added only so the failure message distinguishes "no components at all" from "no
change card", which is the distinction the vacuity trap hides.

### Negative controls, per assertion

Each canary was applied, the gate observed red, the file restored **from a `mktemp -d`
copy** (never `git checkout --`), and the gate observed clean again — the four-step cycle.

| Assertion | Canary | Gate fired | Restored clean |
| --------- | ------ | ---------- | -------------- |
| Gate 2 #1 — corpus non-empty | covered by #2's message (`corpus was 13 files` on base) | — | — |
| Gate 2 #2 — a change card exists | `change-card.tsx` moved aside and un-staged | `FAIL: no change card component found (corpus was 19 files)`, exit 1 | `diff -q` byte-identical; gate re-reported `PASS … approach hits=4`, exit 0 |
| Gate 2 #3 — it renders `approach` | every `approach` renamed to `APPROACH_REMOVED_BY_CANARY` (`grep -c '\bapproach\b'` → **0**) | `FAIL: the change card does not render the approach note`, exit 1 | `diff -q` byte-identical; gate re-reported `PASS … approach hits=4`, exit 0 |
| Gate 3 — the runner executed tests | `vitest.config.mts` include changed to `src/**/*.no-such-spec.{ts,tsx}` | `No test files found, exiting with code 1` → `FAIL: test runner reported no executed tests`, exit 1 | `diff -q` byte-identical; gate re-reported `PASS — Tests 234 passed (234)`, exit 0 |

### Runtime evidence

A green type check cannot prove a screen renders, so every level was driven in
`pnpm dev` at `http://localhost:3000`, on **both** an enriched snapshot
(`xyflow-xyflow-2026-06-22`) and the un-enriched one (`xyflow-xyflow-2026-08-31`):
Level 1 → `Expand N changes →` → Level 2 → a change → Level 3, back out with the keyboard,
the `Also touched` sideways move, the empty-package state, and the tour's first-visit /
dismiss / reload / replay cycle. `list_console_messages` filtered to `error` and `warn`
returned **no messages** on both runs.

### Principle 2 — no AI SDK on a component path

The extraction in `enrichment-record.ts` exists to hold this, so it was measured rather
than asserted:

- `git grep -n -E "from '(ai|@ai-sdk/[^']*)'|require\('(ai|@ai-sdk)" -- src/components src/app src/lib/view` → **exit 1**, no matches (uncapped).
- `grep -rl '@ai-sdk\|generateObject(' .next --include='*.js'` over the whole build output → **0 files**.
- Search scope proven live by the converse: `grep -rl "Enrichment did not complete for this pull request" .next --include='*.js'` finds `enrichment-record.ts`'s constant in the SSR chunk **and** in the client chunk `.next/static/chunks/3g4w25le090si.js`. So the module the view needs is bundled and the AI SDK is not.
- The single `generateObject` string anywhere under `.next` is inside `zod/v4/core/compile.js`'s `sourcesContent` in a `.map` — an unrelated identifier in a dependency's source, not emitted code. `grep -o generateObject` on the emitted `.js` → **0**.

## Judgment calls

- **Change-card ordering: merge date ascending, oldest first**, tie-broken by pull request
  number. Design page 5 lists its four cards `merged Aug 28 → Sep 2 → Sep 5 → Sep 9`, and
  Level 2 is read as a narrative of what happened while the owner was away. This
  **contradicts** `deriveWindow`'s `pullRequests`, which chunk 04 sorts newest-first for the
  Level 1 counts; that order is untouched and `packageChanges` re-sorts its own copy.
  Pinned by mutant M6.
- **Fallback treatment: three carriers, none of them hue.** (1) An outline `Unenriched`
  badge with a warning glyph. (2) The label is set in the **mono** face at a smaller weight
  — the face a raw pull request title is written in — rather than the prose face a model
  label gets. (3) Where the approach note would be, an italic muted sentence: *"No approach
  note — enrichment has not run for this change, so this is the pull request's own title
  rather than a summary of how the work was done."* Plus the step affordance reads
  `no steps` instead of a count. A viewer cannot mistake one for the other, and none of the
  four distinctions is colour.
- **Expansion state lives in component state, not the URL.** Same reasoning chunk 04
  recorded for the repository and range, now extended: the URL is chunk 06's surface (it
  owns `Other…`, the repository URL input and the back arrow, and a query parameter added
  here would be rewritten there), and keeping this route free of query parameters keeps it
  statically prerenderable — which is what makes the committed snapshots provably part of
  the deployed bundle. `pnpm build` still reports `○ (Static) prerendered as static
  content` for `/`. **The cost: an expanded view cannot be shared as a link.**
- **Levels 2 and 3 are plain DOM, not React Flow custom nodes.** The plan left this open.
  Design page 5 is a card list with a sidebar and page 6 is a row of cards with arrows —
  a flex row and a `<ul>`. A graph engine would cost a second layout pass, a second focus
  model and a second scroll container for nothing a reader can see, and would put React
  Flow's `nodesFocusable` wrapper between the reader and the `<button>` that carries the
  keyboard affordance. React Flow stays where it earns its place: Level 1.
- **Level 1 expansion is an explicit affordance, not a changed click.** Design page 4 shows
  `Expand 6 changes →` beneath the focused node and `or press →`, with the level indicator
  reading `→ expand · ← collapse · ⇥ focus`. So click-to-focus is unchanged from chunk 04,
  the node keeps its single tab stop, and expansion is one new control plus the `→` key.
- **The onboarding dismissal is read through `useSyncExternalStore`, not an effect.** The
  first attempt used `useEffect` + `setOpen` and `pnpm lint` failed it with two
  `react-hooks/set-state-in-effect` errors. Reading storage during render would instead
  desynchronize the prerendered HTML from the first client paint. `useSyncExternalStore`
  with a server snapshot of "already dismissed" resolves both: the prerender carries no
  dialog, the client decides after hydration. Replay is derived from the prop during
  render, React's own pattern for state adjusted from props.
- **`stepChain` returns an empty chain for a degraded record**, not the degraded record's
  synthetic single step. That step's `commitSha` is the enrichment key, which is not a
  commit the pull request contains, and its summary says only that enrichment failed. The
  change's own file list is still returned at the chain level, so Level 3 renders the
  change rather than a blank screen.

## Deviations from the plan

- **The plan (and design decision 4) assume files can be attributed to a step. They cannot
  — measured.** `commitSchema` in `src/lib/snapshot.ts` is `{sha, message}`; nothing in the
  ingest records a per-commit file list, and `pulls.listCommits` does not return one. Design
  page 6 itself says the steps are *"in the order they were built — not commit order"*, so
  even a per-commit file list would not be the model's step attribution. Getting one would
  mean a new GitHub call per commit, re-ingesting four committed snapshots and re-baking
  their enrichment — outside this chunk, and blocked here anyway (no `GITHUB_TOKEN`).

  **What was done instead**, and it is stated in the UI rather than hidden: `stepChain`
  groups the change's files by **owning package** — a real structure the snapshot does
  carry — orders the groups **dependency-first** (a package another touched package depends
  on comes first, files owned by no package last), and hands the groups to the steps. With
  more groups than steps each step takes a contiguous run; with fewer, the groups are
  **right-aligned** so the chain still ends where the change landed and the leading steps
  carry no files rather than someone else's. Those steps say so: *"No files attributed to
  this step — the snapshot records changed files per change, not per commit."* The chain
  header repeats it: *"Files are attributed to steps by package: the snapshot records
  changed files per change, not per commit."* Measured frequency: a step with no
  attributable files occurs on 27/100, 17/100 and 8/36 of the enriched changes.

  This makes the entry-point marker **more** meaningful, not less: it is exactly design
  decision 3's rule — *"derived from the step's files and the package that owns them"* —
  and the dependency-first ordering is what makes the chain read from the deepest
  dependency outward to the package the reader owns.

- **Chunk 03's enrichment helpers had to move.** `derive.ts` needs `enrichmentKey` and
  `isFallbackEnrichment`, and it is imported by client components; `enrichment.ts` imports
  `ai`, so importing them from there would pull the AI SDK onto a component path —
  Principle 2. Duplicating the constants would let `FALLBACK_APPROACH` drift out of
  agreement with the bake, which is the one string `isFallbackEnrichment` compares. So the
  six model-free symbols moved to `src/lib/ai/enrichment-record.ts` and `enrichment.ts`
  re-exports every one of them: chunk 03's public API is unchanged, and
  `src/lib/ai/enrichment.test.ts` still imports from `@/lib/ai/enrichment` untouched.

- **The design corrects the plan's "beneath the chain" wording for the no-entry-point
  case.** The plan only describes the entry-point sentence. A change that reached the
  package *only* through a dependency has no step carrying its files, so the note reads
  *"No step here carries a file `<pkg>` owns, so Grain marks no entry point for this
  change."* A change with no chain at all reads *"There is no step chain for this change, so
  there is no entry point to mark."* **This was found by running the app, not by a test** —
  the first version printed *"it reached it through a dependency"* for a **direct** change
  with no chain, which was simply false.

- **Level 2 and Level 3 drop the zoom controls and minimap the designs draw at the
  right-hand edge of pages 5 and 6.** Those are React Flow's own chrome; with the levels
  built as plain DOM there is nothing to zoom or minimap. The rest of both pages is
  followed.

- **The connectors from the package card to the change cards are a dashed rail plus a tick
  per card**, not the curved SVG paths design page 5 draws. Same reading — the cards belong
  to the package on the left — at a fraction of the machinery.

- **No surviving "node" wording for a Level 2 or Level 3 element was found.** The chunk plan
  as dispatched already says "card" throughout. `node` remains only where it is correct:
  Level 1's `package-node.tsx`, React Flow's own API, and `packages.nodes` in the snapshot
  schema.

- **Component-level tests were not written, and the plan did not ask for one.** There is no
  DOM environment in this project — `vitest.config.mts` sets no `environment`, and neither
  `jsdom`, `happy-dom` nor `@testing-library/react` is installed. Adding one is a dependency
  and a convention change, which belongs in a plan rather than in this chunk. The
  presentation layer is covered by gate 2, by the type check, and by the runtime evidence
  above. Called out so the reviewer reads it as a scope boundary, not an omission.

## project.md deltas

Two entries, each with the command behind it. **I did not edit `project.md`** — the plan
defers it to the lead.

1. **Layout → `src/lib/ai/`** currently reads *"The enrichment module and its specs — one
   model call per pull request."* It now also holds a model-free module. Suggested addition:

   > `enrichment-record.ts` holds the parts of the enrichment contract that involve no model
   > — `enrichmentKey`, `FALLBACK_APPROACH`, `isFallbackEnrichment`, `fallbackEnrichment` —
   > and imports no `ai`. `enrichment.ts` re-exports all of them. The split exists because
   > `src/lib/view/derive.ts` needs two of these and is imported by client components, and
   > an `ai` import on a component path violates Principle 2.

   Measurement: `git grep -n -E "from '(ai|@ai-sdk/[^']*)'" -- src/lib/ai/enrichment-record.ts`
   → exit 1, no matches. `grep -rl '@ai-sdk\|generateObject(' .next --include='*.js'` → 0 files,
   while `grep -rl "Enrichment did not complete for this pull request" .next --include='*.js'`
   finds it in the client chunk `.next/static/chunks/3g4w25le090si.js`.

2. **Conventions — a new one worth promoting**, because it cost a lint failure here:

   > **`setState` inside `useEffect` is a lint *error*, not a warning.** `eslint-config-next`
   > 16.3.5 enables `react-hooks/set-state-in-effect` at error level, so a "read
   > `localStorage` after mount and set state" component fails `pnpm lint` outright.
   > Measured 2026-09-20 by chunk 05: two errors,
   > `Avoid calling setState() directly within an effect`, in
   > `src/components/canvas/onboarding-tour.tsx`. For browser-only state on a statically
   > prerendered route use `useSyncExternalStore` with a server snapshot; for state derived
   > from a prop, adjust it during render.

   Measurement: `pnpm lint` reported `✖ 2 problems (2 errors, 0 warnings)` and exit 1 with
   the effect form; exit 0 with no output after the change. Rule id printed by ESLint:
   `react-hooks/set-state-in-effect`.

No new dependency, no new command, no new file kind, no moved directory. `pnpm build`
regenerated `src/lib/view/catalog.generated.ts` via `prebuild` and it came back **identical**
— `git status --short` shows no change to it.

## Left alone

- **A pull request that touched no package appears in the header's change count but on no
  package's card list.** `trpc/trpc#7592` has 0 files, 0 commits and no direct or indirect
  package, so `deriveWindow` counts it in `changeCount` while `packageChanges` can never
  surface it. That is chunk 04's counting behaviour, not something this chunk introduced,
  and changing it would change the Level 1 header. Reported, not fixed. (It is also the one
  captured degraded enrichment record, which is why the spec that recognises it asserts
  against the snapshot directly rather than through a card list.)
- **`entryStep` is derived under an invariant the type system does not know.** A direct
  change always owns a file (`attributePullRequest` derives `directPackages` *from* the
  files' owners — verified: 386 of 386 `(pull request, direct package)` pairs own at least
  one file) and every group lands on exactly one step, so a direct change with a chain
  always has an entry point. The Level 3 copy is written to stay true if that ever stops
  holding, and a comment in `steps-level.tsx` records why the branch is not split further.
- **Chunk 04's `pullRequests` ordering (newest merge first) was not changed**, even though
  Level 2 needs the opposite. `packageChanges` sorts its own copy; touching the shared order
  would move the Level 1 counts for no reason.
- **The help menu on design page 9 (`Replay tour`, `Keyboard shortcuts`, `How Grain reads a
  PR`) ships as a single `Replay tour` button.** The other two rows have no content behind
  them in this plan; a menu with one live item and two dead ones is worse than a button.
- **`change-card.tsx` and `steps-level.tsx` both format a merge date** with their own
  `Intl.DateTimeFormat`, as `empty-window.tsx` and `time-slider.tsx` already do. Four copies
  of a two-line formatter is now enough to justify a shared helper, but extracting one
  touches two files this chunk does not otherwise own. Reported for the next plan.
