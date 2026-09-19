# Module Contracts

Every prompt file carries a contract in its YAML frontmatter. Contracts make prompts discoverable, composable, and validatable.

## Core Fields

| Field         | Type       | Status       | Description                                                     |
| ------------- | ---------- | ------------ | --------------------------------------------------------------- |
| `name`        | `string`   | **Keep**     | Skill/command name — used by Claude Code for invocation          |
| `description` | `string`   | **Keep**     | One-line summary of what this prompt does                       |
| `references`  | `string[]` | **Keep**     | Forward dependencies — other prompts this one reads at runtime  |
| `allowed-tools` | `string` | **Keep**     | Comma-separated tool list for principle of least privilege       |
| `argument-hint` | `string` | **Keep**     | POSIX-style usage hint shown in command autocomplete            |
| `id`          | `string`   | **Optional** | Path-based identifier — redundant with file path in most cases  |
| `requires`    | `string[]` | **Optional** | Preconditions — move to `<context>` block when explanatory      |
| `produces`    | `string[]` | **Optional** | Postconditions — move to `<context>` block when explanatory     |

See @/conventions/frontmatter-slim.md for the rationale behind making `id`, `requires`, and `produces` optional.

## Example: Skill Contract

```yaml
---
id: plan-analyze
description: Validate plan consistency — structural, semantic, and codebase alignment
requires:
  - plan directory exists in sdd-plans/
  - plan contains ORCHESTRATOR.md and chunk files
produces:
  - severity-ranked validation report
  - coverage mapping of spec stories to chunks
references:
  - plan-analyze.sh
---
```

## Example: Phase Contract

```yaml
---
id: dev-setup-phase-00
description: Create or verify project config file at ~/.config/<tool>/config
requires:
  - $ENV argument provided by orchestrator
produces:
  - ROOT_DIR value resolved
  - SHELL_RC value resolved
references: []
---
```

## Reverse Index

The reverse index — "which prompts reference this one?" — is computed automatically by the `dependency-graph` guard. It is never maintained manually. This prevents stale cross-references.

## Validation Rules

The `prompt-contracts` guard parses contracts and enforces:

1. **Presence** — Every prompt file must have YAML frontmatter with at least `description`
2. **Reference resolution** — Every entry in `references` must resolve to an existing file or prompt ID
3. **Uniqueness** — No two prompts may share the same `id` (when present)
4. **Dependency graph** — The computed graph must be acyclic (no circular references)

## When to Add a Contract

- Creating a new prompt file → add `description` and `references` at minimum
- Modifying an existing prompt → verify the contract still reflects reality
- Splitting a prompt into phases → each phase gets its own contract with `references` linking back to the orchestrator
