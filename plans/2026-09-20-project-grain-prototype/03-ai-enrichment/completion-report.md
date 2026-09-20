# Chunk 03 — Completion Report

Enrichment: per-PR label, approach note and step chain, plus baked snapshots for the three
curated repositories.

Worktree `/Users/anfal/Projects/hobby_projects/swe-take-home/.worktrees/03-ai-enrichment`,
branch `feat/project-grain-prototype--ai-enrichment`, base `cb41f75`.

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `src/lib/ai/enrichment.ts` | created | The model-output schema, the `generateObject` call, merge-SHA keying, the bounded payload builder, the fallback path and `enrichSnapshot`. Takes a configured `LanguageModel` as a parameter — reads no credential. |
| `src/lib/ai/enrichment.test.ts` | created | 28 specs: output-schema bounds, key derivation, success path, SHA resolution, the three failure paths, payload bounding, cache reuse, token accounting, reserved-key rejection. |
| `src/lib/ai/baked-snapshots.test.ts` | created | Asserts the committed snapshots' properties — schema validity, enrichment coverage, that steps name real commits, that they are mostly real model output, and that none carries a credential. |
| `scripts/ingest.mts` | edited | Gained `--enrich`, `--model`, `--concurrency`, `--reuse`; `tokenFromEnvironment()` generalised to `secretFromEnvironment(name)`; `parseArgs` learned standalone boolean flags. |
| `src/lib/snapshots/xyflow-xyflow-2026-06-22.json` | created | Baked output: 100 pull requests, 10 packages, 13 edges, 0 fallbacks. |
| `src/lib/snapshots/shadcn-ui-ui-2026-06-22.json` | created | Baked output: 100 pull requests, 5 packages, 4 edges, 0 fallbacks. |
| `src/lib/snapshots/trpc-trpc-2026-06-22.json` | created | Baked output: 36 pull requests, 40 packages, 106 edges, 1 fallback. |

I did **not** create, edit or delete `src/lib/snapshots/xyflow-xyflow-2026-08-31.json` —
chunk 04's file. My xyflow window is `2026-06-22`, so the filenames do not collide.

## Acceptance criteria

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| Enrichment returns a label, an approach note and at least one ordered step, schema-validated | yes | `enrichPullRequest > returns the model label, approach and ordered steps` — asserts the three fields on the returned record and that it passes `enrichmentEntrySchema.safeParse`. `enrichPullRequest` parses every result through `enrichmentEntrySchema` before returning it. |
| An already-enriched pull request makes no model call | yes | `enrichSnapshot > makes no model call for a pull request this snapshot already carries` — `expect(model.doGenerateCalls).toHaveLength(0)`, `reused === 1`, and the returned entry equals the stored one. Confirmed live: the trpc retry run reported `30 reused` and spent tokens only on the 6 it re-tried. |
| A failed, timed-out or schema-rejected call still yields a label, and the failure is surfaced | yes | Three specs — `degrades to the pull request title when the model call throws`, `degrades when the model returns output the schema rejects`, `degrades when a step names a commit the pull request does not contain`. `enrichSnapshot > surfaces a failure instead of swallowing it` asserts `failures[0].{key,number,error}`. Live: the bake printed `enrichment failed for #7592 (81ed96ec…): pull request #7592 has no commits…` and the run still wrote a snapshot. |
| The bake command writes a snapshot with both deterministic data and enrichment | yes | `node scripts/ingest.mts --repo trpc/trpc --since 2026-06-22T00:00:00Z --until 2026-09-20T00:00:00Z --out src/lib/snapshots/trpc-trpc-2026-06-22.json --enrich` → `40 packages, 36 pull requests`, `enrichment: 30 enriched, 5 reused, 1 failed`. |
| A committed snapshot validates against chunk 02's schema with `enrichment` populated for every pull request | yes | Gate 2: `OK …shadcn-ui-ui…: 100 enriched / …trpc-trpc…: 36 enriched / …xyflow-xyflow…: 100 enriched`. `baked-snapshots.test.ts` parses each file through `snapshotSchema` and checks every pull request's entry. |
| No credential is referenced outside a server-only module | yes | Gate 3c, syntax-anchored: `no process.env read anywhere under src/` across 27 tracked files. The two reads are `scripts/ingest.mts:110` and `:165`. |

