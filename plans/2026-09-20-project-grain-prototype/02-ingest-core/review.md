# Chunk 02 — Review (independent)

Reviewed at `c3357fb` on `feat/project-grain-prototype--ingest-core`, worktree
`.worktrees/02-ingest-core`. Diff read as `git diff feat/plan--project-grain-prototype...HEAD`.
Note: four commits, not the three named in the dispatch — `c3357fb` is docs-only
(completion report, 25 insertions).

**Verdict: FAIL** — narrow. See § Verdict at the end.

## Method

Beyond re-running the four gates, I mutation-tested the suite: 29 plausible wrong
implementations applied one at a time to an isolated copy of the tracked tree
(`git ls-files` → scratch dir + symlinked `node_modules`), each followed by a full
`vitest run` and an exact restore. 20 caught, 9 survived. The 9 survivors are the
evidence behind every finding below. The first harness run was itself invalid
(`--reporter=basic` is not a Vitest 5 reporter, so every run exited 1 and every mutant
looked caught); re-run with the default reporter.

Surviving mutants, with the source line each mutated:

| Mutation | Site | Survived because |
| --- | --- | --- |
| `JSON.stringify(sortKeysDeep(s))` → `JSON.stringify(s)` | `src/lib/snapshot.ts:179` | the only test feeds both sides through `snapshotSchema.parse` first |
| `deletions: file.deletions` → `deletions: 0` | `src/lib/ingest/ingest.ts:130` | assertions check `Number.isInteger`, not the value |
| drop `matched.sort(compareByMergeRecency)` | `src/lib/ingest/github.ts:148` | the captured listing is already newest-merge-first |
| `edges.sort(...)` → `edges.reverse()` | `src/lib/ingest/topology.ts:158` | no test asserts edge order |
| `.sort(by path)` → `.reverse()` on changed files | `src/lib/ingest/ingest.ts:133` | no test asserts file order |
| adjacency `list.sort(...)` → `list.reverse()` | `src/lib/ingest/attribution.ts:57` | fixture has no tie-producing case |
| roots `[...new Set(roots)].sort()` → `.reverse()` | `src/lib/ingest/attribution.ts:59` | equivalent — closure key order is not observable |
| closure over touched → over all nodes | `src/lib/ingest/ingest.ts:122` | equivalent — attribution filters either way |
| page-level stop → break on first below-window item | `src/lib/ingest/github.ts:137` | the captured window cannot reach the inversion case |

Measured facts the findings rest on:

- zod 4.6.5 does **not** normalize `z.record` key order: parsing
  `{"zzz":…,"aaa":…}` into `enrichment` yields `Object.keys → ["zzz","aaa"]`. It *does*
  normalize `z.object` key order to schema order. That asymmetry is what makes the
  `serializeSnapshot` test vacuous and `sortKeysDeep` load-bearing for chunks 03/06.
- The fixture carries 35 changed files with `deletions > 0`; PR 5992 alone has
  `.changeset/dirty-areas-leave.md` at 0/5 and `packages/react/CHANGELOG.md` at 14/0. The
  discriminating values are available and unused.
- Snapshot PR order for the captured window is `5992, 5997, 5994, 5977, 5987, 5989`, already
  descending by `mergedAt` before any sort runs.

## Universal Checks

