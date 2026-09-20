# Chunk 02 — Completion Report

Branch `feat/project-grain-prototype--ingest-core`, worktree
`.worktrees/02-ingest-core`, base `f766371`.

## Reuse Audit

`New: no existing implementation found.` Searched all 15 tracked `.ts/.tsx/.mts/.mjs`
files at base, three ways, uncapped, with `/usr/bin/grep` rather than the session shell's
`grep` (which is aliased to `ugrep --ignore-files` and would have silently skipped ignored
paths):

| Angle | Pattern | Matching lines |
| ----- | ------- | -------------- |
| By the name a helper would have | `discoverTopology\|buildSnapshot\|ingest\|attribut\|snapshotSchema\|githubClient\|octokit\|fetchPullRequest\|packageOwner\|ownerOf\|[Ss]napshot` | 0 |
| By the algorithm | `closure\|reachab\|transitive\|topolog\|adjacen` | 0 |
| By the problem | `package\|topology\|workspace\|monorepo\|pull.?request\|repositor` | 0 |

`src/lib/` at base held exactly `utils.ts` (`export { cn } from "cn"`) and its spec. The
scaffolder contributed no reusable utility.

One reuse defect was caught during implementation and fixed before commit: `ingest.ts`
had grown a private `ownerFor()` duplicating `ownerOfFile()` from `attribution.ts`. The
duplicate was deleted and the existing function imported.

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `src/lib/snapshot.ts` | created | The Zod snapshot schema, types derived from it, the reserved-key/duplicate/null-prototype boundary guard, the size caps, and a stable serializer |
| `src/lib/snapshot.test.ts` | created | Schema contract, boundary guard, and the zod-drops-reserved-keys finding |
| `src/lib/ingest/topology.ts` | created | Workspace glob discovery, manifest selection, nodes and declared dependency edges |
| `src/lib/ingest/topology.test.ts` | created | T001 |
| `src/lib/ingest/attribution.ts` | created | File→package mapping, reverse dependency closure, direct/indirect sets |
| `src/lib/ingest/attribution.test.ts` | created | T002 |
| `src/lib/ingest/github.ts` | created | Every GitHub call, verified against the installed `@octokit/rest` 22.0.1. Token is a parameter |
| `src/lib/ingest/github.test.ts` | created | Endpoint behaviour over captured responses |
| `src/lib/ingest/transcript.ts` | created | HTTP record/replay, so a fixture is captured bytes rather than hand-authored JSON |
| `src/lib/ingest/transcript.test.ts` | created | Record, replay, sampling, and credential-header redaction |
| `src/lib/ingest/ingest.ts` | created | The entry point and the only place I/O is sequenced |
| `src/lib/ingest/ingest.test.ts` | created | T004 determinism, windowing, bounds |
| `src/lib/ingest/fixtures/xyflow-xyflow-2026-08-31.transcript.json` | created | 28 recorded responses from a real run against `xyflow/xyflow` |
| `src/lib/ingest/fixtures/github-missing-file.transcript.json` | created | One real 404 from the contents endpoint |
| `src/lib/ingest/fixtures/replay.ts` | created | Test support: builds a real Octokit over a committed transcript |
| `scripts/ingest.mts` | created | The CLI — writes a snapshot, records or replays a transcript |
| `tsconfig.json` | edited | `allowImportingTsExtensions: true`; see project.md deltas |
| `plans/.../02-ingest-core/plan.md` | edited | T001–T011 ticked |