## Tests

Red before green, in the order they were written.

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| All of `enrichment.test.ts` (T001 schema, T002 fallback, T003 cache) | `FAIL src/lib/ai/enrichment.test.ts [ … ]` → `Error: Cannot find package '@/lib/ai/enrichment' imported from …/src/lib/ai/enrichment.test.ts`; `Test Files 1 failed | 7 passed (8)` | `Test Files 8 passed (8) / Tests 118 passed (118)` |
| `enrichSnapshot > retries a pull request whose stored entry is a degraded fallback` | `AssertionError: expected [] to have a length of 1 but got +0` at `expect(model.doGenerateCalls).toHaveLength(1)` | green in the run reporting `Tests 120 passed (120)` |
| `modelEnrichmentSchema field descriptions > state the character budget in the description…` | `× state the character budget in the description, not only as a maxLength the model never reads`; `Tests 2 failed | 118 passed (120)` | same run as above |
| `enrichPullRequest > never calls the model for a pull request with no commits…` | `AssertionError: expected [ { responseFormat: { …(4) }, …(13) } ] to have a length of +0 but got 1` | `Tests 121 passed (121)` |
| `enrichPullRequest > resolves a SHA the model mistyped in its tail, seen in the real bake` | `AssertionError: expected true to be false` at `expect(outcome.failed).toBe(false)` | `Tests 135 passed (135)` |
| `committed snapshots > …` (`baked-snapshots.test.ts`) | run against an emptied `src/lib/snapshots/`: `- ArrayContaining [ StringContaining "xyflow-xyflow-", … ] + []`; `Test Files 1 failed | 8 passed (9)` | `Test Files 9 passed (9) / Tests 135 passed (135)` |

**One test was written to be vacuous and had to be replaced.** The first version of the
character-budget test asserted `JSON.stringify(z.toJSONSchema(modelEnrichmentSchema))`
contained the numbers — which it already did, as `maxLength`, so it passed before any
change. Rewritten to assert `shape.label.description` etc., it went red as it should.

## Gates

Baseline captured at `/tmp/baseline-paAmVC` on the base tree before any edit:
`pnpm lint` → no output, exit 0; `pnpm test` → `Test Files 7 passed (7) / Tests 94 passed (94)`;
`pnpm build` → `✓ Compiled successfully`; `pnpm typecheck` → clean. The base tree had **zero**
errors and **zero** warnings, so every result below is an absolute count *and* the delta.

All four run after the last edit, type check last.

| Gate | Command | Result | Fails on base? |
| ---- | ------- | ------ | -------------- |
| Lint | `pnpm lint` | no output, exit 0 (0 problems) | **No — and it cannot.** Lint was clean on base and is clean now; this gate can only catch a regression. Falsified by negative control instead (see NC4/NC9 below, which `tsc` catches). |
| Tests | `pnpm test` | `Test Files 9 passed (9) / Tests 135 passed (135)` (+41 tests over baseline) | **Yes.** The chunk's specs do not resolve on base: `Cannot find package '@/lib/ai/enrichment'`, and `baked-snapshots.test.ts` fails with an empty snapshot directory. |
| Build | `pnpm build` | `✓ Compiled successfully in 401ms` / `Finished TypeScript in 2.2s` | No — passes on base. Falsified by NC9. |
| Type check | `pnpm typecheck` | no output, exit 0 | No — passes on base. Falsified by NC9. |
| Gate 2 (snapshot enrichment) | `bash /tmp/gate2.sh` (corrected, below) | `OK …shadcn-ui-ui…: 100 enriched` / `OK …trpc-trpc…: 36 enriched` / `OK …xyflow-xyflow…: 100 enriched` | **Yes.** On a worktree at base `cb41f75`: `FAIL: expected a committed snapshot per curated repository, found 0`, exit 1. |
| Gate 3a (no public-env credential) | `git ls-files -z '*.ts' '*.tsx' '*.mts' \| xargs -0 grep -nE 'NEXT_PUBLIC_[A-Z_]*(KEY\|TOKEN\|SECRET)' \| grep -vE '^\s*(//\|\*)'` | scanned 30 tracked files, no hits | No — absence held on base too. Falsified by NC4. |
| Gate 3b (no env file tracked) | `git ls-files \| grep -E '(^\|/)\.env($\|\.)' \| grep -v '^\.env\.example$'` | no output | No. Falsified by NC7. |
| Gate 3c (no credential read under `src/`) | `git ls-files -z 'src/*.ts' 'src/*.tsx' \| xargs -0 grep -nE 'process\.env\s*[.[]' \| grep -vE ':\s*(//\|\*\|/\*)'` | scanned 27 tracked files, no hits | No. Falsified by NC5, and NC6 proves it does not fire on a comment. |

