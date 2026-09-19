---
id: sops/planning/dynamic-discovery
description: Specify how to find affected files rather than enumerating them
---

# SOP: Prefer Dynamic Discovery Over Hardcoded File Lists

**When**: a chunk plan names the files that should be modified.

## Procedure

Say **how to find** the affected files, not which ones they are. Files get added, moved,
and deleted between planning and execution; a hardcoded list goes stale silently while a
discovery command self-heals because it scans current state.

- **Dynamic** (preferred): "Run `grep -rn 'OLD_CONSTANT' --include='*.ts' src/` and update
  every match."
- **Static** (only for stable locations): "Update `.claude/resources/prompts/gates.md`."

Hardcode a path only where the path *is* the interface — framework files, contracts,
templates. For application code, registry entries, and consumers of a moved export, use
discovery.

## Corollary: count assertions in gates

The same rule applies to counts. A gate asserting `expect 16 items` embeds a planning-time
assumption that rots as the codebase moves.

```bash
# WRONG — carried from the plan
EXPECTED=16

# CORRECT — derived from live state
EXPECTED=$(grep -rl 'SomeSymbol' src/ | wc -l)
```

If the count is an invariant the chunk is enforcing, derive a baseline from the current
tree and assert the **delta** — never an absolute number from planning time.

## Origin

Multiple plans carried stale file lists because files were renamed between planning and
execution.
