# Recipe: Phase from Scratch

A phase is a single step in a multi-phase orchestrator. Each phase file is self-contained — it has its own context, instructions, and failure handling. The orchestrator reads it at runtime via the Read tool.

**Reference:** `.claude/resources/prompts/preflight.md`

## File Location

```
.claude/resources/prompts/<domain>/phases/NN-<name>.md
```

- `NN` — zero-padded number matching the phase order (00, 01, 02...)
- `<name>` — kebab-case description of what the phase does

## Structure

```xml
# Phase N — Name

<context>
What this phase does and why. One to two sentences. Include what
the orchestrator expects this phase to produce (outputs, state changes).
</context>

<instructions>

## If already complete

Check for completion markers (file exists, config present, etc.).
If already done, report success and skip.

## If not complete

Step-by-step instructions. For deterministic work, invoke a script:

!.claude/resources/prompts/<domain>/scripts/<name>.sh $ARGS

For interactive/AI work, provide clear instructions with
decision points and expected outcomes.

</instructions>

<on-success>
Report what was accomplished back to the orchestrator.
Include any values or state that subsequent phases need.
</on-success>

<on-failure>
Specific failure scenarios with fixes:
- If X fails → suggest Y
- If permission error → suggest Z
- If dependency missing → suggest installing it

Never just say "it failed" — provide actionable recovery.
</on-failure>
```

## Key Rules

- **Keep under 50 lines** — if longer, the phase is doing too much; split it
- **Self-contained** — the phase must make sense without reading the orchestrator
- **Idempotent** — always check before acting; re-running must be safe
- **Report back** — `<on-success>` should return values the orchestrator needs for subsequent phases
- **Specific failures** — `<on-failure>` lists concrete scenarios, not generic messages

## Checklist

- [ ] File is numbered and named consistently with sibling phases
- [ ] Has `<context>`, `<instructions>`, `<on-success>`, `<on-failure>`
- [ ] Under 50 lines total
- [ ] Idempotent — checks before acting
- [ ] `<on-success>` reports values needed by later phases
- [ ] `<on-failure>` lists specific failure scenarios with fixes

## Related

- @/recipes/orchestrator-from-scratch.md — Building the orchestrator that sequences phases
- @/foundation/determinism-ladder.md — Deciding what should be a script vs AI