| Item | Grade | Reason |
| --- | --- | --- |
| Does what the acceptance criteria say, verified by reading | PASS | Every criterion traced to code; see Chunk-Specific below |
| Every gate run after the last edit, and each can fail | PASS | All four re-run by me at `c3357fb`: `pnpm lint` rc=0, `pnpm test` → `Test Files 7 passed (7) / Tests 84 passed (84)`, `pnpm build` rc=0, `pnpm typecheck` rc=0. Gate 4 reproduced independently: two CLI `--replay` runs, `analyzedAt` `…10:05:39.955Z` vs `…10:05:40.503Z`, bodies identical outside `metadata`. Falsifiability graded separately below |
| New behavior has tests covering happy path, error path, edges | **FAIL** | Three shipped guarantees have tests that cannot fail — see Issue 1 |
| `completion-report.md` exists and is committed | PASS | 392 lines, committed in `817b6d5`/`c3357fb` |
| Tests observed failing before implementation; report shows the red run | PASS (with caveat) | Red run recorded verbatim, 6 suites / 0 tests collected. That proves absence, not discrimination — which is why I mutation-tested. The report's two "caught a real defect" claims hold up: the `(package, through)` dedupe mutant is caught by `records a package as direct, not indirect, when it is both`, and the separate 404 fixture exists exactly as described |
| Abstractions justified; no unneeded layer | PASS | Standalone functions throughout; no class, registry or provider interface anywhere in `src/lib/` |
| No principle violated without recorded justification | PASS | P1, P3, P4, P5, P6 each checked below |
| No unrelated files touched; no scope beyond the chunk | PASS | 19 files, all in scope. `project.md` untouched (0 hits in `--name-only`). `plan.md` delta is checkbox ticks only |
| No secrets, credentials or keys | PASS | 32 `authorization`-family hits in the diff are all GitHub `vary` / `access-control-expose-headers` *names*, no values. `.env.local` untracked and gitignored |
| No silent failures | PASS | Every throw names the offending value; the one swallowed `catch` (`scripts/ingest.mts:64`) falls through to an explicit error |
| No duplicated logic an existing helper covers | PASS | Reuse audit re-run independently at base: 15 tracked `.ts/.tsx/.mts/.mjs` files, uncapped `/usr/bin/grep` over all three angles, 0 matches. Base `src/lib/` held only `utils.ts` and its spec |
| Errors and warnings graded against the captured baseline | PASS | Baseline recorded (1 file / 3 tests, lint 0, typecheck 0); delta stated. See Warning 5 on what a clean lint means here |
| Comments and docs still true after the change | **FAIL** | Three references to a file that does not exist — see Issue 2 |

## Test Coverage Checks

| Item | Grade | Reason |
| --- | --- | --- |
| Schema spec: no-`enrichment` validates, missing required PR field does not | PASS | `src/lib/snapshot.test.ts:47,53`; both discriminate (making `enrichment` required breaks 15 tests) |
| Topology spec: nodes from layout, edge from declared dep, dep that must not produce an edge | PASS | `src/lib/ingest/topology.test.ts:61,75`; the no-edge case catches the "edge to any declared dependency" mutant |
| Attribution spec: direct, indirect-with-path, precedence | PASS | `src/lib/ingest/attribution.test.ts:46,51,59`; all three discriminate |
| Boundary spec: reserved key, duplicate name, size cap — rejection not truncation | PASS | Reserved: `topology.test.ts:82`, `snapshot.test.ts:93,113`. Duplicate: `topology.test.ts:88`, `snapshot.test.ts:116`. Caps: `snapshot.test.ts:70,82` and `ingest.test.ts:91`. Each mutant caught |
| Ingest spec: two runs serialize identically outside `metadata` | PASS | `src/lib/ingest/ingest.test.ts:21`; `withoutMetadata` deletes exactly one key — the exclusion is not over-broad. Catches both clock-leak mutants |
| GitHub client has a co-located spec, or absence justified | PASS | `src/lib/ingest/github.test.ts` exists, 16 tests |
| Every new module under `src/lib/` has a co-located spec | PASS with note | 6 of 7 do. `src/lib/ingest/fixtures/replay.ts` does not; justified as test support at the module header and in the report — see Warning 2 |
| Tests assert the value a consumer receives after resolution, never a round-tripped input literal — `bibles/swe/testing.md` | **FAIL** | Three sites read back what the input already satisfied — see Issue 1 |
| Each transform tested against the producer's real captured output — `bibles/swe/testing.md` | PASS | Every pipeline spec drives a real Octokit over the committed HTTP transcript; `github.test.ts:71` asserts the incidental fields survive |

## Chunk-Specific — acceptance criteria

| Item | Grade | Reason |
| --- | --- | --- |
| Ingest returns a schema-valid object with topology, windowed PRs, per-PR file and commit detail | PASS | `ingest.ts:154-166`; verified live via the CLI: 10 packages, 6 pull requests |
| Node per app/package; edge exactly when a manifest declares a workspace dependency | PASS | `topology.ts:141-155`, `seen.has(to)` filter; no import scanning anywhere |
| PR changing a file inside a package recorded **direct** | PASS | `attribution.ts:96` |
| PR reaching a package only via the graph recorded **indirect**, path stored | PASS | `attribution.ts:105-112`; schema refines the path invariant at `snapshot.ts:104` |
| Both direct and indirect ⇒ direct | PASS | `attribution.ts:108`; mutant caught |
| Two ingests byte-identical apart from `metadata`; iteration and set order do not leak | PASS on behavior, thin on evidence | Sorting is present at `topology.ts:157-158`, `attribution.ts:57,59,84,114`, `ingest.ts:133`, `snapshot.ts:187`, `github.ts:148`, and gate 4 reproduces. But five of those sorts have no test that fails without them — Issue 1 and Warning 6 |
| Each changed file carries added/removed counts, attributed to its owning package | PASS on behavior | `ingest.ts:127-131`. Attribution is well tested; the line counts are not — Issue 1 |
| Squash, merge-commit and rebase all appear with commits attached | N/A — honestly reported partial | The API-not-commit-message approach is structurally correct (nothing reads `git log` or parses merge text). The report states plainly that the captured window does not establish all three strategies are present and that the API does not report the strategy. That is the correct disposition, not a defect to fix here |
| Malicious/malformed repository-derived name rejected before use as a key | PASS | `topology.ts:128` + `snapshot.ts:39-62`; both mutants caught |

