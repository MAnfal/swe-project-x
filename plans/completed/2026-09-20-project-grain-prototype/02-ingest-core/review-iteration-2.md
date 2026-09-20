# Chunk 02 — Review, iteration 2 (independent)

Reviewed at `512b348` on `feat/project-grain-prototype--ingest-core`, worktree
`.worktrees/02-ingest-core` (`pwd -P` confirmed). Diff read as
`git diff feat/plan--project-grain-prototype...HEAD` — 20 files, six commits
`549d507`…`512b348`.

**Verdict: PASS.** Every rubric item graded below. Iteration 1's three blockers are fixed
and the fixes generalise; the fix for the stale `scripts/ingest.ts` strings is complete.
Two new non-blocking coverage gaps found (Warnings 1 and 2).

I graded nothing on iteration 1's authority. The bible pages the rubric cites
(`bibles/swe/testing.md`, `sops/planning/boundary-validation.md`) were read before grading
the items that cite them.

## Method

- Re-ran all four gates myself at `512b348` on a clean tree, after the last edit, type
  check last.
- Mutation-tested 27 plausible wrong implementations, one at a time, each followed by a
  full `pnpm test` and a restore-by-copy from a scratch backup. **Never** `git checkout --`.
  `git status --porcelain` and `git diff HEAD` are both empty at the end of this review;
  the tree is byte-identical to `512b348`.
- Independently re-derived the zod key-order asymmetry, the octokit endpoint URLs, and the
  base-tree reuse audit.

## Gates, re-run by me at `512b348`

| Gate | Command | Result |
| ---- | ------- | ------ |
| 1 lint | `pnpm lint` | exit 0, no output |
| 1 test | `pnpm test` | exit 0, **`Test Files 7 passed (7) / Tests 90 passed (90)`** |
| 1 build | `pnpm build` | exit 0, `✓ Generating static pages (4/4)` |
| 1 typecheck | `pnpm typecheck` | exit 0, no output |
| 2 fixture is captured output | needles on the PR transcript + `x-github-request-id` on every committed fixture | exit 0; both fixtures carry a real request id |
| 3 reserved-key guard is code, not comment | `git ls-files 'src/**/*.ts' \| grep -v '\.test\.ts$'` → 8 files, non-comment `__proto__` count | 1 hit, `src/lib/snapshot.ts:21` |
| 4 deterministic outside `metadata` | two CLI `--replay` runs, strip `metadata`, `diff` | `analyzedAt` `…15:22:45.485Z` vs `…15:22:45.703Z`; bodies identical, **23,897 bytes** |

Gate 3 must be run under **bash**, not zsh: zsh does not word-split `$src`, so
`grep … $src` receives one bogus filename, reports 0 hits, and the gate fires on a correct
tree. The plan's gate block is `bash -s <<'GATE'`, so this is a hazard for anyone running
the line by hand, not a defect in the gate.

### Falsifiability, observed rather than asserted

| Gate | Canary | Observed |
| ---- | ------ | -------- |
| 1 test | 27 source mutants (below) | 23 produce `Tests N failed` |
| 2 | as written in `plan.md`, `head -1` selects `github-missing-file.transcript.json`, which legitimately has no `node_id` | Confirmed — the as-written gate **fails on a correct tree**; the implementer's rewrite is the fix, not a weakening |
| 3 | removed `'__proto__'` from `RESERVED_KEYS` | hits 1 → 0, gate fires; restored byte-identical |
| 3 | as written in `plan.md` (no `*.test.ts` exclusion) | 15 files, **5** hits — specs alone satisfy it. Rewrite confirmed as a strengthening |
| 4 | appended `options.analyzedAt` to `pr.title` | gate fires: "not deterministic outside metadata"; restored, gate clean again |

## Mutation results

**Iteration 1's three blockers — all now fatal.**

