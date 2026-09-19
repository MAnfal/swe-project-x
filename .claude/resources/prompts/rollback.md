---
id: prompts/rollback
description: What to do when a merged chunk introduces a regression
---

# Rollback

For a merged chunk that broke something — failing tests, a runtime error, or a prior
chunk's acceptance criteria no longer holding.

## 1. Confirm it's real, and that it's this chunk

1. Identify the failing behavior concretely: the test output, the error, the broken
   criterion.
2. Confirm which merge landed most recently on the plan branch.
3. Verify the failure does **not** exist on the commit before that merge.

If it fails there too, this chunk didn't cause it. Keep looking before reverting anything.

## 2. Revert the merge

On the plan branch, revert the merge commit. Never force-push, never reset — other chunk
branches may have been cut from this branch.

```bash
git checkout "$PLAN_BRANCH"
git revert -m 1 <merge-commit-sha>
git push origin "$PLAN_BRANCH"
```

`-m 1` reverts to the first parent: the plan branch as it was before the merge.

## 3. Record it

Set the chunk's status to `Reverted` in the State table, keeping the original PR number.
Add an Execution Log row and a journal entry saying what failed and why. A silently skipped
chunk is how a future session ships a plan with a hole in it.

## 4. Pick a path forward

**Fix forward** (usually right): branch from the plan branch, fix the regression, run the
chunk's gates, go through review, and PR it. Status moves `Reverted` → `Fixing` → `Merged`.

**Re-execute** if the fix amounts to a rewrite: update the chunk plan with what the failure
taught you, reset it to `Not started`, and run it through the normal pipeline.

**Abandon** if the approach was wrong: mark it `Abandoned` with the reason, then check
whether any chunk depends on it. If so, fill their Blocker column and surface it. If the
plan can succeed without it, continue.

## 5. Verify recovery

Re-run the chunk's original gates plus whatever was failing, and confirm the revert didn't
disturb other merged chunks.

## Don't

- Don't force-push the plan branch.
- Don't delete the original PR — it holds the review history.
- Don't revert several chunks at once unless they were one regression. Revert surgically.