### Two defects in the plan's gate block, both found by running it

**Gate 2 as the plan writes it cannot fail on the base tree.** Its `for snap in $(git ls-files | grep …)`
loop iterates zero times when no snapshot is committed, and the block exits 0 — the "empty
corpus" shape `gates.md` names by name. Measured on a worktree at `cb41f75`:

```
$ git ls-files | grep -E 'snapshots?/.*\.json$' | wc -l
0
$ # the plan's loop, verbatim
loop finished, exit 0
exit=0
```

Corrected by requiring a non-empty corpus before looping. This is the version I ran, and
the version the lead should carry forward:

```bash
set -euo pipefail
snaps=$(git ls-files | grep -E 'snapshots?/.*\.json$' || true)
count=$(printf '%s' "$snaps" | grep -c . || true)
if [ "$count" -lt 3 ]; then
  echo "FAIL: expected a committed snapshot per curated repository, found $count" >&2; exit 1
fi
for snap in $snaps; do
  node -e '
    const snap = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const prs = snap.pullRequests ?? [];
    if (prs.length === 0) { console.error("FAIL: no pull requests in " + process.argv[1]); process.exit(1); }
    const missing = prs.filter(p => {
      const e = (snap.enrichment ?? {})[p.mergeCommitSha ?? p.number];
      return !e || !e.label || !e.approach;
    });
    if (missing.length) {
      console.error("FAIL: " + missing.length + "/" + prs.length + " pull requests lack enrichment in " + process.argv[1]);
      process.exit(1);
    }
    console.log("OK " + process.argv[1] + ": " + prs.length + " enriched");
  ' "$snap"
done
```

The accessor `snap.enrichment[p.mergeCommitSha ?? p.number]` is left exactly as the plan
wrote it, because `enrichmentKey` deliberately keys by `mergeCommitSha ?? String(number)`.

**The plan's env-file needle matches `.env.example` and fails on the base tree for the
wrong reason.** `git ls-files | grep -qE '(^|/)\.env($|\.)'` matches `.env.example`, which
this project commits on purpose via an explicit `!.env.example` negation. Running the
plan's Gate 3 verbatim printed `FAIL: an env file is tracked` on clean, correct trees.
Corrected with `| grep -v '^\.env\.example$'`.

I also scoped Gate 3a to tracked files rather than the plan's `.`, which walks
`node_modules`. The search is uncapped and covers every tracked `.ts`/`.tsx`/`.mts`
(30 files) — `git ls-files` is the right corpus for a claim about this repository's code.

### Negative controls, per assertion

Every sabotage restored by copying a backup back, never `git checkout --`, with `diff -q`
confirming the restore and the gate re-run confirming it returns clean.

| # | Sabotage | Gate | Fired? | Clean after restore? |
| - | -------- | ---- | ------ | -------------------- |
| NC1 | blank one `approach` in trpc snapshot | Gate 2 | yes — `FAIL: 1/36 pull requests lack enrichment` | yes, exit 0 |
| NC2 | delete one enrichment entry | Gate 2 | yes — `FAIL: 1/36 pull requests lack enrichment` | yes, exit 0 |
| NC3 | empty `pullRequests` | Gate 2 | yes — `FAIL: no pull requests in …` | yes, exit 0 |
| NC4 | add `process.env.NEXT_PUBLIC_ANTHROPIC_KEY` to `enrichment.ts` | Gate 3a | yes — printed the line, exit 1 | yes, exit 0 |
| NC5 | same line | Gate 3c | yes — exit 1 | yes, exit 0 |
| NC6 | add a *comment* naming `ANTHROPIC_API_KEY` | Gate 3c | correctly **did not** fire (exit 0) | n/a |
| NC7 | `git add -f .env.canary` | Gate 3b | yes — printed `.env.canary` | yes, exit 0 after `git rm --cached` |
| NC8 | replace the fallback label with `"broken"` | `pnpm test` | yes — 4 failures incl. `degrades to the pull request title when the model call throws` | yes, `Tests 135 passed` |
| NC9 | `const canary: number = "not a number"` | `pnpm typecheck`, `pnpm build` | yes — both: `src/lib/ai/enrichment.ts(431,7): error TS2322` | yes, typecheck exit 0 |