| Mutant | Site | Result |
| ------ | ---- | ------ |
| `sortKeysDeep(snapshot)` → `snapshot` | `src/lib/snapshot.ts:179` | **KILLED, 3 tests** |
| `deletions: file.deletions` → `0` | `src/lib/ingest/ingest.ts:130` | **KILLED, 1 test** |
| drop `matched.sort(compareByMergeRecency)` | `src/lib/ingest/github.ts:148` | **KILLED, 3 tests** |

**Did the fixes generalise, or only kill the named mutant?** The lead's central question.
For each of the three I ran different wrong implementations of the same guarantee:

| Mutant | Site | Result |
| ------ | ---- | ------ |
| shallow sort — `sorted[key] = source[key]` (no recursion) | `snapshot.ts:188` | KILLED, 2 |
| sort skips arrays — `return value` instead of `value.map(sortKeysDeep)` | `snapshot.ts:183` | KILLED, 1 |
| reverse key order — `.sort().reverse()` | `snapshot.ts:187` | KILLED, 3 |
| `additions: file.additions` → `0` | `ingest.ts:129` | KILLED, 1 |
| swap `additions`/`deletions` | `ingest.ts:129-130` | KILLED, 1 |
| `package: ownerOfFile(…)` → `null` | `ingest.ts:131` | KILLED, 1 |
| sort ascending (oldest merge first) | `github.ts:154` | KILLED, 5 |
| cap applied **before** the sort | `github.ts:148-149` | KILLED, 1 |

The serializer fix in particular is not tuned to one mutant: it pins top-level order,
depth, array traversal, and record order independently, and each is separately fatal.

**The zod premise the implementer claims is pinned — verified.** `snapshot.test.ts:158-159`
asserts `Object.keys(zFirst.enrichment) === [SHA_Z, SHA_A]` *before* asserting the
serializer equalises the two. Measured directly against the installed zod **4.6.5**:

```
zod record key order: [ 'zzz', 'aaa' ]   is sorted? false
zod object key order (schema order b,a): [ 'b', 'a' ]
```

So the premise is currently true and non-vacuous: `SHA_Z > SHA_A`, so a future zod that
normalised `z.record` to sorted order would produce `[SHA_A, SHA_Z]` and the premise
assertion would fail loudly before the equality below it went vacuous. The claim holds.

**`transcriptWithReversedListing()` — checked for the failure mode the lead named.**
`fixtures/replay.ts:46-55` reverses the items *within* each pull-request listing page and
touches nothing else. It permutes the variable under test and does not construct an
unreachable input:

- The retained objects are the captured GitHub objects, unmodified.
- `isPullRequestListUrl` (`transcript.ts:123`) matches `…/pulls?…` and
  `…/repositories/{id}/pulls?…` only; `/pulls/{n}/files` and `/pulls/{n}/commits` do not
  match, so per-pull-request detail is never permuted. Pinned by
  `transcript.test.ts:114`.
- Each page keeps its `link` header, so pagination still runs over two real pages.
- The page-level stop scans every item on a page before deciding, so reversing a page
  cannot change the stop decision — confirmed empirically: the reversed run yields the
  same six pull requests and a byte-identical serialization (`ingest.test.ts:70`).

Reversal is not an order the live endpoint emits verbatim, but the guarantee under test is
"merge order is not listing order", and the implementer measured that the endpoint's
`updated` ordering is genuinely non-monotonic (inversion at index 406). A permutation is a
legitimate probe of that guarantee.

**Iteration 1's six non-blocking survivors — re-checked, all still alive, all still
non-blocking, and fixing the three did not change what they cover.**

| Mutant | Site | Result | Still non-blocking because |
| ------ | ---- | ------ | -------------------------- |
| changed-file `.sort(by path)` → `.reverse()` | `ingest.ts:133` | SURVIVED | Input order is fixed per fixture; run-to-run determinism holds |
| `edges.sort(…)` removed | `topology.ts:158` | SURVIVED | Same |
| `nodes.sort(…)` removed | `topology.ts:157` | SURVIVED | Manifest paths arrive already sorted; output order changes but stays deterministic |
| adjacency `list.sort(…)` removed | `attribution.ts:57` | SURVIVED | `discoverTopology` already emits sorted edges; defensive |
| roots `.sort()` → `.reverse()` | `attribution.ts:59` | SURVIVED | Equivalent — closure key order is not observable |
| closure over touched → over all nodes | `ingest.ts:122` | SURVIVED | Equivalent output; the rubric item is about *where* the call sits, verified by reading `ingest.ts:122` (outside the per-PR map) |
| page stop → break on first below-window item | `github.ts:137` | SURVIVED | The captured two-page window cannot reach the inversion case |