## Chunk-Specific — Convention Map `src/lib/**/*.ts`

| Item | Grade | Reason |
| --- | --- | --- |
| Standalone functions, no class hierarchy / registry / single-impl provider | PASS | Confirmed by reading all seven modules. `discoverTopology` is one function; `workspacePatterns` and `workspaceManifestPaths` are pure inputs to it, disclosed as a deviation and independently tested — not a plugin seam |
| No `fs` write and no `child_process` in `src/lib/` | PASS | Uncapped grep over `src/lib/`: one hit, `readFileSync` in `fixtures/replay.ts:1`. Read-only, test support. Zero `child_process` |
| No credential read below the route/script boundary | PASS | Uncapped grep for `process.env` across `src/`: two comment mentions and one occurrence inside fixture patch text. `GITHUB_TOKEN` is read only at `scripts/ingest.mts:58`. `createGitHubClient` throws rather than falling back (`github.ts:39`) |
| Snapshot defined once as a Zod schema with derived types | PASS | `snapshot.ts:163-171`, all types `z.infer`; no parallel hand-written type |
| `enrichment` optional and unused by this chunk | PASS | `snapshot.ts:160`; `ingest.test.ts:73` asserts it is absent |

## Chunk-Specific — fixtures

| Item | Grade | Reason |
| --- | --- | --- |
| Captured output of the real producer, committed as written | PASS | HTTP transcript, not post-processed data. 175 `node_id`, 12 `merge_commit_sha`, real `x-github-request-id` and `link` headers, real patch bodies |
| Covers the branches the logic takes: a PR spanning >1 package, and one touching files outside any package | PASS | `attribution.test.ts:120` (spanning) and `:104-117` (PR 5992 carries 4 `.changeset/` files with `package: null` and 6 owned). PR 5987's `packages/vue/**` files add a second unowned case |
| Regenerated by re-running the producer; the report names the command | PASS | Report delta 7 gives the exact invocation including `--record-sample 3` |

## Chunk-Specific — manifests and config

| Item | Grade | Reason |
| --- | --- | --- |
| New dependency added with `pnpm add`, lockfile committed | N/A | No dependency added; `package.json` and `pnpm-lock.yaml` are not in the diff |
| `project.md` unmodified, architecture-fact deltas in the report | PASS | Not in the diff. 11 deltas recorded, each checkable. Delta 1 (that `pnpm build` *does* type-check modules no route imports) contradicts the current `project.md` § Commands and the lead has confirmed the measurement — the lead owes this edit at the wave boundary |

## Chunk-Specific — boundary validation (`sops/planning/boundary-validation.md`)

| Item | Grade | Reason |
| --- | --- | --- |
| Reserved keys rejected, duplicates rejected explicitly, records on `Object.create(null)`, counts capped with a message naming the limit | PASS | All four SOP Class-1 clauses present: `snapshot.ts:43` (reserved), `:56` (duplicate), `:53` (null prototype), `:154,159` + `ingest.ts:66,88` (caps naming their limit). Every repository-derived key path goes through them: `topology.ts:128` guards package names at the point of parse, `attribution.ts:60` builds the only keyed record via `buildRecord`. The snapshot's own collections are arrays, so `enrichment` is the only keyed record in the contract and this chunk does not write it. The report correctly flags that chunks 03 and 06 must call `buildRecord` rather than assigning onto a literal. Two sibling plain-object records exist outside the snapshot path — Warning 3, non-blocking |

## Chunk-Specific — correctness of approach

