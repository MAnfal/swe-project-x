---
description: 'List active plans and parked ideas'
---

<instructions>

Get the data from the **`plan-list`** skill — do not enumerate directories yourself. Every
command that resolves a `<#>` goes through the same resolver, which is what guarantees the
number a user sees here and the number a command acts on can never disagree. Its rendering
rules live in the skill; run its script directly:

```bash
.claude/skills/plan-list/scripts/plan-list.sh --plans
.claude/skills/plan-list/scripts/plan-list.sh --ideas
```

## Active plans

Rows are `PLAN|<n>|<dir>|<merged>|<total>|<status>|<description>`.

| # | Plan | Chunks | Status | Description |
| - | ---- | ------ | ------ | ----------- |

`Chunks` is `merged/total`. Render a 3-character progress bar beside it (`█` per third).

If the script returns nothing: "No active plans."

## Parked ideas

Rows are `IDEA|<n>|<file>|<title>|<priority>|<created>`.

| # | Idea | Priority | Created |
| - | ---- | -------- | ------- |

If empty: "No parked ideas."

## Then

```
/plan:brainstorm <#>  explore a parked idea and plan it
/plan:execute <#>     execute an active plan
/plan:complete <#>    finish a plan whose chunks are all merged
```

</instructions>