**Two new survivors, both new findings — see Warnings 1 and 2.**

| Mutant | Site | Result |
| ------ | ---- | ------ |
| `DEPENDENCY_FIELDS` narrowed to `['dependencies']` | `topology.ts:16-21` | **SURVIVED** |
| merge-recency tie-breaker `b.number - a.number` removed | `github.ts:155` | **SURVIVED** |

Killed, for completeness: `buildRecord` skipping `assertSafeKey` (2), duplicate check
removed (1), `Object.create(null)` → `{}` (1), topology `assertSafeKey` removed (1),
topology duplicate check removed (1), `ownerOfFile` prefix match without the separator (1),
shortest-match inverted (1), direct-wins removed (1), shortest-chain tiebreak inverted (1),
edges to non-workspace deps (2), `node_modules` filter removed (1).

## Universal Checks

| Item | Grade | Reason |
| --- | --- | --- |
| Does what the acceptance criteria say, verified by reading | PASS | Each criterion traced to source below |
| Every gate run after the last edit, and each can fail | PASS | Table above. Last code edit is `c2178f6`; `512b348` is docs-only. All four re-run by me on a clean tree at `512b348`, type check last. Each gate's ability to fail observed, not asserted |
| New behavior has tests covering happy path, error path, edges | PASS | 90 tests; 23 of 27 mutants fatal. Two unpinned branches remain — Warnings 1 and 2, neither a stated criterion's discriminating content |
| `completion-report.md` exists and is committed | PASS | 431 lines, committed in `817b6d5`/`c3357fb`/`512b348` |
| Tests observed failing before implementation; report shows the red run | PASS | Red run verbatim at report lines 68-93: 6 suites, 0 tests collected, exit 1. Import-failure red proves the suites ran, not that they discriminate — which is why I mutation-tested, and 23 of 27 now do |
| Abstractions justified; no unneeded layer | PASS | Seven modules, all standalone functions over plain objects. No class, registry or provider interface anywhere in `src/lib/` (read all seven) |
| No principle in `project.md` violated without justification | PASS | P1 `src/lib/` reads no `process.env` — uncapped grep over `src/` returns two comment mentions only; `GITHUB_TOKEN` read once, at `scripts/ingest.mts:59`, which P1 permits. P3 uncapped grep over `src/lib/`: one `node:fs` hit, `readFileSync` in test support `fixtures/replay.ts:1`; zero `child_process`. P4 fixture is a 28-response HTTP transcript with real GitHub headers. P5 one Zod schema, all types `z.infer` (`snapshot.ts:163-171`). P6 bounds validated at `ingest.ts:84-95` before any fetch |
| No unrelated files touched; no scope beyond the chunk | PASS | 20 files. `git diff …--name-only -- .claude/` returns **0** — `project.md` untouched. `plan.md` delta is checkbox ticks plus two annotations; the gate block is byte-identical (see the plan.md item below) |
| No secrets, credentials or keys | PASS | Uncapped `grep -icE 'gh[pousr]_…|sk-…|Bearer …|x-oauth-client-id":"…|"set-cookie":'` over the full diff → **0**. The `X-OAuth-Scopes` strings are inside GitHub's own `access-control-expose-headers` *value*, a list of header names. Recorder drops the four credential-describing headers (`transcript.ts:50-55`) and records no request headers at all; both pinned (`transcript.test.ts:52,131`). The 28 recorded header names contain none of them |
| No silent failures | PASS | `fetchTextFile` catches only 404 and rethrows everything else (`github.ts:84-87`); `parseJson` rethrows with the file name (`topology.ts:162-167`); tree truncation raises rather than under-reporting (`github.ts:60`); the one empty catch, `scripts/ingest.mts:65`, falls through to an explicit `GITHUB_TOKEN is not set` error |
| No duplicated logic an existing helper covers | PASS | Base tree reuse audit reproduced: `git ls-tree` at base shows `src/lib/` held only `utils.ts` and its spec, no `scripts/`; uncapped `git grep -cE` over all tracked `*.ts *.tsx *.mts *.mjs` at base for all three angles → 0 matches. `ingest.ts` imports `ownerOfFile` rather than re-deriving it |
| Errors/warnings graded against the captured baseline | PASS | Baseline 1 file / 3 tests recorded; delta 7 files / 90 tests, lint and typecheck unchanged at 0. Report delta 2 correctly records that `pnpm lint` exits 0 on warnings |
| Comments and docs the change touches are still true | PASS | Iteration 1's Issue 2 is fully fixed. Uncapped `grep -rn 'scripts/ingest\.ts\b'` over the whole tree returns exactly two hits, both in `review.md:178` and `completion-report.md:217` where they quote the defect. `tsconfig.json:13` and `scripts/ingest.mts:10,32` all read `.mts`; the `USAGE` string a user sees on an argument error is correct |