| Item | Grade | Reason |
| --- | --- | --- |
| PR identity from the API, not parsed from commit messages | PASS | `github.ts:120-172` only; no regex over merge text anywhere |
| Explicit window and max-count bounds; no unbounded path | PASS | `ingest.ts:84-95` validates all three before any fetch; `DEFAULT_MAX_PULL_REQUESTS = 100`; the ceiling is applied at `github.ts:149` |
| Closure computed once per snapshot | PASS | `ingest.ts:122`, outside the per-PR map |
| Timestamp only in `metadata`, and the determinism assertion excludes that and nothing else | PASS | The implementer's reinterpretation is sound, not a widening: the plan's own "Required fields per pull request" includes a merged timestamp, so the literal reading is self-contradictory. "The analysis clock appears only in `metadata`" is the strictly checkable form, and it is enforced structurally — `analyzedAt` is a required argument (`ingest.ts:39`), so `src/lib/` reads no clock at all. `withoutMetadata` (`ingest.test.ts:9-13`) deletes exactly one key. Both clock-leak mutants caught |
| Topology file list fetched with one recursive tree request | PASS | `github.ts:59`, `recursive: '1'`; truncation raises rather than silently under-reporting (`:60-64`). Mutant caught (15 failures) |
| Every API call verified against installed `@octokit/rest` 22.0.1; measurements recorded where they contradict the plan | PASS | Endpoint URLs read off `.endpoint.DEFAULTS.url`; the `merged_at <= updated_at` survey (1,619 PRs, 0 violations) and the index-406 ordering inversion are recorded both in the report and at `github.ts:102-118` |
| Reuse Audit actually run, result recorded including "none found" | PASS | Independently reproduced at base: 15 files, 0 matches on all three angles. The report also discloses a duplicate (`ownerFor`) it found and deleted pre-commit |
| Each enumerated judgment call explained | PASS | All three (indirect path cardinality, `enrichment` keying, PR cap) explained with rationale, plus three more |

## Chunk-Specific — gate falsifiability

| Item | Grade | Reason |
| --- | --- | --- |
| Each gate proven able to fail, with command, exit status and failure output | PASS | I re-derived the two the implementer rewrote, because a self-rewritten gate is the easiest place to hide. Both rewrites **strengthen** the gate: (a) Gate 2 as written in `plan.md` selects `github-missing-file.transcript.json` via `head -1` and reports `FAIL: fixture lacks "node_id"` on the *correct* tree — a gate that fails on correct work; (b) Gate 3 as written returns **5** hits of which 4 are in `*.test.ts`, so specs alone satisfy it; excluding `*.test.ts` returns exactly **1**, `src/lib/snapshot.ts:21`. Both deviations are as described. Gates 1 and 4 fail on base for the stated reasons. Note the implementer did **not** edit the gate block — the 40-line `plan.md` delta is checkbox ticks and the Artifacts Checklist only; the gate-command fixes are the lead's own `f766371` |
| Negative controls per assertion; no `git checkout --` restore | PASS | 11 controls tabulated, each with canary output and a clean re-run; restore-by-copy stated. Two controls that did not fire are reported as the canary's fault with the resolved-config evidence, which I confirmed exactly: `no-const-assign` resolves to `[0]`, `@typescript-eslint/no-unused-vars` to level 1, 113 rules / 60 error-level |

## Verdict

**FAIL** — narrow, and not for anything the code does wrong. Every behavior I checked is
correct, all four gates are green and independently reproduced, the boundary validation is
real, the fixture is genuine captured output, and the deviations are honestly reported and
verified true. The blocker is evidence: three shipped guarantees have tests that cannot
fail, one of them a contract chunks 03 and 06 will build on.

### Issues (blocking)

**1. Three tests cannot fail, so three shipped guarantees are unverified.** Reported as a
set, since fixing only the first leaves the same pattern in place.

- `src/lib/snapshot.test.ts:141-147` — `serializeSnapshot > orders object keys stably
  regardless of insertion order`. It reverses `b.metadata`'s key order and then passes both
  sides through `snapshotSchema.parse()`, which rebuilds `z.object` fields in *schema* order
  before the serializer ever sees them. Replacing `sortKeysDeep(snapshot)` with `snapshot` at
  `src/lib/snapshot.ts:179` leaves all 84 tests passing. This matters beyond tidiness: zod
  does **not** normalize `z.record` key order (measured on 4.6.5 — `{"zzz","aaa"}` parses to
  `["zzz","aaa"]`), so `enrichment` ordering depends entirely on `sortKeysDeep`, and gate 4
  cannot catch it either because no snapshot in this chunk has an `enrichment` block. Fix:
  assert over a snapshot carrying a two-key `enrichment` inserted in non-alphabetical order.