NC6 matters: my first version of Gate 3c grepped for the bare names `ANTHROPIC_API_KEY|GITHUB_TOKEN`
and fired on the module's own doc comment explaining that it never reads one — the
"bare-word grep matches the comment explaining why the thing is forbidden" anti-pattern.
Re-anchored to `process\.env\s*[.[]`.

## Windows, sizes and cost

Window **2026-06-22T00:00:00Z .. 2026-09-20T00:00:00Z** (90 days) for all three, with the
default ceiling of 100 pull requests.

| Repository | Pull requests | Packages | Edges | Fallbacks | File size |
| ---------- | ------------- | -------- | ----- | --------- | --------- |
| `xyflow/xyflow` | 100 (hit the 100 cap) | 10 | 13 | 0 | 452 KB |
| `shadcn-ui/ui` | 100 (hit the 100 cap) | 5 | 4 | 0 | 589 KB |
| `trpc/trpc` | 36 | 40 | 106 | 1 | 416 KB |

**The lead's density numbers were low by a wide margin, as flagged.** They predicted 13
merged pull requests for `shadcn-ui/ui` at 90 days; the real ingest returned at least 100
(it hit the cap). `xyflow/xyflow` likewise hit the cap against a predicted 68. Only
`trpc/trpc` landed near its estimate (36 against 36–41). The measurement wins; I kept the
90-day window and let the `DEFAULT_MAX_PULL_REQUESTS` ceiling of 100 bound the two large
ones, which is Principle 6 working as intended rather than a truncation to work around.

### Token totals per repository — the evidence Design Decision 10 asked for

Measured from the shipped pipeline (the clean bake plus the retry pass that produced the
committed files). `claude-haiku-4-5` at $1/MTok in, $5/MTok out.

| Repository | Calls | Input tokens | Output tokens | Cost |
| ---------- | ----- | ------------ | ------------- | ---- |
| `xyflow/xyflow` | 100 | 121,966 | 14,855 | $0.196 |
| `shadcn-ui/ui` | 100 | 126,555 | 12,590 | $0.190 |
| `trpc/trpc` | 35 (one skipped, no commits) | 73,928 | 5,297 | $0.100 |
| **Total** | **235** | **322,449** | **32,742** | **$0.486** |

Averages: **1,373 input / 139 output tokens per pull request.** At those rates the same
bake on `claude-opus-5` ($5/$25) would cost **$2.43** — 5× for the same payload.

Total session spend, including the pipeline-development runs that were discarded and
re-baked, was roughly **$0.95**: the discarded bakes came to about 300,136 input and
31,604 output tokens (~$0.46), plus a 2-call smoke test and ~11 diagnostic calls whose
token counts I did not instrument.

### Model quality — I am **not** recommending escalation, and here is why

Design Decision 10's trigger is "the approach notes read as restatements of *what* changed
rather than *how* it was done". Reading the baked records, the notes describe method
wherever a method exists:

> `trpc/trpc#7604` — "Added a check for the `done` flag when iterating async iterables in
> the JSONL parser, throwing a clear 'Stream closed unexpectedly' error **instead of**
> letting a TypeError occur when the stream ends before all chunks arrive."

> `trpc/trpc#7583` — "Updated all @docusaurus packages from 3.7 to 3.10.2, **renamed** the
> config option `future.experimental_faster` to `future.faster`, and enabled
> `future.v4.removeLegacyPostBuildHeadAttribute` **as required by** the faster SSG
> worker-thread build mode."

> `xyflow/xyflow#5977` — "Modified the visible elements store logic to **check connected
> node visibility before rendering edges**, preventing disconnected edge artifacts."

Both the path taken and the path not taken show up. The weak notes are all on changes with
no method to describe:

