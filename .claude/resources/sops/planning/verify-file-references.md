---
id: sops/planning/verify-file-references
description: Confirm every path a plan claims exists actually exists, before the plan ships
---

# SOP: Verify File References in Chunk Plans

**When**: a chunk plan says "replaces", "modifies the existing", "updates the stub at",
"delete", "its existing test passes", "reuse the fixtures from" — any wording asserting
something already exists at a path.

## Why

Plan wording goes stale between the reconnaissance during brainstorming and the reality at
execution. The fix is a one-line `test -f`; the cost of skipping it is an implementer
discovering it mid-chunk and either creating something the plan said to modify, or
fabricating data to satisfy a claim.

## Procedure

For every such claim:

1. Run `test -e <path>` against the branch the chunk will actually branch from — not a
   stale checkout from the brainstorming session.
2. **Exists** → the wording stands.
3. **Missing** → change it to "creates a new file at", and update the chunk's approach and
   gates to match.
4. Re-verify when the chunk plan is finalized, not only when it was first drafted.

```bash
for path in <every path the plan asserts>; do
  test -e "$path" && echo "EXISTS:  $path" || echo "MISSING: $path"
done
```

## Ground a blocking premise before scoping around it

When a chunk's entire justification is "unblocks X" or "fixes the error blocking Y",
reproduce the condition before building anything. The blocking assumption may already be
false, and a chunk built around a disproven premise is a wasted slot.

1. Name the blocking condition.
2. Reproduce it live — call the endpoint, read the resolver, run the failing path.
3. Gone? Fold the chunk's scope into inline work or dismiss it before dispatch.

## Probe the shape of an external claim before dependent chunks are authored

When later chunks depend on an external token, response, or record carrying a particular
field, confirm the field exists and means what the plan assumes — before authoring them.
Discovering it false mid-execution stalls every dependent chunk and can invalidate
acceptance criteria.

## Verify reach, not just legality

When the mechanism is "X is expressible" or "write X at derived address Y", verify against
the **hardest real case in the codebase**, not a synthetic minimal one. Two distinct
failures: something parses on a minimal case but not on any production shape; or it is
legal everywhere but can only address a fraction of the cases in scope. Count how many real
instances the mechanism reaches, and report the gap before authoring the chunk.

## Origin

Repeated retros where plan wording drifted from the codebase between brainstorming and
execution — a stub that didn't exist, a directory that had been renamed, a fixture path
that had moved out of the package entirely.