## Test Coverage Checks

| Item | Grade | Reason |
| --- | --- | --- |
| Schema spec: no-`enrichment` validates, missing required PR field does not | PASS | `snapshot.test.ts:47` and `:53`, both over `snapshotSchema` |
| Topology spec: nodes from layout, edge from a declared dep, a dep that must **not** produce an edge | PASS | `topology.test.ts:61,75`; the no-edge case kills the "edge to any declared dependency" mutant (2 tests) |
| Attribution spec: direct, indirect-with-path, precedence | PASS | `attribution.test.ts:46,51,59`; all three mutants fatal |
| Boundary spec: reserved key, duplicate name, size cap — rejection not truncation | PASS | Reserved `topology.test.ts:82`, `snapshot.test.ts:93,113`; duplicate `topology.test.ts:88`, `snapshot.test.ts:116`; caps `snapshot.test.ts:70,82` + `ingest.test.ts:116`. Cap tests assert the failure *names the limit*, not a truncated length. Five boundary mutants, all fatal |
| Ingest spec: two runs serialize identically outside `metadata` | PASS | `ingest.test.ts:27`; `withoutMetadata` (`:15-19`) deletes exactly one key — the exclusion is not over-broad |
| GitHub client has a co-located spec, or its absence justified | PASS | `github.test.ts`, 16 tests, driven through a real Octokit over the transcript |
| Every new module under `src/lib/` has a co-located spec | PASS with note | 6 of 7. `fixtures/replay.ts` has none; it is test support, exercised by four specs, and the record/replay mechanism it wraps is covered by `transcript.test.ts`. Justified at the module header and in the report. Warning 5 |
| Tests assert the value a consumer receives after resolution, never a round-tripped input literal — `bibles/swe/testing.md` | PASS | This is iteration 1's blocker and it is fixed. The three sites now assert values a consumer sees: real captured line-count pairs (`attribution.test.ts:113-117`) plus the 35/45 column totals; pull-request numbers in merge order (`github.test.ts:104`, `ingest.test.ts:65`); serializer output equality across two differently-ordered inputs (`snapshot.test.ts:164`). None reads back an input literal |
| Each transform tested against the producer's real captured output — `bibles/swe/testing.md` | PASS | Every pipeline spec drives a real `Octokit` over the committed HTTP transcript, so the real client, its pagination and its parsing are in the path. `github.test.ts:77` asserts the incidental fields survive. This is the bible's § "Test third-party dependency output against real generated files" satisfied in the strong form — the transcript is the dependency's real output, not a post-processed approximation |

## Chunk-Specific — acceptance criteria

