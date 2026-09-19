# Frontmatter Specification

Every actionable prompt file uses YAML frontmatter (`---` delimiters) to declare metadata. Fields vary by prompt type. Claude Code natively supports `description`, `argument-hint`, `name`, and `allowed-tools`; this project extends frontmatter with contract fields (`id`, `requires`, `produces`, `references`) for dependency tracking and validation.

## Commands

Commands live in `.claude/commands/`. Claude Code uses `description` and `argument-hint` for autocomplete.

```yaml
---
description: '...' # REQUIRED — what the command does + when to use it
argument-hint: '...' # OPTIONAL — shown in autocomplete (e.g. '<type> <name>')
id: commands/<name> # REQUIRED — unique module identifier
requires: [...] # REQUIRED — preconditions
produces: [...] # REQUIRED — postconditions
references: [...] # REQUIRED — forward dependencies (paths relative to .claude/resources/)
---
```

### Argument-Hint Syntax (POSIX Standard)

`argument-hint` uses standard POSIX/CLI usage syntax — the same convention as `git`, `docker`, `man` pages, and shell builtins.

**Tokens:**

| Token | Meaning | Example |
|---|---|---|
| `<arg>` | Required — user must provide | `<kebab-case-name>` |
| `[arg]` | Optional — can omit | `[command-name]` |
| `a\|b\|c` | Alternatives — pick one (inside either bracket type) | `<create\|update\|delete>` |
| `<number>` | Numeric value (e.g., list index) | `<number>` |
| `arg,...` | Repeatable comma-separated values | `[branch,...]` |
| `action \| action` | Router sub-commands (top-level spaced pipes) | `list \| pending <item> \| <idea>` |

**Rules:**

1. `<>` = required, `[]` = optional — no exceptions
2. Arg names are lowercase-kebab and describe the value type
3. No parenthetical explanations — the hint is a usage signature, not help text
4. No prose, dashes, or sentence fragments
5. Use `<number>` for numeric list references, not `<#>`
6. `|` inside brackets = alternatives; ` | ` spaced at top level = router actions
7. `,...` suffix for repeatable comma-separated values
8. If a command takes no meaningful args, omit `argument-hint` entirely

**Examples by pattern:**

```yaml
# Required enum + required positional
argument-hint: '<type> <kebab-case-name>'

# Required number
argument-hint: '<number>'

# Required number or name
argument-hint: '<number|plan-name>'

# Optional single keyword
argument-hint: '[all]'

# Optional enum
argument-hint: '[all|one|none]'

# Optional with default
argument-hint: '[environment]'

# Optional action with required sub-arg
argument-hint: '[restore <number|name>]'

# Optional repeatable list
argument-hint: '[branch,...]'

# Bare optional name
argument-hint: '[command-name]'

# Router with mixed actions
argument-hint: 'list | pending <item> | <idea>'
```

## Skills

Skills live in `.claude/skills/<name>/SKILL.md`. Claude Code uses `name`, `description`, and `allowed-tools`.

```yaml
---
name: <name> # OPTIONAL — defaults to directory name
description: '...' # RECOMMENDED — what + when
allowed-tools: Tool1, Tool2 # OPTIONAL — comma-separated; unrestricted if omitted
id: skills/<name> # REQUIRED — unique module identifier
requires: [...] # REQUIRED — preconditions
produces: [...] # REQUIRED — postconditions
references: [...] # REQUIRED — forward dependencies
---
```

Example — `skills/plan-check/SKILL.md`:

```yaml
---
name: plan-analyze
description: Validate plan consistency — pass a plan dir path, or omit to auto-select
allowed-tools: Bash, Read, Glob, Grep
---
```

## Resource prompts

Resource prompts live in `.claude/resources/prompts/`. These had no frontmatter historically; the contract fields are added by this project.

```yaml
---
id: prompts/<path>/<name> # REQUIRED — unique module identifier
description: '...' # REQUIRED — what this prompt does
requires: [...] # REQUIRED — preconditions
produces: [...] # REQUIRED — postconditions
references: [...] # REQUIRED — forward dependencies
---
```

## Templates

Templates are reusable structural patterns (e.g. orchestrator templates, chunk templates).

```yaml
---
id: templates/<subdir>/<name> # REQUIRED — unique module identifier (subdir = plan, execution, git, agent, tracker)
description: '...' # REQUIRED — what this template provides
requires: [...] # REQUIRED — preconditions
produces: [...] # REQUIRED — postconditions
references: [...] # REQUIRED — forward dependencies
---
```

## Field Semantics

| Field        | Description                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`         | Unique path-based identifier. Convention: `<type>/<name>` (e.g. `skills/plan-check`, `prompts/execution/planning`).                                                                       |
| `requires`   | What must be true BEFORE this module runs. List of preconditions (e.g. `[repo-root, sdd-plans/]`).                                                                                         |
| `produces`   | What will be true AFTER this module runs. List of postconditions (e.g. `[execution-plan, chunk-files]`).                                                                                   |
| `references` | Forward dependencies — other modules this one reads at runtime. Paths relative to `.claude/resources/`. The reverse index (what references THIS module) is computed by the `dependency-graph` guard. |
