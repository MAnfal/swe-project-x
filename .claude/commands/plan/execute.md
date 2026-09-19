---
description: 'Phase 3 — execute an approved plan chunk by chunk'
argument-hint: '<number|plan-name>'
disable-model-invocation: true
---

<input>
Arguments: `$ARGUMENTS`
</input>

<instructions>

Resolve `$ARGUMENTS` to a plan directory, then read and follow
`.claude/resources/prompts/execute.md`.

Resolution:

- **A number `N`** — resolve it with the `plan-list` skill's resolver, never by counting
  directories yourself:

  ```bash
  .claude/skills/plan-list/scripts/plan-list.sh --resolve-plan N
  ```

  It prints the plan directory, or exits non-zero with a message to show the user. Using
  the resolver is what keeps this command's numbering identical to what `/plan:list`
  displayed.
- **Text** — case-insensitive substring match against the `--plans` output. No match → say
  so. Several → list them and ask which.
- **Empty** — run `--plans`, show them, and ask which one.

Echo `Executing plan: **<name>**`, then read its `ORCHESTRATOR.md` and start from the
current state in the State table.

</instructions>