> `shadcn-ui/ui#11915` — "Extended the registry directory by appending entries for
> community-maintained registries covering React components, design systems, AI agents,
> and UI libraries."

> `xyflow/xyflow#5992` (automated Changesets release) — "Automated version bump and
> changelog consolidation produced by Changesets release action, consuming four pending
> changesets to bump three packages."

Those are restatements because appending rows to a list and running a release bot *have* no
approach. A larger model cannot invent one from a payload that does not contain one, which
is precisely Design Decision 10's own reasoning. So I read the trigger as not fired. The
call remains the owner's, the numbers above are what it would be argued from, and
escalating costs an env change (`ENRICHMENT_MODEL=claude-opus-5`) and a re-bake.

## Judgment calls

- **Concurrency: bounded at 4** (`DEFAULT_ENRICHMENT_CONCURRENCY`, overridable with
  `--concurrency`). A worker-pool `mapWithConcurrency` keeps results in input order, so the
  snapshot is byte-identical regardless of completion order and `serializeSnapshot`'s
  determinism guarantee survives. Four was enough to make a 100-pull-request bake take
  about a minute without ever tripping a rate limit across five live bake runs; sequential
  would have been roughly four times slower for no benefit, and unbounded `Promise.all`
  would fire 100 concurrent requests at the owner's key.

- **The fallback marker lives inside `approach`, not beside the entry.** I first intended a
  `fallback: true` field on the record and measured that it cannot work:
  `enrichmentEntrySchema` is a plain `z.object`, so on zod 4.6.5
  `enrichmentEntrySchema.parse({label, approach, steps, fallback: true})` returns
  `{"label":"L","approach":"A","steps":[…]}` — the marker is **silently stripped** and would
  never reach a snapshot. Changing the merged schema was not an option: chunk 02 owns it and
  chunks 04/06 read it. So the marker is the exported constant `FALLBACK_APPROACH`, and a
  renderer distinguishes a real label from a degraded one by calling the exported predicate
  `isFallbackEnrichment(entry)` — never by string-matching the constant itself. A degraded
  record's single step (the merged schema's `.min(1)` forbids the empty chain the plan
  described) has `summary: FALLBACK_STEP_SUMMARY` and `commitSha: enrichmentKey(pullRequest)`,
  which points at the pull request's own merge SHA rather than inventing a commit.

- **The PR body is truncated, not verbatim** — `MAX_PROMPT_BODY_CHARS = 4000`, with a `…`
  and an explicit "the lists above were truncated" note appended so the model knows it is
  seeing a partial input rather than inferring a smaller change. Commits are capped at 40
  (first line only, 300 characters each) and files at 120 paths. Bodies in the real corpus
  ran to 4,697 characters, so the cap is load-bearing rather than theoretical. Very large
  bodies therefore lose their tail; I kept the head because PR templates put the summary
  first and the checklists and generated changelogs last.

- **No patches are sent**, per the plan. The approach notes above are evidence that commit
  messages, paths and the body are enough — I did not need to expand the payload.

- **Committed snapshots are output of the shipped code.** I changed enrichment behaviour
  twice after the first bakes (the description budgets, then the SHA resolver), so I threw
  the first bakes away and re-baked all three from scratch with the final code, then ran one
  `--reuse` pass to retry the records the fixed resolver could now resolve. Every reused
  entry was produced by the identical prompt and an unchanged success path, so no committed
  entry predates the shipped pipeline.

## Deviations from the plan

- **`steps` is not a list of bare phrases** — as the plan's own amendment says, the merged
  schema wins. Each step carries `commitSha` plus `summary`, and every SHA is bound to a
  commit the pull request really contains.
- **A degraded record cannot have an empty step chain**, because `enrichmentEntrySchema`
  requires `.min(1)`. See the judgment call above for what the single step is.
