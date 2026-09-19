# Frontmatter Slim

The minimal frontmatter convention. Every field that doesn't serve a functional purpose at runtime wastes tokens on every load.

## Field Decision Table

| Field           | Action     | Reason                                                            |
| --------------- | ---------- | ----------------------------------------------------------------- |
| `description`   | **KEEP**   | Claude Code uses this for skill listings and command autocomplete |
| `name`          | **KEEP**   | Claude Code uses this for skill invocation                        |
| `allowed-tools` | **KEEP**   | Claude Code enforces tool restrictions at runtime                 |
| `references`    | **KEEP**   | Routing — tells the agent what to read next                       |
| `argument-hint` | **KEEP**   | Claude Code shows this in command autocomplete                    |
| `id`            | **REMOVE** | Redundant — the file path is the identity                         |
| `requires`      | **MOVE**   | Preconditions are validation metadata — move to `.verify.yaml`    |
| `produces`      | **MOVE**   | Postconditions are validation metadata — move to `.verify.yaml`   |

## Before / After

**Before (bloated):**

```yaml
---
id: skills/lint-docs
name: lint-docs
description: Check docs follow project conventions...
allowed-tools: Bash
requires:
  - .claude/resources/ directory exists
produces:
  - validation report with PASS/FAIL per file
references:
  - bibles/prompt-engineering/conventions/frontmatter.md
---
```

**After (slim):**

```yaml
---
name: lint-docs
description: Check docs follow project conventions...
allowed-tools: Bash
references:
  - bibles/prompt-engineering/conventions/frontmatter.md
---
```

## Moving `requires`/`produces`

Preconditions and postconditions that were in frontmatter belong in the `<context>` block of the prompt if they're explanatory, or can be checked by the script itself if they're machine-verifiable.

## Applying This Convention

When touching a prompt file for any reason, slim its frontmatter as part of the same change. Don't create a dedicated pass — fix it opportunistically.

**Note on the `prompt-contracts` guard:** If removing `id` causes the `prompt-contracts` guard to fail, document it as a follow-up fix in `sdd-plans/pending/local/` — do not block the change on rewriting the guard.

## Related

- @/conventions/frontmatter.md — full frontmatter field reference