## Acceptance criteria

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| Ingest returns a schema-valid object with topology, windowed PRs, and per-PR file/commit detail | yes | `ingestRepository over captured xyflow/xyflow responses > returns an object the snapshot schema validates`, `ingest.test.ts`. Live run: `node scripts/ingest.mts --repo xyflow/xyflow --since 2026-08-31T00:00:00Z --until 2026-09-02T00:00:00Z` → `10 packages, 6 pull requests` |
| Each app/package is a node; an edge exists where a manifest declares a workspace dependency | yes | `discoverRepositoryTopology … > discovers the real workspace packages and their real declared edges`, `topology.test.ts`. 10 real nodes, 13 real edges, including `@xyflow/react -> @xyflow/system (dependencies)` |
| A PR changing a file inside package A reaches A **directly** | yes | `attributePullRequest > records a package whose file changed as reached directly`; over real data, PR #5989 → `directPackages: ["@xyflow/system"]` |
| A PR changing only B, where A depends on B, reaches A **indirectly through B**, path recorded | yes | `attribution over captured … > reaches the real dependents of a package a real pull request touched`. PR #5989 yields `{package:"@xyflow/react", through:"@xyflow/system", path:["@xyflow/react","@xyflow/system"]}` and the real two-hop `["svelte-examples","@xyflow/svelte","@xyflow/system"]` |
| Two runs are byte-identical apart from `metadata`; no analysis timestamp leaks out | yes | Gate 4 (two CLI runs, different `analyzedAt`, 23,897 identical bytes after stripping metadata) and three specs in `ingest.test.ts`, including `puts the analysis timestamp nowhere but metadata` |
| Each file carries lines added/removed and is attributed to its owning package | yes | `records real per-file line counts and leaves out-of-package files unowned`. PR #5992: 10 files, 4 unowned (`.changeset/…`), 6 owned |
| Squash, merge-commit and rebase merges all appear with commits attached | **partly — see below** | `attaches ordered commits to every pull request in the window` passes for all 6 captured PRs. The captured window does not prove all three *merge strategies* are present; see Deviations |
| A malicious or malformed package name used as a record key is rejected, not written | yes | `assertSafeKey`/`buildRecord` specs in `snapshot.test.ts`; `discoverTopology > rejects a manifest whose name is a reserved object key` and `> rejects two manifests declaring the same package name`; Gate 3 |

## Tests

Six specs were written before any implementation existed and run. Red run, verbatim
(`pnpm test`, exit 1) — every suite failed at import, which is the failure the plan
predicted:

```
 ❯ src/lib/ingest/topology.test.ts (0 test)
 ❯ src/lib/ingest/transcript.test.ts (0 test)
 ❯ src/lib/ingest/github.test.ts (0 test)
 ❯ src/lib/ingest/ingest.test.ts (0 test)
 ❯ src/lib/ingest/attribution.test.ts (0 test)
 ❯ src/lib/snapshot.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 6 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/lib/snapshot.test.ts [ src/lib/snapshot.test.ts ]
Error: Cannot find package '@/lib/snapshot' imported from …/src/lib/snapshot.test.ts
 FAIL  src/lib/ingest/attribution.test.ts [ … ]
Error: Cannot find package '@/lib/ingest/attribution' imported from …
 FAIL  src/lib/ingest/github.test.ts [ … ]
Error: Cannot find package '@/lib/ingest/github' imported from …
 FAIL  src/lib/ingest/ingest.test.ts [ … ]
Error: Cannot find package '@/lib/snapshot' imported from …
 FAIL  src/lib/ingest/topology.test.ts [ … ]
Error: Cannot find package '@/lib/ingest/ingest' imported from …
 FAIL  src/lib/ingest/transcript.test.ts [ … ]
Error: Cannot find package '@/lib/ingest/transcript' imported from …

 Test Files  6 failed | 1 passed (7)
      Tests  3 passed (3)
```

The 3 passing were the pre-existing `utils.test.ts` baseline.

| Test | Red run | Green run |
| ---- | ------- | --------- |
| T001 topology (`topology.test.ts`, 11 tests) | `Cannot find package '@/lib/ingest/ingest'` — suite collected 0 tests | pass |
| T002 attribution (`attribution.test.ts`, 11 tests) | `Cannot find package '@/lib/ingest/attribution'` — 0 tests | pass |
| T003 boundary (`snapshot.test.ts`, 15 tests) | `Cannot find package '@/lib/snapshot'` — 0 tests | pass |
| T004 determinism (`ingest.test.ts`, 12 tests) | `Cannot find package '@/lib/snapshot'` — 0 tests | pass |
| `github.test.ts` (16 tests) | `Cannot find package '@/lib/ingest/github'` — 0 tests | pass |
| `transcript.test.ts` (16 tests) | `Cannot find package '@/lib/ingest/transcript'` — 0 tests | pass |

Green: `pnpm test` → `Test Files 7 passed (7) / Tests 94 passed (94)`, exit 0.
(84 at review iteration 1, 90 after its fixes, 94 after iteration 2's — see the two
review sections below.)

**Two of these tests failed on first implementation and caught real defects**, which is
the evidence they check something beyond import resolution:

1. `records a package as direct, not indirect, when it is both` failed with
   `expected [ 'app', 'app' ] to deeply equal [ 'app' ]`. `attributePullRequest` deduped
   indirect reaches by `(package, through)`, so a package reachable from two touched
   packages was listed twice and `indirectPackages.length` was not a package count. Fixed
   to one entry per package, shortest chain winning.
2. `returns null for a file the repository does not have` failed with
   `no recorded response in transcript for GET …/contents/lerna.json` — the transcript had
   no 404 in it, so the 404→`null` mapping was untested. Fixed by recording a real 404
   from the live API into its own fixture.

