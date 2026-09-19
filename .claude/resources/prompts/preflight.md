---
id: prompts/preflight
description: Integrity check run before each wave — every reference in a chunk must resolve before anyone is dispatched
requires:
  - A plan directory with chunk files
produces:
  - A pass, or a halt with the list of unresolved references
---

# Preflight

Run before dispatching each wave, not just the first. A plan is written against the
codebase as it was; the codebase moves. An implementer discovering a missing file costs a
full cycle — this check costs a minute.

## 1. Base freshness

The plan branch must be current with the source branch before any chunk dispatches. A
stale plan branch silently corrupts chunk gates: the implementer surfaces failures that
look pre-existing but are actually changes the plan branch never absorbed.

```bash
git fetch origin "$SOURCE_BRANCH"
BEHIND=$(git log --oneline "$PLAN_BRANCH..origin/$SOURCE_BRANCH" | wc -l | tr -d ' ')
[ "$BEHIND" = "0" ] || echo "STALE: plan branch is $BEHIND commit(s) behind — merge before dispatching"
```

**Re-run this at every wave boundary and again before the final PR.** Drift compounds
silently across a multi-day plan: a dependency bump absorbed after a wave merged can break
shipped work at runtime while every chunk gate was green.

## 2. References resolve

Every path in the chunk's Reference Files and What To Do sections must exist on the current
branch:

```bash
test -f "<path>" && echo "OK: <path>" || echo "MISSING: <path>"
```

Also confirm every skill, template, and agent the chunk names actually exists.

## 3. Cross-chunk references

When a chunk cites something "from chunk N", verify it exists **on the base branch**, not
in the working tree — a local `test -f` gives false positives the moment the implementer
starts creating files.

```bash
git cat-file -e "$BASE_BRANCH:$PATH_CITED" 2>/dev/null \
  && echo "OK: present on $BASE_BRANCH" \
  || echo "DRIFT: $PATH_CITED missing — attributed to a chunk that didn't create it"
```

Plan authors routinely assume a sibling chunk produced an output its actual scope didn't
include. When this fires, either widen the earlier chunk or tell this chunk's implementer
to create it inline — before they hit it mid-implementation.

## 4. The gates are runnable

Dry-run each of the chunk's verification gate commands. A gate that references a script,
package, or path that doesn't exist fails at the worst possible moment. Confirm the
commands in `.claude/resources/project.md` still match reality — they drift as the project
grows.

## 5. Documentation impact

If the chunk adds, moves, renames, or deletes anything, the docs that describe it change in
the **same chunk** — never in a follow-up. Two passes, because staleness comes in two forms:

- **Literal**: grep `.claude/` and any project docs for every path, symbol, type, and
  package name the chunk touches.
- **Semantic**: read the docs covering the area and ask whether they still describe how
  things work. Prose like "the module keeps its own copy of the contract" survives a grep
  for the deleted file's name and is wrong all the same.

If either pass finds something, add the doc update to the chunk plan before dispatching.
Don't annotate an invalidated section — rewrite it. No tombstones, no "moved to X" notes.

## 6. No plan artifacts in shipped code

Scan the chunk plan for its own bookkeeping leaking into instructions or code samples —
"chunk 03", PR numbers, plan directory names. An implementer copies a code template
verbatim, and the reviewer then blocks on it.

```bash
grep -nE "[Cc]hunk [0-9]|PR #?[0-9]" <chunk-plan>.md
```

Strip any hits from code samples before dispatch. The plan's organization never ships.

## On failure

Halt. Report exactly which references failed. Fix the plan — or the tree — before spawning
anyone. Log a `preflight_failed` row in the ORCHESTRATOR with what was missing.