| Item | Grade | Reason |
| --- | --- | --- |
| Schema-valid object with topology, windowed PRs, per-PR file and commit detail | PASS | `ingest.ts:154-166` returns `snapshotSchema.parse(...)`. My own CLI run: 10 packages, 6 pull requests |
| Node per app/package; edge exactly when a manifest declares a workspace dependency; declared only, never scanned imports | PASS | `topology.ts:141-155`. The `seen.has(to)` filter is what makes it "workspace only" and its removal kills 2 tests. No import scanning anywhere — the only inputs are manifest JSON and the tree listing. Three of the four manifest fields are untested; see Warning 1 |
| PR changing a file inside a package → **direct** | PASS | `attribution.ts:96`; over real data PR #5989 → `["@xyflow/system"]` |
| PR reaching a package only via the graph → **indirect**, path stored | PASS | `attribution.ts:105-112`; the schema refines the path invariant (`snapshot.ts:104`) and `snapshot.test.ts:61` proves the refinement rejects a bad path. Real two-hop case asserted at `attribution.test.ts:93` |
| Both direct and indirect ⇒ direct | PASS | `attribution.ts:108`; removing the guard kills 1 test |
| Two ingests byte-identical apart from `metadata` | PASS | Gate 4 reproduced by me at 23,897 bytes with differing `analyzedAt`; three specs, and the reversed-listing run serializes identically to the normal one (`ingest.test.ts:70`) — that is the strongest form of "iteration order does not leak" in the suite. Some sorts remain unasserted (Warning 3), but no run-to-run non-determinism exists |
| Each changed file carries added/removed counts, captured at ingest, attributed to its owning package | PASS | `ingest.ts:127-132`. Fixed this iteration: three mutants on this line (`additions→0`, `deletions→0`, swap) and one on the owner are each fatal |
| Squash, merge-commit and rebase all appear with commits attached | N/A — honestly reported partial | Structurally satisfied: nothing reads `git log` or parses merge text; identity comes from `pulls.list` / `pulls/{n}/commits` only. The report states plainly that the captured window does not establish all three strategies are present and that the API does not report the strategy used. That is the correct disposition — the criterion is unfalsifiable against any single capture, not a defect to fix here |
| Malicious/malformed repository-derived name rejected before use as a key | PASS | `topology.ts:128` at the point of parse + `snapshot.ts:39-62`; five mutants across both, all fatal |

## Chunk-Specific — Convention Map `src/lib/**/*.ts`

| Item | Grade | Reason |
| --- | --- | --- |
| Standalone functions; no class hierarchy, registry, or single-implementation provider interface; topology is one function, not a plugin seam | PASS | Read all seven modules. Zero `class`, zero `interface` with one implementation, zero registry. `discoverTopology` is one function body; `workspacePatterns` and `workspaceManifestPaths` are pure inputs to it, each independently tested and disclosed as a deviation. Nothing is built for a second ecosystem |
| No `fs` write, no `child_process` in `src/lib/` | PASS | Uncapped grep over `src/lib/` for `child_process\|writeFile\|appendFile\|mkdir\|rmSync\|node:fs` → one hit, `readFileSync` in `fixtures/replay.ts:1`, a read-only read in test support. The CLI's `writeFileSync` is in `scripts/`, which Principle 3 permits |
| No credential read below the route/script boundary | PASS | Uncapped grep for `process.env\|GITHUB_TOKEN\|ANTHROPIC_API_KEY` over `src/` (excluding fixtures) → two comment mentions, zero reads. `createGitHubClient` throws rather than falling back (`github.ts:39-41`), pinned by `github.test.ts:37` |
| Snapshot defined once as a Zod schema, types derived | PASS | `snapshot.ts:163-171`, nine `z.infer` types, no parallel hand-written type |
| `enrichment` optional and nothing here requires it | PASS | `snapshot.ts:160` `.optional()`; `ingest.test.ts:97` asserts a real ingest leaves it undefined, and `snapshot.test.ts:47` that such a snapshot validates |

## Chunk-Specific — fixtures

