# Recipe: Skill from Scratch

When you need to build a new skill, follow this walkthrough. This example builds a `lint-docs` style skill — a deterministic check with AI-driven reporting.

## 1. Requirements

Before writing anything, clarify:

- **What does it do?** — A single, well-scoped action (e.g., "validate bible docs against codebase")
- **Who invokes it?** — User via `/skill-name`, another skill, or a command pipeline
- **What tools does it need?** — Bash, Read, Edit, Glob, Grep, etc.
- **What does success look like?** — Clear pass/fail output, a generated file, a report, etc.

## 2. Determinism Check

**This step is mandatory.** Apply the determinism ladder before writing any prompt logic:

| Level                               | Description                                              | Example                                        |
| ----------------------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| **Level 1 — Pure script**           | Entire skill is a shell script; SKILL.md just invokes it | `validate-registries`, `cleanup-local-git-branches` |
| **Level 2 — Script + AI reporting** | Script does the work, AI interprets results              | `plan-analyze`, `framework-maintenance`        |
| **Level 3 — AI with guardrails**    | AI does the work but within strict constraints           | `plan-scaffold`, `generate-chunk-rubric`             |
| **Level 4 — AI-driven**             | AI makes judgment calls with guidance                    | `explorer-watch`, `plan-interactive`           |

**Rule:** Always push work DOWN the ladder. If a step can be a script, make it a script. Only use AI for judgment, interpretation, and user interaction.

## 3. File Structure

```
.claude/skills/<name>/
  SKILL.md              # Frontmatter + XML instructions
  scripts/
    <name>.sh           # Deterministic logic (Levels 1-2)
```

- Every skill lives in its own directory under `.claude/skills/`
- Scripts go in a `scripts/` subdirectory
- The `SKILL.md` is the entry point — Claude reads this when the skill is invoked

**Reference:** `.claude/skills/plan-check/SKILL.md`

## 4. Frontmatter

The SKILL.md starts with YAML frontmatter defining the skill's contract:

```yaml
---
name: lint-docs
description: Check docs follow project conventions...
allowed-tools: Bash
---
```

**Required fields:**

- `name` — kebab-case, matches directory name
- `description` — one sentence explaining what the skill does (used in skill listings)
- `allowed-tools` — comma-separated list of tools the skill needs (principle of least privilege)

## 5. XML Body

After frontmatter, structure the body with these XML tags:

```xml
<context>
What this skill does and why. Include scope boundaries so the AI
knows what's in/out of bounds.
</context>

<usage>
/skill-name [optional-args]
</usage>

<constraints>
- Guardrails and rules the AI must follow
- What NOT to do
- Scope limits
</constraints>

<instructions>
The actual work. For Level 1-2 skills, this is primarily a script invocation:

!${CLAUDE_SKILL_DIR}/scripts/<name>.sh $ARGUMENTS

For Level 3-4 skills, this contains step-by-step AI instructions.
</instructions>

<on-success>
What to report when everything passes. Be specific about format.
</on-success>

<on-failure>
How to handle failures. Group by category, show actionable context,
suggest fixes. Never just say "it failed."
</on-failure>
```

**Key rules:**

- `<context>` sets scope — keep it tight
- `<constraints>` prevents AI drift — list what NOT to do
- `<on-success>` and `<on-failure>` ensure consistent reporting
- `<usage>` documents invocation syntax

## 6. Script (Levels 1-2)

If the determinism check identified scriptable work, create the script first:

```bash
#!/usr/bin/env bash
set -euo pipefail

# scripts/<name>.sh — deterministic logic for the skill
# Called by SKILL.md via: !${CLAUDE_SKILL_DIR}/scripts/<name>.sh

# ... implementation ...
```

**Script conventions:**

- `set -euo pipefail` at the top
- Accept arguments via `$1`, `$2`, etc.
- Print structured output (pass/fail per check, counts, file paths)
- Exit 0 on success, non-zero on failure
- Use `gum` for styled terminal output when interactive

## 7. Wiring

In SKILL.md's `<instructions>`, reference the script:

```
!${CLAUDE_SKILL_DIR}/scripts/<name>.sh $ARGUMENTS
```

- `${CLAUDE_SKILL_DIR}` resolves to the skill's directory at runtime
- `$ARGUMENTS` passes through whatever the user typed after the skill name
- The `!` prefix executes the command and captures output for AI interpretation

## 8. Validation

After creating the skill:

1. Run `/framework-maintenance` (check mode) to check XML structure and frontmatter compliance
2. Invoke the skill manually to verify it works end-to-end
3. Check that `allowed-tools` is minimal — only what the skill actually needs

## Checklist

- [ ] Determinism ladder applied — scriptable work is in scripts, not prompts
- [ ] SKILL.md has valid frontmatter (name, description, allowed-tools)
- [ ] XML body uses correct tags (context, constraints, instructions, on-success, on-failure)
- [ ] Script (if any) uses `set -euo pipefail` and exits with proper codes
- [ ] `/framework-maintenance` (check) reports no new warnings
- [ ] Skill is invocable and produces expected output

## Related

- @/foundation/determinism-ladder.md — Full determinism ladder reference
- @/conventions/xml-structure.md — XML tag conventions
- @/conventions/frontmatter.md — Frontmatter field reference
