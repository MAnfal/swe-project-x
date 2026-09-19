---
description: 'Phase 4 — final PR, retro, and archive'
argument-hint: '<number|plan-name>'
disable-model-invocation: true
---

<input>
Arguments: `$ARGUMENTS`
</input>

<instructions>

Resolve `$ARGUMENTS` to a plan directory the same way `/plan:execute` does — via
`.claude/skills/plan-list/scripts/plan-list.sh --resolve-plan N` — then read and follow
`.claude/resources/prompts/completion.md`.

Check the ORCHESTRATOR's State table first and branch:

- **Not every chunk is `Merged` or `Dismissed`** — say which ones are outstanding and stop.
  Delivery does not start on a half-executed plan.
- **All chunks done, no final PR yet** — run Part 1 (ship).
- **Final PR merged** — run Part 2 (close the loop: retro, learnings, archive).

</instructions>