| Item | Grade | Reason |
| --- | --- | --- |
| Captured output of the real producer, committed as written, carrying the incidental fields — Principle 4, `bibles/swe/testing.md` | PASS | An HTTP transcript of 28 real responses, not post-processed data. I enumerated the recorded header names: `x-github-request-id`, `x-ratelimit-*`, `etag`, `link`, `x-github-edge-region` — headers no hand-written file would invent. Two list pages, the second addressed as `/repositories/197018189/pulls` because that is the spelling GitHub's own `link` header uses. `github.test.ts:77` asserts `node_id` and `merge_commit_sha` survive the client |
| Covers the branches the logic takes: a PR spanning >1 package, and one touching files outside any package | PASS | Spanning: `attribution.test.ts:128`. Outside: PR 5992 carries four `.changeset/` files with `package: null` and six owned (`:123-125`); PR 5987's `packages/vue/**` files are a second unowned case |
| Regenerated by re-running the producer, not hand-edited; the report names the command | PASS | Report delta 7 gives the exact invocation with `--record-sample 3`. `sampleTranscript` (`transcript.ts:140-162`) only *drops* whole listed pull requests; every retained object is the bytes GitHub returned, pinned by `transcript.test.ts:90` |

## Chunk-Specific — manifests and config

| Item | Grade | Reason |
| --- | --- | --- |
| New dependency added with `pnpm add`, lockfile committed | N/A | No dependency added — `package.json` and `pnpm-lock.yaml` are not in the diff. The only manifest change is `tsconfig.json` gaining `allowImportingTsExtensions`, reported as delta 5 |
| **Plan constraint overrides the map**: `project.md` unmodified, and every architecture-fact delta in the report | PASS | `git diff …--name-only -- .claude/` → 0. Eleven deltas recorded, each checkable. Delta 1 (that `pnpm build` *does* type-check modules no route imports) contradicts the `project.md` copy in this worktree and is the lead's to apply |

## Chunk-Specific — boundary validation (`sops/planning/boundary-validation.md`)

| Item | Grade | Reason |
| --- | --- | --- |
| Reserved keys rejected; duplicates rejected explicitly; records on `Object.create(null)`; counts capped with a message naming the limit | PASS | All four SOP Class-1 clauses: `snapshot.ts:43` reserved, `:56` duplicate, `:53` null prototype, `:154,159` + `ingest.ts:66,88` caps naming their limit. **I re-enumerated every key path rather than inheriting iteration 1's finding**, because the implementer added two more `Object.create(null)` records this iteration. Uncapped grep for dynamic key writes (`x[expr] =`) over `src/` and `scripts/` returns exactly three: `snapshot.ts:59` (inside `buildRecord`, after `assertSafeKey` and the duplicate check), `transcript.ts:81` (HTTP response header names, on a null prototype, not repository-derived, never reaches a snapshot), `scripts/ingest.mts:45` (argv flag names, null prototype, same). Every other keyed collection in the chunk is a `Map` or `Set`, which is not prototype-pollutable. The one repository-derived record — the reverse closure — is built via `buildRecord` (`attribution.ts:60`); package names are guarded at the point of parse (`topology.ts:128`). `topology.ts:150` reads `Object.keys` of a parsed manifest, but a key is only used if `seen.has(to)`, and `seen` holds only `assertSafeKey`-validated names. The SOP's Class 2 does not apply — no upstream guarantee is dropped here. `snapshot.test.ts:126` pins the reason the schema cannot be the boundary: zod 4.6.5 *silently drops* a reserved `z.record` key rather than rejecting it, which I reproduced |

## Chunk-Specific — correctness of approach

