---
id: templates/pr-description
description: PR description shapes for chunk PRs and the final plan PR
---

# PR Descriptions

## Chunk PR

```markdown
## Summary

<1–2 sentences: what this chunk does and why.>

Chunk <NN> of `<plan-name>`.

## What changed

- **<Area>**: <what changed and why>
- **<Area>**: <what changed and why>

## Verification

- [x] <gate command> — <result>
- [x] <gate command> — <result>
- [x] <manual check performed, and what was observed>

Baseline captured at `<path>`: <N errors, M warnings> before this chunk.

## Notes for the reviewer

<Judgment calls made and why. Anything deliberately left alone. Anything the plan got
wrong that had to be worked around.>
```

## Final plan PR

```markdown
## Summary

<1–3 sentences: what the plan accomplished end to end.>

## What changed

- **<Category>**: <description>
- **<Category>**: <description>

## Chunks

| # | Chunk | PR |
| - | ----- | -- |

## Out of scope

<What the SPEC's Non-Goals listed, plus anything cut mid-plan and where it was filed.>

## Verification

- [x] Full suite re-run on the merged result — <output>
- [x] Whole-diff review of the assembled branch
- [x] <deferred checks that were run at delivery, and what was observed>
```

Write the description against the SPEC, not the diff. A reviewer needs to know what problem
this solves and how to tell whether it did — the diff already says what changed.
