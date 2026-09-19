# Updating Existing Prompts

When a standard or convention evolves, existing prompts may need updating. This guide covers how to identify affected prompts and propagate changes safely.

## When Does This Apply?

- A frontmatter field is added, renamed, or removed
- An XML tag convention changes (e.g., new required tag)
- A behavioral convention changes (e.g., how skills invoke scripts)
- A naming convention changes (e.g., file naming patterns)

## 1. Identify Affected Prompts

Use multiple discovery methods to ensure full coverage:

```bash
# Search for the pattern being changed
grep -r "old-pattern" .claude/commands/ .claude/skills/ .claude/resources/prompts/

# Run /framework-maintenance (check mode) to find structural violations
# (invoke via Skill tool, not directly)

# Check the dependency graph — which prompts reference the changed doc?
grep -r "changed-filename" .claude/
```

**Key:** Don't rely on a single search. Patterns may appear in frontmatter, XML bodies, comments, or file paths.

## 2. Assess Scope

| Scope           | Action                                           |
| --------------- | ------------------------------------------------ |
| **1-3 prompts** | Update inline, same PR as the convention change  |
| **4-9 prompts** | Update in a dedicated commit, same PR            |
| **10+ prompts** | Create an execution plan — don't do ad-hoc edits |

For 10+ prompts, create a plan in `sdd-plans/` with:

- List of all affected prompts
- The specific change needed in each
- Dependency order (if changes must be sequenced)
- Verification gates

## 3. Update Each Prompt

For each affected prompt, check three areas:

### Frontmatter

If a frontmatter schema changed (new field, renamed field, removed field):

- Add/update/remove the field
- Verify the value matches the new schema
- Check that the `prompt-contracts` guard accepts the updated frontmatter

### XML Structure

If tag conventions changed (new required tag, renamed tag, new nesting rule):

- Add/update/remove the tag
- Verify content follows the new convention
- Check that sibling prompts of the same type use consistent structure

### Content

If behavioral conventions changed (how to invoke scripts, how to report results, etc.):

- Update the instructions to follow the new convention
- Verify the prompt still works end-to-end after the change

## 4. Validate

After updating all prompts:

1. Run `/framework-maintenance` (check mode) — all updated files should pass
2. Spot-check 2-3 updated prompts by invoking them manually
3. Verify no prompts were missed — re-run the discovery grep from step 1

## 5. Document the Change

If the change is significant (affects behavior, not just formatting):

- Update the relevant bible doc that defines the convention
- Add a note in the PR description explaining what changed and why
- If the change is backwards-incompatible, note what the old behavior was

## Checklist

- [ ] All affected prompts identified (multiple search methods used)
- [ ] Scope assessed — inline update, dedicated commit, or execution plan
- [ ] Each prompt updated: frontmatter, XML structure, and content as needed
- [ ] `/framework-maintenance` (check) passes on all updated files
- [ ] Spot-checked 2-3 prompts manually
- [ ] No prompts missed (re-ran discovery search)
- [ ] Convention doc updated to reflect the new standard