## Gates

All gate commands below are the ones the **corrected** `plan.md` declares (`pnpm typecheck`,
not `pnpm exec tsc --noEmit`; Gate 3 globbing `src/**/*.ts` only). See § Stale plan copy.

Baseline (base tree `f766371`, isolated copy at
`$SCRATCH/base`): `pnpm lint` exit 0, `pnpm test` → `Test Files 1 passed (1) / Tests 3
passed (3)` exit 0, `pnpm exec tsc --noEmit` exit 0. Results below are the delta: tests
1→7 files and 3→84 tests, lint and typecheck unchanged at 0.

| Gate | Command | Result | Fails on base? |
| ---- | ------- | ------ | -------------- |
| 1 lint | `pnpm lint` | exit 0, no output | No — and it cannot. A standard gate passes on base by design. Falsified by control instead (below) |
| 1 test | `pnpm test` | exit 0, `Test Files 7 passed (7) / Tests 84 passed (84)` | Yes, as the red run above: with this chunk's specs present and no implementation, exit 1, 6 failed suites |
| 1 build | `pnpm build` | exit 0, `✓ Compiled successfully`, `Finished TypeScript` | No — passes on base by design. (The isolated base copy could not run it: `Symlink [project]/node_modules is invalid, it points out of the filesystem root`. That is my harness, **not** gate evidence, and is not counted as a failure) |
| 1 typecheck | `pnpm typecheck` | exit 0, no output | No — passes on base by design. Falsified by control |
| 2 fixture is captured output | `git ls-files \| grep -E 'fixtures?/.*\.json$'`, then `grep -qF '"node_id"'` / `'"merge_commit_sha"'` on the PR transcript, and `'"x-github-request-id"'` on every fixture | exit 0; both needles present in `xyflow-xyflow-2026-08-31.transcript.json`, request id present in both fixtures | **Yes.** On base: `committed fixtures:` empty → `FAIL: no committed fixture found`, plus `FAIL: …transcript.json is not committed`. Evidence is absence, correct for a gate proving content was added |
| 3 reserved-key guard exists as code | `git ls-files 'src/**/*.ts' \| grep -v '\.test\.ts$'` then non-comment `__proto__` count | exit 0; 1 occurrence, `src/lib/snapshot.ts:21` | **Yes.** On base: 1 non-test source file searched, `non-comment __proto__ occurrences: 0` → `FAIL: no reserved-key guard in shipped source` |
| 4 deterministic outside metadata | `node scripts/ingest.mts --repo xyflow/xyflow --since … --until … --replay <fixture> --out runN.json` twice, strip `metadata`, `diff` | exit 0; `analyzedAt` differed (`…09:59:38.982Z` vs `…09:59:39.231Z`), bodies byte-identical at 23,897 bytes | **Yes.** On base, both runs exit 1: `Error: Cannot find module '…/scripts/ingest.mts'` |

### Negative controls — one per assertion, four steps each

Every canary was reverted by copying a backup back, never `git checkout --`, and the
revert verified byte-identical before re-running the gate.

| Control | With canary | After revert |
| ------- | ----------- | ------------ |
| Gate 1 lint — `any` in `snapshot.ts` (`@typescript-eslint/no-explicit-any`, error) | exit 1, `error Unexpected any. Specify a different type` | exit 0 clean |
| Gate 1 lint — `var` in `topology.ts` (`no-var`, error) | exit 1, `error Unexpected var, use let or const instead` | exit 0 clean |
| Gate 1 test — broke a real assertion in `attribution.test.ts` | exit 1, `11 tests \| 1 failed` | exit 0 clean |
| Gate 1 build — type error in `src/app/page.tsx` | exit 1, `page.tsx(71,7): error TS2322` | exit 0 clean |
| Gate 1 typecheck — type error in `src/lib/ingest/ingest.ts` | exit 2, `ingest.ts(170,7): error TS2322` | exit 0 clean |
| Gate 3 re-run under the corrected `src/**/*.ts`-only glob — removed `'__proto__'` | exit 1, `FAIL: no reserved-key guard in shipped source` | exit 0 clean |
| Gate 2a — renamed `node_id` in the PR transcript | exit 1, `FAIL: … lacks "node_id"` | exit 0 clean |
| Gate 2b — renamed `merge_commit_sha` | exit 1, `FAIL: … lacks "merge_commit_sha"` | exit 0 clean |
| Gate 2c — renamed `x-github-request-id` in the 404 fixture | exit 1, `FAIL: … has no x-github-request-id` | exit 0 clean |
| Gate 3 — removed `'__proto__'` from `RESERVED_KEYS` | exit 1, `FAIL: no reserved-key guard in shipped source` | exit 0 clean |
| Gate 4 — appended `Date.now()` to `title`, leaking the clock outside `metadata` | exit 1, `FAIL: not deterministic outside metadata` | exit 0 clean |