| Item | Grade | Reason |
| --- | --- | --- |
| PR identity from the API, not parsed from commit messages | PASS | `github.ts:120-172` only; no regex over merge text anywhere in the diff |
| Explicit window and max-count bounds; no path fetches without one; bound set at the call site | PASS | `ingest.ts:84-95` validates the integer ceiling, the schema cap, and a non-empty window before any fetch. `DEFAULT_MAX_PULL_REQUESTS = 100` (`snapshot.ts:30`), applied at `github.ts:149`. `ingest.test.ts:116` asserts a ceiling above the schema cap is *rejected*, not truncated |
| Dependency closure computed once per snapshot, not per pull request | PASS | `ingest.ts:122`, outside the `detailed.map` at `:124`. Verified by reading, since the "over all nodes" mutant is output-equivalent |
| A timestamp appears only inside `metadata`, and the determinism assertion excludes that block and nothing else | PASS, with the rubric's literal wording set aside | The literal reading is self-contradictory: the same plan's "Required fields per pull request" mandates a merged timestamp (`plan.md:74-76`), and the criterion at `plan.md:50-52` says "no timestamp appears outside `metadata`". The checkable form is the **analysis clock**, and it is enforced structurally: `analyzedAt` is a required argument (`ingest.ts:39`), so nothing in `src/lib/` reads a clock at all. `ingest.test.ts:42` asserts the analysis timestamp appears nowhere outside `metadata`. The exclusion is exactly one key (`ingest.test.ts:15-19`) — not over-broad. Flagging the rubric/plan tension rather than failing correct work |
| Topology file list fetched with one recursive tree request | PASS | `github.ts:59`, `recursive: '1'`; truncation raises rather than under-reporting (`:60-64`). The transcript shows exactly one `/git/trees/main?recursive=1` and no per-directory listing |
| Every API call verified against the **installed** `@octokit/rest` (22.0.1) | PASS | Version read off disk: **22.0.1**. I read the six endpoint URLs off `.endpoint.DEFAULTS` myself — `repos.get`, `git.getTree`, `repos.getContent`, `pulls.list`, `pulls.listFiles`, `pulls.listCommits` all resolve to the paths the code's comments claim, and `paginate.iterator` is a function. Where the measurement contradicted the plan (no merge-date filter on `pulls.list`; non-monotonic `updated` ordering, inversion at index 406) the report records the measurement and the code carries it at `github.ts:102-118` |
| Reuse Audit actually run, by name, algorithm and problem, result recorded | PASS | Reproduced independently at base: `git ls-tree -r` shows `src/lib/` held only `utils.ts` and its spec and no `scripts/`; uncapped `git grep -cE` at base across all three angles over `*.ts *.tsx *.mts *.mjs` → 0 matches. "None found" is recorded, and the report also discloses a duplicate (`ownerFor`) found and deleted pre-commit |
| Each enumerated judgment call explained with its rationale | PASS | All three the plan names — indirect path cardinality, `enrichment` keying, the PR cap — plus three more, each with a reason rather than a restatement |

## Chunk-Specific — gate falsifiability

| Item | Grade | Reason |
| --- | --- | --- |
| Each gate proven able to fail; the report shows command, exit status and failure output | PASS | See § Falsifiability. I re-derived the two gates the implementer rewrote, because a self-rewritten gate is the easiest place to hide, and both rewrites **strengthen**: gate 2 as written fails on a correct tree, gate 3 as written is satisfied by specs alone (5 hits, 4 in tests). The implementer did not touch the gate block — the `plan.md` delta is checkbox ticks and two Artifacts Checklist annotations, confirmed line by line |
| Negative controls per assertion; no `git checkout --` restore | PASS | Eleven controls tabulated with canary output and a clean re-run; restore-by-copy stated. Two that did not fire are reported as the canary's fault with resolved-config evidence. My own canaries followed the same discipline and the tree is byte-identical afterwards |

## `plan.md` — did the implementer weaken its own gates?

