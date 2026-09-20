---
id: prompts/worktree
description: Creating, bootstrapping, using and removing chunk worktrees with plain git — no stacking, no external tooling
references:
  - prompts/git.md
  - prompts/evidence.md
---

# Worktrees

Every chunk is implemented in its own git worktree, so two subagents can never edit the
same checkout and your main checkout stays free while a chunk runs.

Plain `git worktree` does all of this. There is no branch-stacking tool and nothing to
install.

## No stacking — every chunk branches from the plan branch

This is the rule that keeps the rest simple:

- **Every** chunk branch is cut from the **plan branch**, and **every** chunk PR targets
  the **plan branch**. There are no stacked PRs and no chunk targeting another chunk.
- A **sequential** chunk is one that is cut *later* — after its prerequisite has merged
  into the plan branch. It inherits the earlier work by being newer, not by stacking on it.
- A **parallel** chunk is cut at the same time as its wave siblings.

So "sequential" is a statement about **when the branch is created**, not about what it
targets. Each PR's diff contains only that chunk's work either way, because the plan branch
already carries everything merged before it.

What this buys: nothing to re-stack when a chunk merges, no PR to re-target, no lineage to
register, and no tool to keep in sync. The loop already waits for you to merge each chunk
before the next one starts, so the ordering that stacking bought is already there.

## Creating one

The lead creates the worktree — not the Agent tool's isolation flag — because the base
branch and the bootstrap both have to be right *before* the implementer starts.

**Commit and push your plan amendments first.** `git worktree add` materializes the
branch's **commit**, not your working tree — an uncommitted preflight fix is invisible to
the implementer, and `git fetch` does not help, because the edits never left your
checkout. Confirm with `git status --short` before running the command below. Preflight's
whole job is producing plan amendments and worktree creation is the next step, so the
moment you are most likely to hold uncommitted plan edits is the moment before the one
command that cannot see them.

```bash
git status --short          # must be clean of plan edits
git fetch origin "$PLAN_BRANCH"
git worktree add ".worktrees/<chunk-name>" -b "<type>/<plan-name>--<chunk-name>" "$PLAN_BRANCH"
```

Add `.worktrees/` to `.gitignore` once, at the start of the first plan.

Cut it from the **current tip** of the plan branch. For a sequential chunk that means
fetching after the prerequisite merged — a worktree created from a stale tip is how an
implementer ends up re-doing work that already landed.

## Bootstrapping one

**A fresh worktree has no dependencies.** No `node_modules`, no virtualenv, no generated
files, no `.env`. The implementer's first gate run fails for reasons that have nothing to
do with its work, and it will spend a cycle debugging your setup instead of writing code.

Run the **Bootstrap** command from `.claude/resources/project.md` in the new worktree before
dispatching anyone. Depending on the project that is an install, a symlink of the dependency
directory from the main checkout, a codegen step, or some combination.

Two cases that bite:

- **Untracked-but-required files.** `.env` and similar are gitignored, so a new worktree
  doesn't have them. Symlink or copy them in.
- **Generated code from an earlier chunk.** When this chunk is the first consumer of
  something an earlier chunk added — a new schema, a new API — regenerate it here. A plain
  dependency install hands the implementer stale generated types and the first type-check
  fails.

## Dispatching into one

Give the subagent the **absolute path** and tell it to work there. Include this check in
the brief:

```bash
cd "<absolute worktree path>"
pwd -P   # must print the worktree path
git rev-parse --abbrev-ref HEAD   # must print the chunk branch
```

`pwd` and `$PWD` report the shell's *logical* path, which can stay correct while the actual
directory has moved. Only `pwd -P` resolves the real one. Re-run both after anything that
rewrites the tree — an install, a generator — and before believing any surprising git
result.

## The lead's rule: always `-C`

Once a subagent is dispatched, **your** working directory is the main checkout, not the
worktree. Every command you run against the chunk takes an explicit path:

```bash
git -C "$WT" status
git -C "$WT" diff "$PLAN_BRANCH"...HEAD
```

and every file you read or write inside it uses the full `$WT/...` path.

This matters more than it looks. A relative path run from the wrong tree still resolves —
type checks, linters, greps and deletions all succeed **vacuously** against the main
checkout, so a drifted run produces a report that is partially true. Only a commit fails
loudly. See `prompts/evidence.md` → surprising git results are a location question first.

## Reading the work

At fan-in you audit the chunk from the lead's side:

```bash
git -C "$WT" diff "$PLAN_BRANCH"...HEAD    # three-dot: only this chunk's changes
git -C "$WT" status                        # nothing uncommitted left behind
```

Use three dots. A two-dot `diff` compares tips, so any commit the plan branch received after
this chunk branched shows up as "reverted" — see `prompts/git.md`.

## Removing one

**After the chunk's PR is merged**, never before:

```bash
git worktree remove ".worktrees/<chunk-name>"
git worktree prune
```

A worktree holding uncommitted changes refuses to be removed, which is the correct
behaviour — look at what's in it rather than forcing it. `git worktree list` at a wave
boundary shows anything left behind from a chunk that already merged.

## When to skip all of this

A single-chunk plan, or a chunk you're implementing inline rather than dispatching, does
not need a worktree. Branch in the main checkout and work there. The worktree exists to keep
concurrent agents apart; with no concurrency it is overhead.