- `src/lib/ingest/attribution.test.ts:110-113` and `src/lib/ingest/github.test.ts:84-85` —
  both assert only that `additions`/`deletions` are numbers. Setting `deletions: 0` at
  `src/lib/ingest/ingest.ts:130` leaves all 84 passing, even though the fixture has 35 files
  with non-zero deletions. Fix: assert the real captured pairs for PR 5992, e.g.
  `.changeset/dirty-areas-leave.md` → `{additions: 0, deletions: 5}` and
  `packages/react/CHANGELOG.md` → `{additions: 14, deletions: 0}`.
- `src/lib/ingest/ingest.test.ts:43-47` — `orders pull requests newest merge first, which the
  API listing does not`. Deleting `matched.sort(compareByMergeRecency)` at
  `src/lib/ingest/github.ts:148` leaves all 84 passing: the captured listing is *already*
  newest-merge-first, so the test's own name is false of the committed fixture. The ceiling
  test at `ingest.test.ts:78-89` shares the weakness. Fix: assert against the listing order
  the transcript actually holds, or drop the false clause from the test name.

**2. Three references to `scripts/ingest.ts`, a file that does not exist** — the script is
`scripts/ingest.mts`. At `tsconfig.json:13` (the comment justifying the new compiler option),
`scripts/ingest.mts:10` (the run instructions) and `scripts/ingest.mts:32` (the `USAGE`
string). The last one is printed to the user on every CLI argument error, so a reader who
copies it gets `ENOENT`. The report's own project.md delta 7 gives the correct `.mts`
spelling, so this is three stale strings, not a misunderstanding.

### Warnings (non-blocking)

1. **`src/lib/ingest/topology.ts:158` and `src/lib/ingest/ingest.ts:133`** — edge order and
   changed-file order are sorted but unasserted; reversing either leaves the suite green.
   Run-to-run determinism still holds (both inputs are deterministic), so this is a gap in
   the "iteration order does not leak" half of the criterion, not a live defect.
2. **`src/lib/ingest/fixtures/replay.ts` has no co-located spec**, which the Convention Map's
   `src/lib/**/*.ts` row requires of every module. It is test support, exercised by six specs,
   and the deviation is stated at the module header. The Map needs a carve-out for
   `src/**/fixtures/**` alongside the `scripts/**` row the report already proposes (delta 4),
   rather than a spec for a test helper.
3. **Two sibling plain-object records built from externally-derived keys**, both outside the
   snapshot path: `src/lib/ingest/transcript.ts:76` (`headers[name] = value`, `name` from the
   HTTP response) and `scripts/ingest.mts:38` (`args[token.slice(2)] = value`, from `argv`).
   Neither is repository-derived and neither reaches a snapshot record, so the rubric's
   boundary item passes — but both are one-line `Object.create(null)` changes and they are the
   same shape the chunk's own SOP names.
4. **`plan.md:169-171` — T005 and T006 are still unticked** though `src/lib/snapshot.ts` and
   `src/lib/ingest/github.ts` both exist and are tested. Bookkeeping only.
5. **"`pnpm lint` passed" carries less than it looks like for this chunk.** Independently
   confirmed: `no-const-assign` resolves to `[0]`, `@typescript-eslint/no-unused-vars` to
   level 1 (warning), and `pnpm lint` exits 0 on warnings. 113 rules configured, 60
   error-level, mostly React. The implementer recorded this as project.md delta 2; the lead
   should apply it so the next chunk does not over-read a green lint.
6. **The page-level stop at `src/lib/ingest/github.ts:134-145` is unexercised.** Replacing it
   with a break on the first below-window item leaves all 84 tests passing — the captured
   two-page window never reaches the inversion the implementer measured at index 406. A
   synthetic transcript would cover it; not worth blocking this chunk for.
7. **A fourth commit, `c3357fb`**, exists beyond the three named in the dispatch. Docs-only
   (completion report, +25/-2). Gates re-run at that commit.

### Guidance

Do Issue 1 first, and do all three sites in one pass — the fix is three assertions against
values the committed fixture already carries, so no re-recording and no code change. Start
with the `serializeSnapshot` test, because it is the one whose absence a downstream chunk
inherits: write it over a snapshot with a two-key `enrichment` inserted out of order, and
confirm it fails with `sortKeysDeep` removed before putting it back. Then the two line-count
assertions, then the PR-ordering one. Issue 2 is three string edits.

Before re-submitting, re-run the four gates and re-check that each new assertion actually
fails against the mutation it is meant to catch — that is the step the red run could not
provide, since every suite failed at import.

Leave the Warnings alone unless the lead asks: 1 and 6 want fixture work that belongs to a
later chunk, 2 and 5 are `project.md` edits this chunk is forbidden from making, and 3 is
outside the criteria as written.
