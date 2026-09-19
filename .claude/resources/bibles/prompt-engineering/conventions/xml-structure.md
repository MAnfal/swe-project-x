# XML Tag Structure

Prompt files use XML tags to delineate semantic sections. The `prompt-contracts` guard (`resources/scripts/framework-maintenance/prompt-contracts.sh`) enforces tag presence and ordering.

## Required Ordering

Tags must appear in this order (enforced by the `prompt-contracts` guard):

1. `<context>` or `<input>` — WHY/WHAT: background, inputs, prerequisites
2. `<constraints>` — guardrails: WHAT NOT to do (optional but recommended)
3. `<instructions>` or `<phases>` or `<loop>` — HOW: the work to perform
4. `<output-format>` — what the output looks like (optional)
5. `<on-success>` — happy-path behavior (optional)
6. `<on-failure>` — error handling with specific scenarios (recommended for skills and pipelines)

The validator checks that `<input>`/`<context>` appears before `<instructions>`. Violating this order produces a WARN.

## Validation Checks (from the `prompt-contracts` guard)

| Check                                                   | Severity | Rule                                       |
| ------------------------------------------------------- | -------- | ------------------------------------------ |
| Missing `<input>` or `<context>`                        | WARN     | Every actionable prompt needs context      |
| Missing `<instructions>` (or `<phases>`, `<loop>`)      | WARN     | Every actionable prompt needs instructions |
| Missing error contract on skills/pipelines              | WARN     | Skills and pipelines must handle failures  |
| Missing `<output-format>`, `<usage>`, or `<on-success>` | INFO     | Recommended but not required               |
| `<input>`/`<context>` after `<instructions>`            | WARN     | Context must come before instructions      |
| Vague error language without `<on-failure>`             | INFO     | Prefer structured error contracts          |
| Router missing `<routes>`                               | WARN     | Router commands must declare routes        |

## Type-Specific Tags

**Router commands** — use `<routes>` with `<route>` children:

```xml
<routes>
  <route action="list">...</route>
  <route action="pending">...</route>
  <route action="*">...</route>
</routes>
```

See `.claude/commands/plan/` for a reference implementation.

**Orchestrators** — use `<phases>` with `<phase>` children:

```xml
<phases>
  <phase name="preflight">...</phase>
  <phase name="install">...</phase>
</phases>
```

**Watch/Loop prompts** — use `<loop>` with timeout attributes:

```xml
<loop timeout="300" unit="seconds" exit="user says stop OR timeout">
  ...loop body...
</loop>
```

See `.claude/commands/plan/list.md` for a reference implementation.

**Templates** — no XML tags. Use plain markdown with placeholder markers.

## Anti-Patterns

- `<instructions>` before `<context>` — fails the `prompt-contracts` ordering check
- Vague error handling (e.g. "help resolve") without a structured `<on-failure>` block
- Missing `<on-failure>` on skills that interact with external systems (MCP, filesystem, git)
- **Real project data in output examples** — example tables, code blocks, or sample outputs that use names matching actual project entities (plan names, component names, real people). The AI may pattern-match on the example instead of computing the result. Use obviously synthetic names (e.g., `api-rate-limiting`, `Alice Example`) that cannot be confused with real data
