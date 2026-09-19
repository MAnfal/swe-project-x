---
name: plan-list
description: Enumerate active plans and parked ideas, or resolve a list number to a path. Use whenever a command takes a "<#>" argument, so every command's numbering agrees.
allowed-tools: Bash, Read
---

# Plan List

One resolver behind every number the user sees. `/plan:list` displays these rows;
`/plan:execute`, `/plan:complete` and `/plan:brainstorm` resolve against them.
Counting directories independently in each command is how the number on screen and the
number a command acts on drift apart.

## Enumerate

```bash
${CLAUDE_SKILL_DIR}/scripts/plan-list.sh --plans
${CLAUDE_SKILL_DIR}/scripts/plan-list.sh --ideas
```

- `PLAN|<n>|<dir>|<merged>|<total>|<status>|<description>`
- `IDEA|<n>|<file>|<title>|<priority>|<created>`

Plans are the date-prefixed directories directly under `plans/`, sorted by name; `ideas/`
and `completed/` are excluded. `<merged>/<total>` counts State table rows whose first cell
is numeric, so header, separator, and `Extra` rows stay out of the count.

## Resolve a number

```bash
${CLAUDE_SKILL_DIR}/scripts/plan-list.sh --resolve-plan N
${CLAUDE_SKILL_DIR}/scripts/plan-list.sh --resolve-idea N
```

Prints the path, or exits non-zero with a message to show the user verbatim. Never resolve
a number by listing directories yourself — that is the exact drift this exists to prevent.

## Rendering

For `/plan:list`, render two tables in the order the script returned. Do not re-sort:
the numbering is the contract.

| # | Plan | Chunks | Status | Description |
| - | ---- | ------ | ------ | ----------- |

`Chunks` is `merged/total` with a 3-character bar beside it (`█` per third completed).
Empty output means "No active plans." / "No parked ideas." — say that rather than showing
an empty table.
