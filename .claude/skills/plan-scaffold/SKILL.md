---
name: plan-scaffold
description: Create a plan directory or a chunk inside one, from the templates. Use during plan creation, before writing any SPEC or chunk content by hand.
allowed-tools: Bash, Read, Edit, Write
---

# Plan Scaffold

Creates the files so the planner can fill them in. Naming, numbering, which template lands
where, and keeping the State table in step with the directories on disk are mechanical —
they belong in a script, not in an instruction someone has to follow correctly every time.

## Create a plan

```bash
${CLAUDE_SKILL_DIR}/scripts/plan-new.sh <kebab-case-name>
```

Prints the plan directory. Inside it: `SPEC.md`, `ORCHESTRATOR.md`, `retro.md` — each
copied from `.claude/resources/templates/` with the template's own metadata header
stripped. The date prefix is today's; the script refuses to overwrite an existing plan.

## Add a chunk

```bash
${CLAUDE_SKILL_DIR}/scripts/plan-new.sh --chunk <plan-dir> <kebab-case-chunk-name>
```

Prints the chunk directory. Inside it: `plan.md` and `rubric.md`. The number is one past
the highest chunk that exists, and the matching row is added to the ORCHESTRATOR's State
table in the same call — a row written by hand later is a row that can disagree with the
disk, which is the drift this script exists to remove.

## Then

Fill in what was scaffolded — see `.claude/resources/prompts/planning.md` Phase 5 for what
goes in each file. Two rules the script can't enforce:

- **The rubric and the plan stay separate documents.** `plan.md` must not reference
  `rubric.md`, and rubric items state the rule being checked rather than citing the plan.
  Merging them teaches to the test.
- **Fill the `Story` column** in each State table row the script added. A chunk that serves
  no user story is either scaffolding that belongs inside another chunk, or scope creep.

Run the `plan-check` skill when the content is written.

## On failure

The script exits non-zero and says why: a name that isn't kebab-case, a plan that already
exists, a missing template. Don't work around it by creating files by hand — a missing
template means the framework is damaged, and hand-built artifacts drift from what every
later phase expects.