After all controls, `git status` showed only the intended chunk files and
`git diff HEAD | grep -i canary` returned nothing; the full gate block was re-run and
returned `rc=0`.

**Two controls did not fire, and both were my canary's fault rather than the gate's** —
recorded because they are facts about this project's lint:

- An unused variable produced `✖ 1 problem (0 errors, 1 warning)` and `pnpm lint` **exited
  0**. This config's lint gate fails on errors only, never on warnings.
- `no-const-assign` produced no output at all. `eslint --print-config src/lib/snapshot.ts`
  shows it configured as `[0]` — explicitly disabled, because TypeScript already catches
  it. Of the 113 configured rules, 60 are error-level and all but ~22 are React-specific;
  for a plain `.ts` file the applicable error rules are `no-var`, `prefer-const`,
  `prefer-rest-params`, `prefer-spread` and the `@typescript-eslint/*` set.

## Stale plan copy

The worktree initially held a pre-fix `plan.md`, and that is the copy I read at the start
of the session. The lead fast-forwarded the branch onto `f766371`
(*plan: fix chunk 02 gate commands and regenerate its rubric*) before I had committed
anything, so **every commit in this chunk sits on top of the corrected plan**, and the
working copy is the corrected one (line 251 reads `pnpm test`, with no `--run`).

Checked each of the three fixes against what I actually delivered:

| Fix | Impact on delivered work |
| --- | --- |
| Gate 1: `pnpm test --run` → `pnpm test` | **None.** I never invoked `pnpm test --run`; grepping my gate scripts and this report for it returns nothing. The brief warned me independently |
| Gate 1: `pnpm exec tsc --noEmit` → `pnpm typecheck` | Same command (`package.json` declares `typecheck: tsc --noEmit`), but my first gate runs cited the undeclared spelling. Re-run with `pnpm typecheck` → exit 0; the table above records the declared command |
| Gate 3: dropped the `lib/**/*.ts` glob | Result identical — the dropped half matched nothing, so the hit count was 1 either way. Re-ran the gate and its negative control under the `src/**/*.ts`-only glob; base still reports `0` and the control still fires |
| Code sample: `enrichment: filled by chunk 03 …` → `… model-generated labels …` | **Not copied.** `grep -rniE 'chunk[ -]?0?[0-9]' src/ scripts/` returns nothing; `snapshot.ts` says "Written by the enrichment pass, keyed by merge commit SHA" |

The full gate block was re-run end to end after these corrections: `rc=0`.

## Review iteration 1 — three tests that could not fail

The reviewer mutation-tested rather than trusting the red run: 29 mutants, 20 caught, 9
survived. Three survivors were blocking, because the guarantee each was meant to protect
had no test that could fail. The red run proved the suites *ran*; it could not prove they
*discriminated*. All three are fixed against values the committed fixture already carried
— no re-recording, no behaviour change.

| Mutant | Why it survived | Fix | Confirmed fatal |
| ------ | --------------- | --- | --------------- |
| `JSON.stringify(sortKeysDeep(s))` → `JSON.stringify(s)` (`snapshot.ts:179`) | The only test fed both sides through `snapshotSchema.parse`, which rebuilds `z.object` fields in schema order before the serializer sees them | Assert over an `enrichment` record with keys inserted out of alphabetical order — zod does **not** normalise `z.record` order, so that is the case `sortKeysDeep` actually carries. Plus depth and top-level-order assertions | Kills 3 tests |
| `deletions: file.deletions` → `deletions: 0` (`ingest.ts:130`) | Both assertions checked `Number.isInteger`, not the value, though 35 files in the fixture have non-zero deletions | Assert the real captured pairs — `.changeset/dirty-areas-leave.md` `[0,5]`, `packages/react/CHANGELOG.md` `[14,0]`, `packages/react/package.json` `[1,1]` — plus the 35/45 column totals | Kills 1 test |
| drop `matched.sort(compareByMergeRecency)` (`github.ts:148`) | The captured listing already arrives newest-merge-first, so the test's own name was false of the fixture | Renamed to drop the false clause, and added runs against the same captured pull requests with the listing pages reversed. Real objects, permuted order — the variable under test | Kills 3 tests, at both the client and ingest layers |