No. `git diff feat/plan--project-grain-prototype...HEAD -- …/plan.md` is 44 lines: T001–T012 and the seven Deliverables ticked, plus two Artifacts Checklist lines annotated
("reported as project.md deltas; this chunk may not edit the file" and "11 deltas
reported"). The `## Verification Gates` block, the acceptance criteria, the test plan and
the reuse audit are all untouched. The gate-command fixes (`pnpm test` without `--run`,
`pnpm typecheck`, the `src/**/*.ts`-only glob) came from the lead's `f766371` on the base
branch and are already in the merge base, which is why they do not appear in the
three-dot diff.

## Verdict

**PASS.**

### Issues (blocking)

None.

### Warnings (non-blocking)

1. **`src/lib/ingest/topology.ts:16-21` — three of the four `DEPENDENCY_FIELDS` have no
   test.** Narrowing `DEPENDENCY_FIELDS` to `['dependencies']` leaves all 90 tests green,
   yet **6 of the 13 edges** the committed fixture produces come from `devDependencies`
   (`@xyflow/react → @xyflow/eslint-config`, `→ @xyflow/rollup-config`,
   `→ @xyflow/tsconfig`, and the same three from `@xyflow/system`). Including all four
   fields is a documented judgment call (report § Judgment calls), so this is unpinned
   deliberate behavior, not a defect — and the criterion's discriminating content
   ("declared only, no edge to a non-workspace dependency") *is* pinned, which is why this
   is a warning rather than a blocker. The sibling signal: `topology.test.ts:13` declares a
   `devDeps` parameter on its `manifest()` helper that no call site supplies. One line —
   `manifest('a', {}, { b: 'workspace:*' })` asserting
   `{from:'a', to:'b', kind:'devDependencies'}` — closes it.

2. **`src/lib/ingest/github.ts:155` — the merge-recency tie-breaker is unpinned.**
   Replacing `return byMerge !== 0 ? byMerge : b.number - a.number;` with `return byMerge;`
   leaves all 90 green. It only matters when two pull requests share a `merged_at`, which
   the captured window does not contain; without it the order falls back to listing order
   for ties, which is the one thing the sort exists to remove. A two-element unit test on
   the comparator would cover it without touching the fixture.

3. **Carried from iteration 1, still true: five sorts have no test that fails without
   them** — `ingest.ts:133` (changed-file order), `topology.ts:157,158` (node and edge
   order), `attribution.ts:57,59` (adjacency and roots). Run-to-run determinism holds
   because every input is deterministic, so this is a gap in the "iteration order does not
   leak" half of the criterion, not a live defect.

4. **Carried from iteration 1: the page-level stop at `github.ts:134-145` is
   unexercised.** Breaking on the first below-window item leaves all 90 green — the
   captured two-page window never reaches the inversion the implementer measured. It needs
   a synthetic transcript, which is fixture work for a later chunk.

5. **Carried from iteration 1: `src/lib/ingest/fixtures/replay.ts` has no co-located
   spec**, which the Convention Map's `src/lib/**/*.ts` row requires. It is test support,
   and the Map wants a carve-out for `src/**/fixtures/**` alongside the `scripts/**` row
   the report proposes as delta 4 — not a spec for a test helper.

6. **Gate 3 is shell-sensitive.** Run under zsh, `grep -hE "__proto__" $src` receives the
   whole file list as one argument (zsh does not word-split unquoted expansions), reports
   0 hits, and the gate fires on a correct tree. The plan runs it inside `bash -s`, so this
   is a hazard for a human running the line by hand. Worth a note next to the gate.

### Guidance

Nothing blocks the merge. If the lead wants the two new gaps closed before merging, they
are a single small pass in one file each and need no fixture work:

1. `topology.test.ts` — one case asserting a `devDependencies` edge, confirmed fatal
   against `DEPENDENCY_FIELDS = ['dependencies']`.
2. `github.test.ts` — a comparator case with two pull requests sharing a `merged_at`,
   confirmed fatal against the tie-breaker's removal.

Warnings 3–5 are the lead's call and belong to later chunks: 3 and 4 want synthetic
fixtures, 5 wants a `project.md` edit this chunk is forbidden from making. Warning 6 is a
one-line comment on the gate.

For the wave boundary: the report's eleven `project.md` deltas are the lead's to apply.
Deltas 1 (that `pnpm build` *does* type-check modules no route imports) and 10 (the
§ Layout wording that tells the next implementer network calls may not live in `src/lib/`)
are the two that will misdirect the next chunk if left.
