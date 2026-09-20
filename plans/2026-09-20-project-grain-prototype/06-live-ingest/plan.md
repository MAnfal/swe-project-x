---
chunk: 06
title: Live analysis — repository URL entry, bounded ingest, on-demand enrichment
branch: feat/project-grain-prototype--live-ingest
base: feat/plan--project-grain-prototype
execution: sequential
depends: [03, 05]
file-limit-waived: true
file-limit-reason: "Four specs, two route handlers, two validated boundary modules, and four UI surfaces. The chunk is one vertical slice; splitting it would ship a route with no way to reach it."
---

# Chunk 06 — Live analysis

## Context

Everything so far runs on snapshots baked ahead of time. This chunk lets someone point the
prototype at a GitHub repository of their own and get the same three levels — which is what
turns a curated demo into something an evaluator can test against their own domain.

It runs the **same ingest core** chunk 02 built and the **same enrichment** chunk 03 built.
No second pipeline, no second schema. The differences are all about running inside a request
rather than on a developer's machine:

- **Ingest is deterministic only.** Enrichment is deferred to expansion, which keeps a live
  analysis to bounded API work and well inside a single serverless invocation. This is not
  an optimization; it is what makes the deployed path viable at all.
- **Everything is bounded before it starts.** A public URL that triggers an unbounded fetch
  spends the owner's GitHub rate limit and model budget.
- **Progress is reported.** Dozens of sequential API calls behind a bare spinner reads as
  broken.
- **Credentials stay on the server.** Both keys are read inside route handlers only.
- **The cache is in-memory and best-effort.** The deployment target has no writable
  filesystem at request time, so a cache lives for the life of the serving instance and no
  longer. Nothing may depend on it surviving.
- **No background jobs, and the copy must not imply otherwise.** Analysis happens inside the
  request that asked for it. If the tab closes, the work is gone; a retry restarts the
  analysis rather than resuming a partially fetched step. Page 3 and page 8 of the designs
  carry copy written before this was settled — build their layout, and write copy that
  matches what the prototype actually does. Do not implement resumable or detached
  analysis.

## Design Input — the designs are delivered; build against them

Mid-fidelity designs for this chunk's screens are committed at
`plans/2026-09-20-project-grain-prototype/design/mid-fi.pdf`. Read
`plans/2026-09-20-project-grain-prototype/design/README.md` first — it indexes the pages and
lists the decisions the designs settled that override what this plan said when it was
written.

This chunk needs pages 1 and 2 (repository field states), 3 (ingest progress), and 8 (error states).

**Open those pages before writing a presentation component.** Where a design contradicts
this plan's description of layout, hierarchy, wording or interaction, **the design wins** —
record the contradiction in the completion report so the plan gets corrected rather than
silently diverging. Do not implement a screen you have not looked at.

## Acceptance Criteria

- Given the landing page, When `Other…` is chosen in the repository dropdown, Then the
  dropdown is replaced in place by a GitHub repository URL input with a back arrow to its
  left; activating the arrow restores the dropdown with its previous selection intact.
- Given a valid repository URL, When analysis runs, Then progress is reported at least once
  per ten pull requests processed, naming what is happening.
- Given analysis completes, When the canvas renders, Then it behaves exactly as it does for
  a baked snapshot, including the slider, the levels, and the badges.
- Given a change node from a live analysis, When it is expanded the first time, Then its
  label, approach note and steps are generated on demand; when it is expanded again in the
  same session, Then no further model call is made.
- Given a repository with more pull requests in the window than the configured maximum, When
  analysis runs, Then it stops at the maximum and says so rather than fetching without
  bound.
- Given an invalid URL, a repository that cannot be read, or an exhausted rate limit, When
  analysis is attempted, Then the failure is reported with what went wrong and the dropdown
  remains usable.
- Given a failed analysis, When a retry is offered, Then the retry restarts the analysis and
  no surface claims that partial progress was kept or that work continues after the tab
  closes.
- Given the built application, When the client bundle is inspected, Then no credential
  appears in it.

## What To Do

### 1. The analysis route

A route handler that takes a repository, runs chunk 02's ingest with explicit bounds, and
streams progress as it goes.

- **Node.js runtime, declared explicitly.** Octokit and the AI SDK do not run on the Edge
  runtime.