**Why the serializer one mattered most.** `enrichment` is a `z.record` keyed by merge SHA,
no snapshot in this chunk has one, and gate 4 therefore cannot catch its ordering either.
Chunks 03 and 06 both write it; the moment they do, determinism rests on `sortKeysDeep`.
The new test pins the zod asymmetry explicitly, so an upgrade that changes it fails loudly
rather than silently removing the need for the sort.

Also in this iteration:

- **`scripts/ingest.ts` → `scripts/ingest.mts`** in three places: `tsconfig.json:13`,
  the run instructions at `scripts/ingest.mts:10`, and the `USAGE` string at `:32` — the
  last printed to the user on every argument error, so a reader who copied it got `ENOENT`.
  (This is the stale comment I flagged to the lead rather than fixing when asked not to
  change code; it is fixed now.)
- **T005 and T006 ticked** in `plan.md`; both modules existed and were tested.
- **`transcript.ts` header record and `scripts/ingest.mts` argv record** built on
  `Object.create(null)`. Neither is repository-derived nor reaches a snapshot record, so
  neither was a rubric failure — but both are the shape the chunk's own SOP names.
- **`review.md` committed**; it was untracked.

Warnings 1, 2, 5 and 6 left alone on the reviewer's and the lead's instruction: two want
fixture work belonging to a later chunk, and two are `project.md` edits this chunk may not
make (they are deltas 2 and 4 in § project.md deltas).

## Review iteration 2 — two unpinned guarantees

Iteration 2 passed with no blocking issues, and confirmed the iteration-1 fixes
generalize: eight *different* wrong implementations of the same three guarantees all die
(shallow sort, sort-skips-arrays, `additions`→0, additions/deletions swapped, owner→null,
ascending merge sort, cap-before-sort, reverse order). Two one-test gaps were left to
close. I reproduced both as surviving mutants before writing anything.

| Mutant | Why it survived | Fix | Confirmed fatal |
| ------ | --------------- | --- | --------------- |
| `DEPENDENCY_FIELDS` narrowed to `['dependencies']` (`topology.ts:16-21`) | No test asserted a `devDependencies`-derived edge, though the real fixture produces **6 of 13** — nearly half the graph, and chunks 04/05 draw them | A unit case for a workspace `devDependency`, and an assertion over the real topology that `@xyflow/react → @xyflow/tsconfig (devDependencies)` exists plus an exact kind census `{dependencies: 7, devDependencies: 6}` | Kills 2 tests. Also kills the narrower mutant that drops **only** `devDependencies` and keeps peer/optional |
| drop `b.number - a.number` from `compareByMergeRecency` (`github.ts:155`) | The captured window has no two pull requests sharing a `merged_at`, so the tie-break is unreachable through the fixture | Exported the comparator and spec'd it directly: newer merge first, a same-timestamp tie broken by number with the higher first, never `0` for distinct pull requests, and a tied set sorting deterministically | Kills 2 tests. Also kills the **inverted** tie-break, which a "not zero" assertion alone would have missed |

The count went to **94, not the 92 the lead projected** — the comparator warranted three
cases rather than one, because "has a tie-break" and "has the *right* tie-break" are
different claims and only the second protects determinism.

`topology.test.ts:13`'s `manifest()` helper had a `devDeps` parameter no call site
supplied — the same gap leaving a visible trace, as the reviewer noted. The new unit case
is its first caller.

**Why exporting `compareByMergeRecency` is the right shape here.** The alternative was to
mutate two `merged_at` values in the transcript so a tie exists, which would have put
fabricated data into a fixture whose whole purpose is being real captured output
(Principle 4). A pure comparator with its own spec keeps the fixture honest; the wiring
between comparator and `fetchMergedPullRequests` is already pinned by the reversed-listing
tests from iteration 1.

Left alone on instruction, and recorded by the lead rather than fixed: the five unasserted
sorts, the unexercised page-level stop, `fixtures/replay.ts` without a spec, and gate 3's
zsh sensitivity (the plan runs it inside `bash -s`, so it only bites a human running the
line by hand).

## Judgment calls

- **Indirect-path cardinality — one path per reached package, not all paths.** An entry is
  `{package, through, path}` where `path[0]` is the reached package and its last element
  is the directly-touched one; the schema refines that invariant. When several touched
  packages reach the same one, the shortest chain represents it, ties broken by the name
  of the package it came through so the choice never depends on edge insertion order.
  Chosen because the number of simple paths is exponential in a dense graph, while the
  canvas renders a count plus one explanatory chain ("2 via Package 2") — and because one
  entry per package keeps `indirectPackages.length` equal to the number of packages
  reached indirectly, which is what the node badge shows. The reached *set* is complete
  either way; only the explanatory chain is one-of. Real evidence this renders: PR #5989
  yields `astro-examples` via the two-hop
  `astro-examples → @xyflow/react → @xyflow/system`.
