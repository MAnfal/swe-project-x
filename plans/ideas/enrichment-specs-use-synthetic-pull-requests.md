---
title: Enrichment specs build pull requests by hand instead of using captured output
priority: medium
created: 2026-09-20
origin: plan 2026-09-20-project-grain-prototype, chunk 05, iteration 2 (reported by the implementer, verified by the lead)
---

# `enrichment.test.ts` tests against hand-authored pull requests

## What

`src/lib/ai/enrichment.test.ts` — chunk 03's spec for the enrichment module — constructs its
pull requests from a local factory rather than reading one off a committed snapshot:

```
src/lib/ai/enrichment.test.ts:32
function pullRequest(overrides: Partial<PullRequestRecord> = {}): PullRequestRecord {
  return {
    number: 5989,
    title: 'feat(system): add global site settings',
    ...
```

Verified 2026-09-20 by the lead: the file contains no `loadSnapshot` call and no reference to
`src/lib/snapshots/` or a fixture helper.

## Why that is a problem

Two rules in this project say otherwise, and they agree with each other:

- **`.claude/resources/bibles/swe/testing.md`** — a transform over a producer's output is
  tested against that producer's **real captured output**, not a hand-rolled approximation.
- **`project.md`'s Convention Map**, `src/**/*.test.ts` row — same rule, and it is cited in
  every rubric generated since chunk 02.

A hand-written record contains the fields the author remembered and the shapes the author
expected. The divergence from what the ingester actually writes surfaces later as a bug in the
path nobody tested — which is precisely Design Decision 6's reasoning for why the committed
snapshots are captured output rather than fixtures written to look like it.

This is not hypothetical here: the enrichment module is keyed by merge SHA, and real captured
pull requests include ones with a `null` `mergeCommitSha`, release-bot bodies, and empty
titles. A factory with sensible defaults produces none of those unless someone thinks to ask.

## Why it was not fixed in chunk 05

Out of scope, correctly. Chunk 05 owns `src/lib/view/` and the canvas; it touched
`src/lib/ai/` only to extract six model-free symbols into `enrichment-record.ts` so that
`derive.ts` could import them without pulling the AI SDK onto a component path. Rewriting
chunk 03's specs is a different change with a different blast radius, and the implementer
reported it rather than absorbing it — which is the behaviour the loop asks for.

Note that chunk 05's **new** spec, `src/lib/ai/enrichment-record.test.ts`, does it the right
way: every pull request it uses is read off a committed snapshot through
`src/lib/view/fixture.ts`. So the correct pattern already exists in the same directory, next
to the file that needs it.

## What it would take

- Replace the `pullRequest()` factory with reads from the committed snapshots, via the helpers
  in `src/lib/view/fixture.ts` (`loadSnapshot`, `snapshotWithTitle`,
  `snapshotWithoutMergeCommitSha`) — these already exist and already do this.
- Keep constructed inputs only where a committed snapshot genuinely cannot produce the case,
  and say so at the point of construction. The plan's standing lesson is that a real fixture
  only contains the cases that repository happened to produce, so a mix is right — but the
  default should be captured, with construction as the documented exception.
- Re-run the module's mutants afterwards. The point is to end with specs that are *stronger*,
  not merely differently sourced.

## Related

- `.claude/resources/bibles/swe/testing.md`
- `plans/completed/2026-09-20-project-grain-prototype/ORCHESTRATOR.md` § Design Decisions, item 6
- `src/lib/ai/enrichment-record.test.ts` — the pattern to copy
- `src/lib/view/fixture.ts` — the helpers that make it a small change