- **The `ai` test double is `MockLanguageModelV4`, not a V3 mock.** `ai@7.0.107` exports
  both from `ai/test`, and `generateObject` accepts either at runtime — I measured both
  returning a parsed object. I use V4 because `@ai-sdk/anthropic@4.0.58`'s
  `AnthropicProvider extends ProviderV4` and its `languageModel()` returns
  `LanguageModelV4`, so V4 is what the real provider hands `generateObject`. Two shapes the
  docs will not warn about: `LanguageModelV4Usage` is **nested**
  (`{inputTokens: {total, noCache, …}, outputTokens: {total, text, reasoning}}`, not flat
  numbers) and `LanguageModelV4FinishReason` is an **object**
  (`{unified: 'stop', raw: 'end_turn'}`, not the string `'stop'`). A flat `usage` silently
  yields `undefined` token counts at runtime; a string `finishReason` runs fine but fails
  `tsc`. Both cost a cycle.
- **A spec must not import types from `@ai-sdk/provider`.** It is not a direct dependency,
  so pnpm does not hoist it into `node_modules/@ai-sdk/provider` and `tsc` cannot resolve
  it. The mock's constructor contextually types `doGenerate`, so no import is needed.
- **`ENRICHMENT_MODEL` is the environment variable**, read in `scripts/ingest.mts` (never in
  `src/lib/`), defaulting to the exported `DEFAULT_ENRICHMENT_MODEL = 'claude-haiku-4-5'`.
  `--model` overrides it. Confirmed against `@ai-sdk/anthropic@4.0.58`: `AnthropicModelId`
  is a literal union that ends in `(string & {})`, so an arbitrary env-supplied id compiles.
- **Two behaviours the plan did not anticipate, both added test-first after the real bake
  surfaced them.** A pull request with **zero commits** (`trpc/trpc#7592`) can never produce
  a valid step chain, so it short-circuits to a fallback without a model call rather than
  paying for a guaranteed rejection. And the model **mistypes SHAs in the tail** — `#11861`
  returned a 37-character SHA, `#7375` a 39-character one, each having dropped a character
  mid-copy — so step SHAs resolve on a unique 7-character leading prefix (git's own short
  form) rather than requiring the whole string to prefix-match. A genuinely invented SHA
  still fails, and still rejects the record.
- **A stored *fallback* is not a cache hit.** A degraded record is a failure receipt, so
  `enrichSnapshot` retries it rather than freezing a transient failure into every later
  snapshot. Without this, `--reuse` would make the first failure permanent.
- **`--reuse <snapshot.json>` was added** so a re-bake after a code change costs model calls
  only for what is new or previously failed. This is §3's cache doing its job at bake time;
  it saved roughly $0.40 of the owner's money on this chunk alone.
- **Fallback rate.** 1 of 236 pull requests in the committed snapshots is a fallback, and it
  is the structural zero-commits case, not a model failure. Before the two fixes above the
  rate was 12 of 236; every one of those was the model exceeding a length bound or mistyping
  a SHA on a pull request with a long body (2,000–4,700 characters), never a fabrication.

## project.md deltas

**I did not edit `.claude/resources/project.md`.** For the lead to apply at the wave
boundary:

1. **Commands table** — the ingest row gains the bake flags. Replace its command with:
   `node scripts/ingest.mts --repo <owner/repo> --since <iso> --until <iso> --out <file>` —
   also `--branch`, `--max-pull-requests`, `--record <transcript>`, `--record-sample <n>`,
   `--replay <transcript>`, `--enrich`, `--model <id>`, `--concurrency <n>`,
   `--reuse <snapshot.json>`. Needs `GITHUB_TOKEN` unless `--replay`; `--enrich` additionally
   needs `ANTHROPIC_API_KEY`.
2. **Commands table — add a "Bake a curated snapshot" row**, since it spends money and must
   be run deliberately:
   ```
   node scripts/ingest.mts --repo <owner/repo> \
     --since 2026-06-22T00:00:00Z --until 2026-09-20T00:00:00Z \
     --out src/lib/snapshots/<owner>-<repo>-<since-date>.json --enrich
   ```
   Add `--reuse <the same file>` to retry only failures after a code change.
3. **Layout** — two new directories: `src/lib/ai/` (the enrichment module and its specs) and
   `src/lib/snapshots/` (committed baked snapshots, `<owner>-<repo>-<since-date>.json`).
4. **Conventions — add:** *`enrichmentEntrySchema` strips unknown keys.* Measured on zod
   4.6.5: parsing an entry with an extra field returns it without that field, so a marker
   cannot be a new property on an enrichment record. The fallback marker is the
   `FALLBACK_APPROACH` constant plus the `isFallbackEnrichment` predicate in
   `src/lib/ai/enrichment.ts`.
