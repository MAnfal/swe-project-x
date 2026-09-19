---
id: prompts/git
description: Branch, commit, and PR conventions for every workflow in this project
---

# Git Practices

If the project is not a git repository yet, initialize one before the first chunk —
the loop's review surface is the diff.

## Branch naming

| Prefix | When |
| --- | --- |
| `feat/` | New feature or capability |
| `fix/` | Bug fix |
| `chore/` | Maintenance, tooling, config, cleanup |
| `refactor/` | Restructuring without behavior change |
| `docs/` | Documentation only |
| `perf/` | Performance work |

- **Plan branch**: `<type>/plan--<plan-name>` — holds the plan artifacts and receives
  every chunk.
- **Chunk branch**: `<type>/<plan-name>--<chunk-name>` — always cut from the current tip of
  the plan branch, in its own worktree. See `prompts/worktree.md`.
- **Lite work**: `<type>/<slug>`, branched from the source branch.

## Starting a branch

1. **Dirty-tree check.** If `git status --porcelain` is non-empty, stop and ask whether to
   commit, stash, or discard before branching.
2. **Confirm the source branch, don't assume it.** On `main`, proceed. On anything else,
   ask: "You're on `<branch>`. Branch off this, or off `main`?" The confirmed branch is
   what the eventual PR targets — record it.
3. Pull it current, then `git checkout -b <type>/<slug>`.

## Commit granularity

One logical concern per commit. A branch may hold several; each should be independently
understandable.

Separate commits: a new module, an infrastructure fix, a refactor of an existing system,
a migration of a consumer, a shared utility extraction.

One commit is fine for: a cohesive change plus the type and contract updates it requires,
and the tests that cover it.

Sequence within a branch: dependencies first, infrastructure before consumers, new code
before migrating the old thing to it.

## Merge, don't rebase

Rebasing a branch that has an open or merged PR orphans the commit hashes the PR
references and forces a push. Rebase only before a PR exists.

**`git checkout --theirs/--ours` applies to the whole file**, not just the conflicting
hunks. Safe for regenerable artifacts like lockfiles; on a source file it silently deletes
your side's edits outside the conflict markers. After using it, grep for a symbol only
your side added — zero matches means your edits are gone. Restore with
`git checkout HEAD -- <path>` and resolve hunk by hunk instead.

## Pull requests

Write the description from `.claude/resources/templates/pr-description.md`.

- Never push directly to `main`. Everything lands via branch and PR.
- **Never merge a PR yourself.** The user merges on GitHub. The PR is the review surface.
- **Every** chunk PR targets the plan branch. The final plan PR targets the source branch.
  There is no stacking: a sequential chunk is one whose branch is cut *later*, from a plan
  branch that already contains its prerequisite. Its diff is still only its own work, and
  nothing has to be re-targeted when a sibling merges. See `prompts/worktree.md`.

### Before the final plan PR

Merge the source branch into the plan branch so the diff reflects what will actually land,
resolve any conflicts, then **re-run the full test suite on the merged result** — even
though every chunk passed its own gates. This catches two things no chunk-level gate can:
regressions from the merge itself, and commits pushed directly to a chunk PR after its
review closed.

Any review-response commit pushed straight to a PR (bypassing the implement/review loop)
gets the same full re-run before merge, not just a green CI check.

### Reviewing the assembled diff

Per-chunk review cannot see properties of a file that no single chunk owned end to end,
and a perfect chunk-review record is not evidence that the assembly is correct. Run one
whole-diff review of the plan branch before opening the final PR — contradictions between
a file and the documentation written for it in a *different* chunk only show up here.

## Two-dot vs three-dot diffs

GitHub's PR view uses three-dot (against the merge base) and shows only the chunk's
changes. A local `git diff <plan-branch>..<chunk-branch>` is two-dot, tip to tip — so
commits added to the plan branch *after* the chunk branched appear as "reverted".

If a local diff shows plan bookkeeping files as reverted, merge the plan branch into the
chunk branch before auditing. Do this as a standing step before committing a chunk
whenever the plan branch has received bookkeeping commits; skipping it makes the chunk's
merge revert them.
