# Resource Placement

Where a new file under `.claude/resources/` belongs, and when an unreferenced prompt, agent, or skill counts as an orphan. Two rules govern this: the **proximity rule** (placement) and the **reachability rule** (orphan detection).

## Proximity rule — where a resource lives

Place a resource by how many things consume it:

| Consumers                                          | Location                                          |
| -------------------------------------------------- | ------------------------------------------------- |
| One                                                | Co-locate with its consumer (same feature folder). |
| Many                                               | Promote to a shared / `common/` location.         |
| Cross-cutting knowledge (why/how a system works)   | A bible under `bibles/`.                           |

Start co-located. Promote to a shared location on the **second** consumer — not in anticipation of one (YAGNI).

Example:

```
# Single consumer — co-locate with the skill that runs it
scripts/framework-maintenance/<guard>.sh   # only the framework-maintenance skill runs this

# Multiple consumers — promote to shared
scripts/common/<helper>.sh                 # several skills call this

# Cross-cutting reasoning — a bible, not next to one consumer
bibles/prompt-engineering/foundation/...    # the "why" behind a subsystem
```

## Reachability rule — what counts as an orphan

A resource is **reachable** if it is either:

1. **Referenced** — something points to it: a frontmatter `references` entry, an `@/` import, a decision-tree row, or an invocable that reads it at runtime; **OR**
2. **A declared entry point** — a user-facing or cron-facing invocable (a command/skill the user runs directly by name).

A resource that is **neither referenced nor an entry point is an orphan** — flag it for removal or wiring.

Entry points are **exempt**. A top-level command or skill has no in-repo referrer by design — the user invokes it. Never flag an entry point as an orphan.

Example:

```
# Orphan — a sub-prompt under resources/prompts/ that no command/skill reads
resources/prompts/<area>/<unreferenced>.md   → flag

# NOT an orphan — user-facing entry point with no in-repo referrer
skills/<user-invoked-skill>/SKILL.md         → exempt
```

The same logic applies to agents: an agent referenced by no command, skill, or prompt — and not a user-facing entry point — is an orphan.

## Type-first convention (current)

Resources are organized **type-first**: `sops/<feature>/`, `scripts/<feature>/`, `prompts/<area>/`. Files are grouped by type first, then feature. **Feature-first reorganization** — gathering all of a feature's files (sops + scripts + prompts) under a single feature folder — is **out of scope**. Follow the existing type-first layout when placing new resources.

## Related

- @/conventions/bible-authoring.md — structural rules for bible docs
- @/foundation/determinism-ladder.md — choosing script vs. skill vs. agent for a resource

## Dynamic catalogs vs. static rosters

Framework tools that enumerate a registry at **runtime** — scanning a folder, reading a config file, or looping over a list that the file system owns — absorb additions, removals, and renames with zero downstream edits. Tools that **hardcode** the list of things they operate on require a code change every time the list changes.

**Design principle**: favor runtime registry scans over hardcoded rosters in framework tooling.

Validated in this repo: the `framework-maintenance` skill enumerates `sops/framework-maintenance/guards/` at runtime — adding or removing a guard requires only adding/deleting a file; the skill never changes. The `show-system-design.md` command scans the registry at runtime — 9 file deletions and 28 reference-fix changes were absorbed automatically with zero edits to the command.

When deciding how a tool should know its subjects: if the subjects have a natural file-system home (a folder, a registry index), scan it at runtime. Only hardcode when the set is truly static and permanently closed — which is rare.

## Authored knowledge vs. operational state

`resources/` holds **authored institutional knowledge** — bibles, SOPs, prompts, templates. Files here are written once (or revised deliberately), read by humans and tools, and intended to persist.

**Mutable data queues** — files that tooling reads *and* deletes in batch — belong **outside `resources/`**, still under `.claude/` (to stay within the framework write-boundary), but in a feature-specific directory:

```
plans/ideas/                                       ← mutable data queue (plans write; brainstorm drains)
.claude/resources/prompts/brainstorm.md            ← authored procedure (reads the queue)
```

| Category | Characteristics | Location |
| -------- | --------------- | -------- |
| Authored knowledge | Written deliberately, read by humans/tools, persists across cycles | `resources/` |
| Operational state / data queue | Written by tooling, drained/deleted in batch, ephemeral within a cycle | `.claude/<feature>/` |

Mixing the two degrades `resources/` from a stable knowledge base into a volatile working directory. Keep them separate.
