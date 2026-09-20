---
title: Bound the live routes — rate limiting, GitHub concurrency, and a specced "ask once" guard
priority: high
created: 2026-09-20
source: chunk 06 completion report (flagged, not fixed) + review iteration 2 warning
---

# Bound the live routes before any public deploy

Chunk 06 shipped `/api/analysis` and `/api/enrichment`. All three items below were
**reported rather than fixed**, correctly — they are either pre-existing or outside the
chunk's rubric. Together they are what stands between the prototype and a public URL.

## 1. Neither route is rate-limited

Anyone who can reach the deployment can start an analysis that spends the owner's GitHub
quota, or an enrichment that spends Anthropic credit. Flagged by chunk 06's implementer.
Nothing in the chunk's acceptance criteria required it, so it was left alone.

## 2. GitHub fan-out sits exactly on the documented concurrency limit

`src/lib/ingest/ingest.ts` maps `Promise.all` over every pull request in the bound. Files
and commits are awaited **sequentially within** each pull request's chain, so at the
default ceiling of 100 it is ~100 concurrent chains issuing 200 requests in total — not
200 concurrent, as the chunk's first report said before correction. GitHub documents *"No
more than 100 concurrent requests are allowed"*, so the default sits on the limit with no
margin, and the route accepts a ceiling up to `MAX_PULL_REQUESTS = 500`.

Pre-existing: introduced by chunk 02 (`549d507`) and untouched by chunk 06 — verified by
the lead against the chunk's diff. What changed is the exposure: in chunk 02 it was a CLI a
developer ran deliberately; it is now reachable from an unauthenticated web request.

Fix shape: a small concurrency pool rather than a bare `Promise.all`.

## 3. The "ask once" guard is not machine-checked

`askedRef` in `src/components/canvas/grain-workspace.tsx:207` prevents a second enrichment
request for a key already asked in this session. Review iteration 2 mutated it away and
**no test failed**, because `project.md` deliberately excludes `pnpm test` from the
component gate and no chunk in this plan has component specs.

The lead traced the blast radius before accepting it as non-blocking, and it is narrower
than "model spend is unguarded": line 208's `hasOwnProperty` check on the merged
`enrichment` record independently blocks a re-expand **after a success**, and the server's
per-instance cache blocks the model call even if a request is made. What `askedRef`
uniquely covers is the **in-flight window** — expanding the same change twice before the
first response lands — and the case where the serving instance recycles mid-session, where
the server cache is empty and only the client guard prevents a second model call.

Fix shape, per the reviewer's suggestion: extract the "should I ask for this key?"
predicate into `src/lib/`, where the Convention Map's co-located-spec rule already applies,
and spec it there. This is preferable to introducing component-test infrastructure for one
guard.

## Why one idea rather than three

All three are the same concern at three layers — nothing bounds what a single anonymous
request can spend. They share a reviewer and probably a chunk.