5. **Conventions — add:** *the `ai` test double is `MockLanguageModelV4` from `ai/test`*,
   and its `doGenerate` result needs the nested V4 `usage` and object-shaped `finishReason`
   described under Deviations. A spec must not import types from `@ai-sdk/provider` — it is
   not a direct dependency and does not resolve.
6. **Conventions — add:** *`.env.example` defeats a naive tracked-env-file gate.*
   `git ls-files | grep -E '(^|/)\.env($|\.)'` matches the committed template; any such gate
   needs `| grep -v '^\.env\.example$'`.
7. **Conventions — add:** *a gate that loops over a `git ls-files` result must assert the
   corpus is non-empty first*, or it passes vacuously on a tree that has none of the files.
   Chunk 03's Gate 2 shipped with this defect and was corrected; see the Gates section.
8. **Stack table** — no version changes. `ai` 7.0.107 and `@ai-sdk/anthropic` 4.0.58 are now
   actually used by `src/lib/ai/enrichment.ts` and `scripts/ingest.mts`, as the table
   predicted.

## Reuse audit

- Cache key derivation — **New: no existing implementation found.** `grep -rn "mergeCommitSha"`
  over `src` and `scripts` found only the schema declaration and chunk 02's assignment in
  `ingest.ts:143`. Now in one place, `enrichmentKey`, for chunk 06 to import.
- Snapshot schema and helpers — **Reuse: importing `enrichmentEntrySchema`, `buildRecord`,
  `snapshotSchema`, `serializeSnapshot` and the record types from `src/lib/snapshot.ts`.**
  No second enrichment schema was declared; `modelEnrichmentSchema` is the narrower
  model-output shape and every result is re-parsed through `enrichmentEntrySchema`.
  `assertSafeKey` is reached through `buildRecord`, which calls it per key.
- CLI argument handling and snapshot writing — **Reuse: extended `scripts/ingest.mts`
  in place**; no second CLI. `parseArgs`, `required`, `writeFileSync(out, serializeSnapshot(…))`
  all unchanged in shape.
- Credential reading — **Consolidation: `tokenFromEnvironment()` → `secretFromEnvironment(name)`.**
  One `.env.local` reader now serves both `GITHUB_TOKEN` and `ANTHROPIC_API_KEY` instead of
  a copy per credential.
- Bounded concurrency — **New: no existing implementation found.**
  `grep -rn "concurrency\|pLimit\|pool("` over `src` and `scripts` returned nothing; chunk
  02 uses unbounded `Promise.all`.
- Truncation helper — **New: no existing implementation found.** `grep -rn "truncate"` hit
  only `github.ts`'s tree-truncation error message and a transcript test name.

## Left alone

- **Chunk 02's unbounded `Promise.all` in `ingest.ts`** over per-pull-request file and commit
  fetches. It worked fine at 100 pull requests, and the bounded-concurrency helper now exists
  next door, but changing ingest is outside this chunk.
- **`shadcn-ui/ui` has three near-duplicate pull requests** (#11925, #11924, #11915, all
  "feat(registry): add community registries") whose enrichment reads almost identically.
  That is the repository's real history, not a pipeline bug.
- **The `approach` notes on dependency-bump and release-bot pull requests read as
  restatements.** Analysed above; not escalating, and not worth special-casing in code.
- **No route handler or in-memory cache** — chunk 06 owns live enrichment. `enrichmentKey`
  is exported for it to import rather than re-derive.
- **`src/lib/view/`, `src/components/`, `src/app/` and `scripts/build-snapshot-index.mts`**
  untouched; they are chunk 04's.

## Expected at the wave boundary, not a bug in this chunk

Chunk 04 added `src/lib/view/catalog.test.ts`, which asserts a generated snapshot index
matches the `src/lib/snapshots/` directory listing. It is not on my base, so I could not run
it. When these three snapshots land alongside it, that test goes red until
`node scripts/build-snapshot-index.mts` (or `pnpm build`, which runs it as `prebuild`) is
re-run. Three filenames will need to appear in the regenerated index:
`shadcn-ui-ui-2026-06-22.json`, `trpc-trpc-2026-06-22.json`, `xyflow-xyflow-2026-06-22.json`.