- **`enrichment` is keyed by merge commit SHA, not pull-request number.** Principle 2 names
  the merge SHA explicitly ("Enrichment is a separate pass keyed by merge SHA"), and a SHA
  is stable across repositories while a PR number is only unique within one. Measured on
  the captured window: `mergeCommitSha` is non-null and unique for all 6 pull requests,
  including under different merge strategies. `pullRequestSchema.mergeCommitSha` is
  nullable because GitHub may report none; a pull request with a null merge SHA cannot be
  enriched, and **chunks 03 and 06 both write this record** — both must call `buildRecord`
  (or `assertSafeKey`) rather than assigning keys onto an object literal, because the
  schema will not catch a hostile key for them (see Deviations).
- **Pull requests are capped by both window and count, and the count defaults to 100.**
  `ingestRepository` requires `since`/`until` and takes `maxPullRequests`, defaulting to
  `DEFAULT_MAX_PULL_REQUESTS = 100` — which matches the SPEC's "no more than 100 pull
  requests in the selected window" success metric. A ceiling above the schema cap
  (`MAX_PULL_REQUESTS = 500`) is rejected with a message naming the limit rather than
  silently truncated; an empty or inverted window is rejected too. The cap is applied
  after sorting by merge recency, so a truncated result is the newest N, not an arbitrary
  N.
- **All four dependency fields create edges, and the field is kept on the edge.** The plan
  said "dependency fields" unqualified. In a monorepo a workspace `devDependency` on a
  shared tsconfig is real coupling, so `dependencies`, `devDependencies`,
  `peerDependencies` and `optionalDependencies` all produce edges — but `kind` is recorded
  so a renderer can filter to runtime edges without re-reading manifests.
- **The analysis clock is a required argument, not a `Date.now()` call.** `ingestRepository`
  takes `analyzedAt`. This makes everything in `src/lib/` a pure function of its inputs, so
  the determinism property is testable including `metadata`, and "no timestamp outside
  `metadata`" becomes structurally enforceable rather than a convention.
- **Fixtures are recorded HTTP transcripts, not post-processed data.** Tests build a real
  `Octokit` over an injected `fetch` that serves the transcript, so they exercise the real
  client, its pagination and its parsing. Verified against `@octokit/rest` 22.0.1 that
  `request: { fetch }` is honoured and `paginate` follows the injected `link` header.
  Proof the fixture is faithful: the snapshot from the live network run and the snapshot
  replayed from the committed fixture are identical outside `metadata` (23,897 bytes each).

## Deviations from the plan

- **Gate 2 as written fails on a correct tree.** It selects the fixture with
  `git ls-files | grep … | head -1`, which picks whichever sorts first — here the 404
  fixture, one response with no pull request in it and therefore legitimately no
  `node_id`. Fixed to name the pull-request transcript directly and additionally require
  every committed fixture to carry a real `x-github-request-id`. Each assertion is
  separately falsified above.
- **Gate 3 as written passes on tests alone.** It counted non-comment `__proto__` across
  all of `src/`, which a spec merely *mentioning* `__proto__` satisfies — on the finished
  tree it reported 5 hits, 4 of them in specs. Fixed to exclude `*.test.ts`, so it asserts
  the guard rather than the discussion of it. It now reports exactly 1 hit.
- **zod 4.6.5 cannot reject a reserved record key, so the schema is not the boundary.**
  Measured: `z.record(z.string(), …).safeParse(JSON.parse('{"__proto__":{…},"ok":{…}}'))`
  returns `success: true` with `Object.keys(result.data) === ['ok']` — the hostile key is
  **silently dropped**, not rejected, and the result sits on `Object.prototype`. A
  `.refine` cannot see it either, because it is already gone. `assertSafeKey` therefore
  runs *before* parsing and is load-bearing, not belt-and-braces. Pinned as a test
  (`is what the schema cannot do: zod drops a reserved record key silently`) so an upgrade
  that changes the behaviour is noticed.
- **The plan's "no timestamp appears outside `metadata`" cannot be taken literally.** The
  same plan requires a "merged timestamp" per pull request, and the SPEC renders a merge
  date on every change node. Implemented as: the **analysis clock** appears only in
  `metadata.analyzedAt`; `mergedAt` is repository data, identical across runs, and does not
  threaten determinism. Asserted directly by `puts the analysis timestamp nowhere but
  metadata`.
