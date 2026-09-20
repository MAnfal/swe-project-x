---
chunk: 03
title: Enrichment — per-PR label, approach note and step chain, plus baked snapshots
branch: feat/project-grain-prototype--ai-enrichment
base: feat/plan--project-grain-prototype
execution: parallel
depends: [02]
file-limit-waived: false
file-limit-reason: ""
---

# Chunk 03 — Enrichment

## Context

Chunk 02 produces everything about a change that a script can know: which pull request,
which files, which packages, in what order. What it cannot produce is the part a codeowner
actually reads — what the change *was*, and *how it was built*. A file list of
`migrations/0042_add_site_settings.sql` is not "Added a DB column", and no heuristic turns
one into the other in the general case.

This chunk adds one model call per pull request that returns three things:

- **`label`** — what the change was, in the owner's language ("Added global site settings").
- **`steps`** — the ordered chain that produced it ("Added a DB column" → "Added a resolver
  record" → "Changed render config to accept settings").
- **`approach`** — one line on *how* it was done, naming the path taken and, where visible,
  the path not taken ("wired site settings directly into render config rather than through
  the existing settings resolver").

`approach` is the field that answers the question the whole prototype exists for. The other
two make the canvas navigable; this one makes it worth navigating. It is also the substrate
a later "golden rules" feature would filter on, which is why it is captured now even though
that feature is out of scope.

**Amended 2026-09-20 at the wave-3 preflight — read this before task T001.** Chunk 02
merged, and its schema already declares the shape this chunk writes. Three consequences,
all measured against `src/lib/snapshot.ts` on the plan-branch tip:

- **Do not declare a second enrichment schema.** `enrichmentEntrySchema` and
  `enrichmentSchema` are exported from `src/lib/snapshot.ts`, and `snapshotSchema.enrichment`
  is `z.record(z.string().min(1), enrichmentEntrySchema).optional()`. Principle 5 is "one
  snapshot schema" — import these. A model-output schema for `generateObject` may be a
  narrower thing you derive from them, but the value written into a snapshot validates
  against the merged one.
- **`steps` is not a list of phrases.** The merged schema is
  `z.array(z.object({ commitSha: z.string().min(1), summary: z.string().min(1) })).min(1)` —
  each step carries the commit it came from. This plan's prose above describes bare phrases
  and is wrong; **the merged schema wins**, and your model output must supply a `commitSha`
  per step drawn from the pull request's own commits. `min(1)` also means the fallback path
  cannot write an empty step array — decide what a degraded record's single step is, and say
  so in the completion report. There is no maximum on `steps` in the merged schema, so if you
  want the bound task T001 asks for, it belongs on your model-output schema, not on a second
  copy of the snapshot's.
- **Keys go through `assertSafeKey`/`buildRecord`, not the schema.** Both are exported from
  `src/lib/snapshot.ts`. `project.md` records the measurement: `z.record` accepts
  `{"__proto__": …}` and silently drops the key rather than rejecting it, and it names
  `enrichment` as the case this applies to. Note also that `pullRequestSchema.mergeCommitSha`
  is **nullable** — decide the key for a pull request GitHub reported no merge SHA for, and
  make Gate 2's accessor match whatever you choose.

**The committed snapshot directory is `src/lib/snapshots/`**, files named
`<owner>-<repo>-<since-date>.json`. Chunk 04 runs in parallel and commits one un-enriched
snapshot there, `xyflow-xyflow-2026-08-31.json`, replayed from chunk 02's transcript. It will
not be on your base. **Do not create, edit or delete that path** — bake your three curated
repositories under your own windows, and if your `xyflow/xyflow` window would collide with
that filename, pick a different window. Two chunks in one parallel wave editing one file is
the merge conflict this avoids.

**The model never sits between a click and a frame.** Enrichment is keyed by merge commit
SHA — a pull request's label does not change when the time slider moves — so it is computed
once and reused forever. This chunk bakes it into committed snapshots for the curated
repositories; chunk 06 generates it on demand for live ones.

## Acceptance Criteria

- Given a pull request record from a snapshot, When enrichment runs, Then it returns a
  label, an approach note, and at least one ordered step, all validated against a schema.
- Given a pull request that has already been enriched in this snapshot, When enrichment is
  asked for it again, Then no model call is made and the stored result is returned.
- Given a model call that fails, times out, or returns output the schema rejects, When
  enrichment runs, Then the pull request still gets a label — the pull request's own title —
  and the failure is surfaced in the run's output rather than swallowed.
- Given the bake command and a curated repository, When it runs, Then a snapshot containing
  both deterministic data and enrichment is written to the committed snapshot directory.
- Given a committed snapshot, When it is validated against the schema from chunk 02, Then
  it passes with `enrichment` populated for every pull request it contains.
- Given the enrichment code, When it is read, Then no credential is referenced outside a
  server-only module.

## What To Do

### 1. The enrichment schema and call

One function taking a single pull request's record — title, body, ordered commit messages,
changed file paths, and the packages it reached — and returning the three fields above,
through `generateObject` with a Zod schema. Use Zod's per-field descriptions to say what
each field means; that description is the model's instruction, and it is cheaper and more
reliable than restating the same thing in prose.

Constrain the output so it stays renderable: `label` is a short phrase, `approach` is one
sentence, `steps` is a bounded ordered list of short phrases. Enforce the bounds in the
schema, not in a prompt sentence that asks nicely.

**Model**: `claude-opus-5` through `@ai-sdk/anthropic`. Read the model id from an
environment variable with that as the default, so it can be changed without a code change.

Do not send whole diffs. Commit messages, file paths and the PR body are enough for the
label and the steps, and they are what keeps one call per pull request affordable. If the
implementation finds patches are genuinely required for a usable `approach` note, say so in
the completion report rather than silently expanding the payload.

### 2. Failure is a degraded result, never a blank node

A model call that fails must not take the change node with it. Fall back to the pull
request's own title as the label, an empty step chain, and an explicit marker that
enrichment did not succeed for that pull request. Count and report the failures at the end
of a bake run. A canvas node that renders blank because a call failed is the failure mode
this rule exists to prevent.

### 3. Caching by merge SHA

Enrichment is a pure function of the pull request, so the merge commit SHA is the cache key.
Within a snapshot, a pull request already carrying enrichment is skipped. Chunk 06 reuses
this same keying for its in-memory cache, so keep the key derivation in one place rather
than re-deriving it there.

### 4. The bake command

Extend the CLI from chunk 02 — do not write a second one. It should:

- run the deterministic ingest for a repository and window,
- enrich every pull request in the result,
- write the snapshot into the committed snapshot directory, named for the repository,
- print how many pull requests were enriched, how many were reused, and how many failed.

Bake all three curated repositories, verified on 2026-09-20 as TypeScript monorepos with a
`packages/` directory:

| Repository | Why it is here |
| ---------- | -------------- |
| `xyflow/xyflow` | `packages/system` is a shared engine consumed by `packages/react` and `packages/svelte` — the exact "my package was changed by someone else's feature" shape the prototype is about |
| `shadcn-ui/ui` | Mid-size, actively developed, written PR descriptions |
| `trpc/trpc` | Eight packages with real cross-package dependencies |

Choose a window per repository that contains enough merged pull requests to be worth
scrubbing and few enough to bake affordably. State the windows and the resulting sizes in
the completion report.

The committed snapshots are **captured output of this pipeline**, never hand-edited
afterwards. If a snapshot needs to change, re-bake it.

### 5. Secrets

`ANTHROPIC_API_KEY` is read in server-only code. No `NEXT_PUBLIC_` variable carries it, no
key is written into a snapshot, and no snapshot carries a token in a URL.

### Tasks

- [ ] T001 — write failing spec for the enrichment schema — asserts a response missing
      `approach`, or with an over-long step list, is rejected; fails because no schema
      module exists
- [ ] T002 — write failing spec for the fallback path — asserts that a model that throws
      still yields a record whose label is the pull request title and whose failure is
      reported; fails because no enrichment module exists
- [ ] T003 — write failing spec for cache reuse — asserts an already-enriched pull request
      produces no model call; fails because no enrichment module exists
- [ ] T004 [P] — create the enrichment module — Zod output schema, `generateObject` call,
      model id from environment with `claude-opus-5` as default
- [ ] T005 — create the fallback and failure-reporting path
- [ ] T006 — edit the ingest CLI from chunk 02 — add the enrichment step and the bake output
- [ ] T007 — run the bake for the three curated repositories and commit the snapshots
- [ ] T008 — create `completion-report.md` in this chunk directory

Judgment calls to explain in the completion report:

- You may enrich pull requests one at a time or in bounded concurrency; say which, and what
  bound you used.
- You may put the fallback marker on the enrichment record or alongside it; say which, and
  how a renderer distinguishes a real label from a fallback one.
- You may include the PR body verbatim or truncated in the model input; say which, and what
  you did about very large bodies.

Verify the `generateObject` signature, the Zod-schema binding, and the provider's model-id
argument against the installed `ai` and `@ai-sdk/anthropic` packages before relying on them.
Where the measurement contradicts this plan, **the measurement wins**.

## Test Plan

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |
| Schema spec (T001) | Required fields and the bounds on `label`, `approach` and `steps` | No schema module exists |
| Fallback spec (T002) | A failing or schema-violating model response still yields a labelled record, and the failure is reported rather than swallowed | No enrichment module exists |
| Cache spec (T003) | An already-enriched pull request produces no model call | No enrichment module exists |
| Snapshot validation spec | Every committed snapshot validates against the chunk 02 schema with `enrichment` populated | No snapshots are committed yet |

Tests must not call the real API. Use the `ai` package's own test double for the language
model — check what the installed version exports for testing before writing the spec, and
record what you found. Asserting that a mock was called proves the call was made, not that
the system behaves correctly; assert on the returned record.

## Reuse Audit

Search before writing: the cache key derivation, the snapshot read/write helpers, and the
CLI argument handling all exist from chunk 02. Record one of
`Reuse: importing <X> from <Y>` / `Consolidation: …` / `New: no existing implementation
found` for each. The expected outcome is reuse of chunk 02's schema module and CLI, and new
code only for the model call itself.

## Reference Files

| File | Why |
| ---- | --- |
| `.claude/resources/project.md` | Stack, gate commands, Principles — including "no model call in the render path" and "no secret reaches the client" |
| `.claude/resources/bibles/swe/testing.md` | Assert the value a consumer receives, not the input handed to a mock; committed snapshots are captured pipeline output, not hand-authored fixtures |
| `plans/2026-09-20-project-grain-prototype/02-ingest-core/plan.md` | The snapshot schema this chunk writes into, and the CLI it extends |
| `src/lib/snapshot.ts` | The merged schema itself — `enrichmentEntrySchema`, `enrichmentSchema`, `assertSafeKey`, `buildRecord`. Import these; do not re-declare them |
| `scripts/ingest.mts` | The CLI this chunk extends rather than replaces |

## External Dependencies

- `ai` — `generateObject` with a Zod schema for typed, validated model output.
- `@ai-sdk/anthropic` — the provider. Model `claude-opus-5`, overridable by environment.
- Anthropic API — one call per pull request at bake time. `claude-opus-5` is $5/MTok input
  and $25/MTok output; keep the per-call payload to commit messages, file paths and the PR
  body rather than full patches, and report the total pull-request count baked.

## Verification Gates

Read `.claude/resources/prompts/gates.md` first.

```bash
bash -s <<'GATE'
set -euo pipefail

# Gate 1 — standard gates from project.md, type check last.
pnpm lint
pnpm test
pnpm build
pnpm typecheck

# Gate 2 — every committed snapshot carries enrichment for every pull request, and every
# enrichment carries the approach note. Derive the counts from the file; never assert a
# number carried from planning time.
for snap in $(git ls-files | grep -E 'snapshots?/.*\.json$'); do
  node -e '
    const s = require("fs").readFileSync(process.argv[1], "utf8");
    const snap = JSON.parse(s);
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

# Gate 3 — no credential is referenced outside server-only code, and none is committed.
if grep -rnE 'NEXT_PUBLIC_[A-Z_]*(KEY|TOKEN|SECRET)' --include='*.ts' --include='*.tsx' . \
     | grep -vE '^\s*(//|\*)'; then
  echo "FAIL: a credential is exposed through a public env var" >&2; exit 1
fi
if git ls-files | grep -qE '(^|/)\.env($|\.)'; then
  echo "FAIL: an env file is tracked" >&2; exit 1
fi
GATE
```

Gate 2's `node -e` block reads the field names this chunk actually chose — adjust the
accessors to match the schema, and keep the derivation from live file contents rather than
hardcoding an expected count.

**Prove each gate can fail.** Run every gate against the base commit and record the exact
command, exit status, and failure evidence — no snapshots committed for gate 2, no
enrichment module for gate 1. Run the negative control per assertion: for gate 2, blank one
`approach` field in a copy of a snapshot and confirm the gate fires, then restore the file
by copying the backup back — not with `git checkout --` — and confirm the gate returns
clean.

## Deliverables

- [ ] `completion-report.md` in this directory, **committed**, written from
      `.claude/resources/templates/completion-report.md`
- [ ] An enrichment function returning label, approach and ordered steps, schema-validated
- [ ] A fallback path that degrades to the pull-request title and reports the failure
- [ ] Merge-SHA keying shared with chunk 06's cache
- [ ] A bake command extending chunk 02's CLI
- [ ] Committed snapshots for `xyflow/xyflow`, `shadcn-ui/ui` and `trpc/trpc`
- [ ] "project.md deltas" section in the completion report, for the lead to apply at the
      wave boundary

## Artifacts Checklist

- ☐ New tests for new behavior
- ☐ Existing tests updated — the chunk 02 CLI gains a step
- ☐ Docs / conventions updated for changed behavior
- — Generated code re-run (no codegen)
- ☐ `.claude/resources/project.md` — report deltas; do not edit the file in this chunk
