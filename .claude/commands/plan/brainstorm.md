---
description: 'Phase 1 — explore an idea interactively, then plan it or park it'
argument-hint: '[idea, or a number from /plan:list]'
---

<input>
Arguments: `$ARGUMENTS`
</input>

<instructions>

Read and follow `.claude/resources/prompts/brainstorm.md`.

Route on `$ARGUMENTS`:

- **Empty** — no seed. Go straight into free-form conversation; ask what they're thinking
  about. Do not list parked ideas.
- **A number `N`** — resolve it with the `plan-list` skill's resolver so the numbering
  matches what `/plan:list` showed:

  ```bash
  .claude/skills/plan-list/scripts/plan-list.sh --resolve-idea N
  ```

  Non-zero exit → show its message and stop. Otherwise echo `Brainstorming: **<title>**`,
  read the file, and pass its contents as the seed with its path as `idea_file`.
- **Any other text** — use it as the seed idea.

</instructions>