- **Declare the function's maximum duration explicitly.** The deployment target's ceiling on
  the free tier is 300 seconds and cannot be raised there
  (https://vercel.com/docs/functions/configuring-functions/duration, read 2026-09-20).
  Bound the work to fit well inside it.
- Validate the submitted URL before using it: owner and repository only, rejected with a
  clear message otherwise. It is user input that becomes an API path.

### 2. Bounds

Read the window and the maximum pull-request count from configuration with documented
defaults — start at the last 90 days and 100 pull requests, and state what you chose. The
bound is applied before fetching begins, not by stopping partway through an unbounded loop.

Surface what the bound did: if the window held more pull requests than the maximum, the
result says so, and the canvas can show it.

### 3. On-demand enrichment

A second route handler that enriches one pull request and returns the record, plus the
client-side wiring that calls it when a change node is first expanded.

- Key the cache by merge commit SHA, reusing chunk 03's key derivation rather than
  re-deriving it.
- In-memory cache with a bounded size. A cache miss is normal and must not surface as an
  error.
- A failed enrichment falls back exactly as chunk 03 does — the pull request's title, marked
  as a fallback. Never a blank node.

### 4. The repository picker

Extend chunk 04's picker rather than replacing it:

- add the `Other…` option to the existing discovered list,
- on selection, swap the dropdown in place for the URL input with the back arrow to its
  left,
- the back arrow restores the dropdown and its previous selection,
- validation errors render against the input without losing what was typed.

### 5. Progress and error surfaces

A progress view driven by the stream, naming the current phase and the counts. An error
surface that states what failed — invalid URL, not found, rate limit exhausted, analysis
failed — and leaves the dropdown usable so the evaluator can fall back to a baked
repository.

### Tasks

- [ ] T001 — write failing spec for repository URL parsing — asserts valid forms are
      accepted and that a non-GitHub URL, a path with extra segments, and a blank value are
      rejected; fails because no parser exists
- [ ] T002 — write failing spec for bounds — asserts ingest stops at the configured maximum
      and reports that it did; fails because no bounded wrapper exists
- [ ] T003 — write failing spec for the enrichment cache — asserts a second request for the
      same merge SHA produces no model call, and that a bounded cache evicts rather than
      growing; fails because no cache exists
- [ ] T004 [P] — create the URL parser and validator
- [ ] T005 [P] — create the in-memory cache, bounded, keyed by merge SHA
- [ ] T006 — create the analysis route handler — Node runtime, explicit max duration,
      bounded ingest, streamed progress
- [ ] T007 — create the enrichment route handler — one pull request, cache-backed
- [ ] T008 — create the client wiring that requests enrichment on first expansion
- [ ] T009 — edit the repository picker — `Other…`, in-place URL input, back arrow
- [ ] T010 [P] — create the progress view
- [ ] T011 [P] — create the error surface
- [ ] T012 — create `completion-report.md` in this chunk directory

Judgment calls to explain in the completion report:

- You may stream progress as server-sent events, as a streamed response body, or by polling
  a job; say which, and how it behaves when the client disconnects.
- You may cache per serving instance or per session; say which, and what a cold instance
  does.
- You may apply the pull-request bound by count, by window, or by both; say which, and what
  the user sees when the bound truncates the result.

Verify the route handler's runtime and duration configuration, the streaming API, and the
AI SDK's server-side call surface against the installed packages and the framework version
in use. Where the measurement contradicts this plan, **the measurement wins**.

## Test Plan

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |
| URL parsing spec (T001) | Accepted forms; rejection of non-GitHub hosts, malformed paths, and blank input | No parser exists |
| Bounds spec (T002) | Ingest stops at the configured maximum and reports the truncation | No bounded wrapper exists |
| Cache spec (T003) | Second request for a merge SHA makes no model call; the cache evicts at its bound | No cache exists |
| Fallback spec | A failing enrichment call returns the pull request title marked as a fallback | No route exists |

No test may call the real GitHub or Anthropic API. Stub at the client boundary and assert on
the records returned, not on whether a mock was called.

## Reuse Audit

This chunk adds no analysis logic. It reuses chunk 02's ingest and schema, chunk 03's
enrichment function and merge-SHA key derivation, chunk 04's repository picker, and chunk
05's node components. Record `Reuse: importing <X> from <Y>` for each, and justify any new
module in the completion report. A second ingest path or a second enrichment prompt in this
chunk is a defect, not a shortcut.

## Reference Files

| File | Why |
| ---- | --- |
| `.claude/resources/project.md` | Stack, gate commands, Principles — no secret reaches the client, no request-time filesystem or git dependency, no model call in the render path |
| `.claude/resources/sops/planning/boundary-validation.md` | The submitted URL is request-derived data that becomes an API path and a cache key: validate at the boundary, reject reserved keys, bound the cache |
| `.claude/resources/bibles/swe/testing.md` | Assert the record a consumer receives, not that a mock was called |
| `plans/2026-09-20-project-grain-prototype/03-ai-enrichment/plan.md` | The enrichment function, its fallback contract, and the merge-SHA key this chunk's cache reuses |

## External Dependencies

- `@octokit/rest` — the same client chunk 02 built, now under a request budget. Authenticated
  REST is limited to 5,000 requests per hour with a 900-points-per-minute secondary limit
  (https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api, read
  2026-09-20); per-PR file and commit calls are the volumetric cost.
- `ai` / `@ai-sdk/anthropic` — on-demand enrichment, one call per pull request per session.
- Deployment platform — function duration ceiling of 300 seconds on the free tier; Node.js
  runtime required for both route handlers.

## Verification Gates

Read `.claude/resources/prompts/gates.md` first. Capture a baseline before running anything
that emits errors, and grade the delta.

```bash
bash -s <<'GATE'
set -euo pipefail

# Gate 1 — standard gates from project.md, type check last.
pnpm lint
pnpm test
pnpm build
pnpm typecheck

# Gate 2 — both route handlers declare the Node.js runtime. Find them by discovery, not by
# a hardcoded path, and require the declaration in each.
routes=$(git ls-files | grep -E 'route\.ts$' || true)
[ -n "$routes" ] || { echo "FAIL: no route handlers found" >&2; exit 1; }
for r in $routes; do
  grep -qE "runtime\s*=\s*['\"]nodejs['\"]" "$r" || {
    echo "FAIL: $r does not declare the nodejs runtime" >&2; exit 1; }
done

# Gate 3 — no credential reaches the client bundle. Assert against the built output, not
# against source, and use the variable names rather than any value.
pnpm build >/dev/null
if grep -rlE 'ANTHROPIC_API_KEY|GITHUB_TOKEN' .next/static 2>/dev/null; then
  echo "FAIL: a credential name appears in the client bundle" >&2; exit 1
fi

# Gate 4 — ingest is bounded. Assert the maximum is applied before fetching, by running the
# bounds spec and requiring it to have executed.
out=$(pnpm test 2>&1); echo "$out"
echo "$out" | grep -Eq '[1-9][0-9]* (passed|passing)' || {
  echo "FAIL: test runner reported no executed tests" >&2; exit 1; }
GATE
```

Adjust gate 3's build-output path to whatever the framework version actually emits — confirm
the directory exists before relying on it, or the gate passes by searching nothing.

**Prove each gate can fail.** Run every gate against the base commit and record the exact
command, exit status, and failure evidence — no route handlers exist on base, so gate 2
fails on its first assertion. Run the negative control per assertion: remove the runtime
declaration from one route and confirm gate 2 fires; restore it from a copied backup — not
with `git checkout --` — and confirm the gate returns clean. For gate 3, confirm the search
path is non-empty before trusting a clean result.

## Deliverables

- [ ] `completion-report.md` in this directory, **committed**, written from
      `.claude/resources/templates/completion-report.md`
- [ ] An analysis route: Node runtime, explicit duration, bounded ingest, streamed progress
- [ ] An enrichment route backed by a bounded in-memory cache keyed by merge SHA
- [ ] `Other…` → URL input with a back arrow, restoring the dropdown
- [ ] Progress and error surfaces
- [ ] A README section on running locally and deploying, naming both environment variables
- [ ] "project.md deltas" section in the completion report, for the lead to apply at the
      wave boundary

## Artifacts Checklist

- ☐ New tests for new behavior
- ☐ Existing tests updated — the repository picker gains a mode
- ☐ Docs / conventions updated for changed behavior
- — Generated code re-run (no codegen)
- ☐ `.claude/resources/project.md` — report deltas; do not edit the file in this chunk
