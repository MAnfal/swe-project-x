# Variables and Injection

Claude Code provides string substitution and dynamic context injection for skills and commands.

## String Substitutions

Available in skills (`SKILL.md`) and commands:

| Variable                | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| `$ARGUMENTS`            | All arguments passed to the skill/command as a single string |
| `$ARGUMENTS[N]` or `$N` | Positional argument by 0-based index                         |
| `${CLAUDE_SKILL_DIR}`   | Absolute path to the skill's directory                       |
| `${CLAUDE_SESSION_ID}`  | Current session ID                                           |

Example usage in a skill:

```markdown
<input>
Arguments: `$ARGUMENTS`

Parse the first word as the **action**. Remaining words are **extra args**.
</input>
```

## Dynamic Context Injection

The `` !`command` `` syntax runs a shell command BEFORE Claude sees the prompt content. The command's stdout replaces the placeholder inline.

```markdown
## Current PR diff

!`gh pr diff`
```

This is preprocessing — the command executes at prompt load time, not at runtime. Use it to inject dynamic context like git diffs, file listings, or script output.

## Best Practices

**Use `${CLAUDE_SKILL_DIR}` for script references** — not relative paths:

```markdown
!${CLAUDE_SKILL_DIR}/scripts/my-script.sh $ARGUMENTS
```

This ensures the script resolves correctly regardless of the working directory.

**Combine injection with arguments** for parameterized scripts:

```markdown
!${CLAUDE_SKILL_DIR}/scripts/plan-analyze.sh $ARGUMENTS
```

See `skills/plan-check/SKILL.md` for a real example.

**Avoid side effects in injected commands** — injected commands run at load time and should be read-only (queries, diffs, listings). Never use injection to modify state.