- **`pulls.list` cannot be windowed by merge date, and its ordering is not monotonic.**
  Measured against the live API over `xyflow/xyflow`'s 2,015 closed pull requests:
  `merged_at <= updated_at` held for all 1,619 merged ones (0 violations), so walking
  `sort=updated&direction=desc` and stopping below `since` is a sound bound — but the
  ordering is **not** strictly monotonic (inversion at index 406,
  `2025-06-26T13:05:54Z` followed by `2025-06-26T14:29:10Z`), so stopping at the first
  below-window item would truncate early. The implementation stops only after an entire
  page falls below the window, and re-sorts by merge recency because merge order and
  update order differ. Both facts are recorded in the code.
- **`discoverTopology` is one function, plus two pure inputs to it.** The plan asked for
  "one function". Topology needs three separable pure steps — read the workspace globs,
  select the manifests in the tree, build nodes and edges — so `workspacePatterns` and
  `workspaceManifestPaths` are exported alongside `discoverTopology`, each independently
  tested. There is still no provider interface, registry, or class. `ingest.ts` sequences
  them and owns the I/O.
- **The `enrichment` entry shape is declared, minimally.** The plan said to declare the
  field and leave it optional. Declaring a field requires a value type, and an opaque
  `unknown` would make Principle 5 ("one snapshot schema") vacuous. It is declared as
  `{label, approach, steps[{commitSha, summary}]}` — the minimum the SPEC's acceptance
  criteria render. **Chunk 03 may need to widen this**; that is a schema change, not an
  addition.
- **Acceptance criterion on merge strategies is only partly evidenced.** All 6 captured
  pull requests carry commits and a non-null `merge_commit_sha`, and the design reason the
  plan gives for using the API — that rebase merges leave no parseable merge commit — is
  satisfied structurally, since nothing in this chunk reads commit messages or
  `git log`. But I did not verify that the captured window actually contains one of each
  of squash, merge-commit and rebase; the API does not report the strategy used. Proving
  that criterion needs a repository where the three are known, which the captured fixture
  does not establish.
- **Node cannot run the CLI against `@/`-aliased imports.** See project.md deltas.
- **`pnpm build` does type-check modules no route imports.** See project.md deltas.

## project.md deltas

Not applied — chunks 02–06 are forbidden from editing `.claude/resources/project.md`. For
the lead to apply at the wave boundary.

1. **Correction — `pnpm build` is not limited to the build graph.** project.md § Commands
   says "`pnpm build` does run TypeScript, but only over what the build graph reaches — a
   module no route imports yet is type-checked by `pnpm typecheck` and by nothing else."
   **Measured false** on next@16.3.5: planting `const canary: number = "not a number"` in
   `src/lib/ingest/ingest.ts`, which no route imports, fails `pnpm build` with
   `src/lib/ingest/ingest.ts(170,7): error TS2322`. Next runs `tsc` over the tsconfig
   `include`. Running the type check last is still right (Vitest and Turbopack do not type
   check), but the stated reason should be corrected so the next chunk does not skip
   `pnpm build` believing it is blind to library code.
2. **`pnpm lint` exits 0 on warnings.** Measured: an unused variable yields
   `✖ 1 problem (0 errors, 1 warning)` and exit 0. Only error-level rules fail the gate,
   and `no-const-assign` is explicitly disabled (`[0]`) because TypeScript covers it. Of
   113 configured rules 60 are error-level, mostly React; for a plain `.ts` module the
   applicable ones are `no-var`, `prefer-const`, `prefer-rest-params`, `prefer-spread` and
   the `@typescript-eslint/*` set. Worth stating, because "lint passed" here does not mean
   "lint had nothing to say".
3. **`pnpm lint` now covers 30 files**, not the 15 project.md records from chunk 01
   (`pnpm exec eslint --debug | grep -c "Linting "` → 30).
4. **New directory `scripts/`, and the Convention Map has no row for it.** Suggested row:
   `scripts/**` — Gates `pnpm lint`, `pnpm typecheck` (no co-located spec: the CLI is
   argument parsing and file I/O over `src/lib/` functions that are themselves tested).
   Review checks: may read `GITHUB_TOKEN`/`ANTHROPIC_API_KEY` (Principle 1 permits it here)
   and may write files (Principle 3 forbids that only on paths reachable from a route
   handler); runs under bare Node, so it must import `src/lib/` by relative specifier with
   an explicit extension, never `@/`. Doc: `—`.
5. **`tsconfig.json` gained `"allowImportingTsExtensions": true`.** Node 24.13.0 runs
   `.ts`/`.mts` natively (no `tsx` or `ts-node` needed — verified), but it strips types
   without reading tsconfig `paths`, so `@/lib/...` fails with
   `ERR_MODULE_NOT_FOUND: Cannot find package '@/lib'`. Modules under `src/lib/` therefore
   import each other relatively with an explicit `.ts` extension, which TypeScript rejects
   (`TS5097`) unless this flag is set. Verified both ways against tsc 5.9.3.
