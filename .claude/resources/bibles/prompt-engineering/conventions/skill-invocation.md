# Skill Invocation Semantics

How skills are invoked, what `disable-model-invocation` means, and the difference between user-invocable and model-invocable skills.

## Invocation methods

A skill can be invoked in two ways:

| Method | Who | Trigger |
| ------ | --- | ------- |
| **Model invocation** | Claude (the model) | The model decides to invoke the skill during a conversation |
| **User invocation** | The user (or a cron job) | User types `/skill-name` in the chat, or a cron entry fires the skill |

Both invocation methods are always available **unless** the skill's frontmatter declares `disable-model-invocation: true`.

## `disable-model-invocation: true`

This frontmatter field blocks only **model auto-invocation** — the model cannot choose to invoke the skill on its own. It does **not** block user invocation. A skill with `disable-model-invocation: true` is still fully invocable via `/skill-name`.

**Why use it**: for maintenance operations, cron-style tasks, or skills that require human intent (e.g., `framework-maintenance`). The model should not auto-trigger a "drain the inbox and open a PR" operation unprompted; only a human or a scheduled cron should.

**What it does NOT do**: it does not make the skill "private," "hidden," or "unavailable." Users can always invoke it by name. The field only gates the model's autonomy.

## User-invocable skills

Every skill listed in `skills/*/SKILL.md` is **user-invocable by default**. The Claude Code harness lists user-invocable skills in its system-reminder, and users invoke them by typing `/skill-name` in the chat.

`disable-model-invocation: true` does not change this. A skill with this flag appears in the harness listing and responds to `/skill-name` — it just won't be auto-triggered by the model mid-conversation.

## The `/name` slash-invocation convention

The `/name` convention applies to **both commands and user-invocable skills**:

- **Commands** live at `.claude/commands/**/*.md`. They are always user-invocable via `/command-name`.
- **Skills** live at `.claude/skills/<name>/SKILL.md`. They are user-invocable via `/skill-name` (or the fully-qualified `/plugin:skill-name` form in some harness versions).

The distinction between commands and skills is organizational (scope, allowed-tools, phase structure) — not invocation. Both respond to `/name`.

## `user-invocable: false`

Setting `user-invocable: false` in a skill's frontmatter **removes** the skill from the user-facing harness listing and prevents direct `/name` invocation. Use this only for internal sub-skills intended to be called only from within other skills/commands. If omitted, the skill is user-invocable.

Note: `disable-model-invocation: true` does NOT imply `user-invocable: false`. They are orthogonal flags.

## Resolution inside a git worktree

The `Skill` tool resolves a skill from the **main checkout**, not from the worktree the caller is
running in. For a chunk that *edits* a skill and then verifies with it, invoking through `Skill`
grades the unedited main-checkout copy and returns a confidently wrong PASS — nothing in the
output says which copy ran.

So `CLAUDE.md`'s "invoke skills through the `Skill` tool, never by calling their bash scripts
directly" carries one exception: **when the chunk under test modifies the skill it verifies with,
call the worktree's script path directly.**

```bash
# WRONG inside a worktree when the chunk edits this skill — grades the main checkout
Skill(validate-block-style)

# RIGHT — the worktree's own copy, which is the one under test
"$WT/.claude/skills/plan-check/scripts/check-prereqs.sh"
```

A chunk that only *runs* a skill it does not modify should use `Skill` normally.

Evidence: two chunks of `2026-08-25-retire-gap-primitive` edited authoring gates and verified with
them; both had to bypass `Skill` deliberately to get a true verdict.

## Summary

| Frontmatter | Model can auto-invoke | User can `/name` invoke |
| ----------- | --------------------- | ----------------------- |
| (neither flag) | yes | yes |
| `disable-model-invocation: true` | **no** | yes |
| `user-invocable: false` | yes | **no** |
| both | no | no |