6. **New convention.** Inside `src/lib/`, modules import each other by relative specifier
   with an explicit `.ts` extension. Specs keep the `@/` alias, since they only ever run
   under Vitest. A new library module that uses `@/` will work under Vitest and Next and
   break the CLI — which nothing else catches.
7. **New command.** Ingest CLI:
   `node scripts/ingest.mts --repo <owner/repo> --since <iso> --until <iso> --out <file>`,
   plus `--branch`, `--max-pull-requests`, `--record <transcript>`, `--record-sample <n>`,
   `--replay <transcript>`. Requires `GITHUB_TOKEN` in `.env.local` or the environment
   unless `--replay` is used. Regenerating the committed fixture is exactly:
   `node scripts/ingest.mts --repo xyflow/xyflow --since 2026-08-31T00:00:00Z --until 2026-09-02T00:00:00Z --out /tmp/snap.json --record src/lib/ingest/fixtures/xyflow-xyflow-2026-08-31.transcript.json --record-sample 3`
8. **New kind of file — recorded HTTP transcripts** at
   `src/**/fixtures/*.transcript.json`. Covered by the existing `src/**/fixtures/**/*.json`
   Convention Map row, but the format is worth recording: `{entries: [{method, url, status,
   headers, json?, text?}]}`. JSON bodies are stored **parsed** (so the file is reviewable
   and `grep '"node_id"'` works); non-JSON bodies keep exact text; response headers that
   describe the caller's credential (`x-oauth-scopes`, `x-oauth-client-id`,
   `x-accepted-oauth-scopes`, `set-cookie`) are dropped by the recorder, because a
   transcript is committed. Request headers are never recorded at all — `Authorization` is
   on every request.
9. **`scripts/ingest.mts` uses `.mts`** for the same reason `vitest.config.mts` does.
   Node still emits `MODULE_TYPELESS_PACKAGE_JSON` for the first imported `.ts` file;
   it is cosmetic stderr noise and the only fix is `"type": "module"`, which project.md
   already rules out.
10. **Tension in § Layout, unresolved by me.** Layout says "secrets, network calls and
    model calls live on the route side of it; `src/lib/` is pure functions that take data
    and return data." This chunk puts the GitHub API calls in `src/lib/ingest/github.ts`,
    as the plan, Principle 3 ("ingest is GitHub API work only") and the `src/app/**/route.ts`
    row ("thin — sequences and wires `src/lib/` functions") all require. No credential is
    read below the route: the token is a parameter. Suggest Layout be reworded to
    "credentials and model calls live on the route side" so the next implementer is not
    told two different things.
11. **No new dependency was added.**

## Left alone

- **Progress reporting.** The SPEC wants "progress at least once per 10 pull requests
  processed" for live analysis. `ingestRepository` has no `onProgress` hook; that belongs
  to chunk 06, which owns the request-time path.
- **The cost profile of `pulls.list` for distant windows.** Finding the 6 pull requests
  merged in a two-day window cost 2 list pages — 200 full pull-request objects, ~3.4 MB —
  because the endpoint has no merge-date filter. For a window far in the past this degrades
  badly, since the walk must page until `updated_at` drops below `since`.
  `GET /search/issues?q=repo:…+is:pr+is:merged+merged:A..B` would return exactly the
  in-window pull requests, at the cost of a stricter rate limit (30/min vs 5,000/hr) and a
  1,000-result cap. Not changed — the plan specifies the listing endpoint and the current
  approach is sound and bounded — but **chunk 06 should weigh it** before running this
  inside a request.
- **The pnpm workspace reader is not a YAML parser.** It reads a top-level `packages:` key
  followed by `- 'glob'` items, which is every real `pnpm-workspace.yaml`. Anchors, flow
  sequences or multi-line scalars would not be read and the caller falls back to the root
  manifest. Documented at the function.
- **`examples/*`, `tooling/*` and `tests/*` are nodes.** `xyflow/xyflow` declares them as
  workspace packages, so topology includes `svelte-examples`, `playwright` and the tooling
  configs. That is what the repository declares; filtering to "real" packages would be a
  product judgment this chunk has no basis to make.
- **`packages/vue/**` files in PR #5987 map to no package.** There is no
  `packages/vue/package.json` on `main`, so those files are recorded with `package: null`.
  Correct behaviour, and a useful edge case the fixture now carries.
