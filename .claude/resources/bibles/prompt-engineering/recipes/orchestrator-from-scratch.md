# Recipe: Orchestrator from Scratch

An orchestrator is a slim routing prompt that sequences multiple phases. Each phase is a separate file, read at runtime. Use this pattern when a workflow has 3+ sequential steps that each need their own context and failure handling.

**Reference:** `.claude/resources/prompts/execute.md`

## 1. Decide if You Need an Orchestrator

| Scenario                                 | Use                           |
| ---------------------------------------- | ----------------------------- |
| 2 or fewer steps                         | Pipeline command (simpler)    |
| 3+ sequential steps, each self-contained | Orchestrator                  |
| Steps that can run in parallel           | Pipeline with parallel groups |

## 2. Plan the Phases

List each phase with:

- **Name** — short, numbered (e.g., "Phase 0 — Config")
- **Purpose** — one sentence
- **Dependencies** — what prior phases must complete first
- **Determinism** — can this phase be a script? Apply the determinism ladder

Example from dev setup:

```
Phase 0 — Config       → create/verify config file (interactive)
Phase 1 — Bootstrap    → install system prerequisites (script)
Phase 2 — Preflight    → verify prerequisites are working (script)
...
```

## 3. Create the Orchestrator Prompt

The orchestrator is a slim file (~60-80 lines) that routes through phases. It lives in `.claude/resources/prompts/<domain>/`.

```xml
<context>
Orchestrates a multi-phase <workflow>. Each phase reads its own prompt
file and executes independently. Phases are sequential, idempotent,
and resume-friendly.
</context>

<constraints>
- Sequential execution: do NOT skip ahead
- Idempotent: re-running is always safe
- Resume-friendly: re-running skips completed phases
- Stop on failure: resolve before proceeding
</constraints>

<instructions>

## Phase 0 — Config

Read `.claude/resources/prompts/<domain>/phases/00-config.md` and follow it.

## Phase 1 — Bootstrap

Read `.claude/resources/prompts/<domain>/phases/01-bootstrap.md` and follow it.

## Phase N — ...

Read `.claude/resources/prompts/<domain>/phases/0N-name.md` and follow it.

</instructions>

<on-success>
Tell the user the workflow is complete. Suggest next steps.
</on-success>

<on-failure>
Report which phase failed and what the error was. Wait for the user
to resolve before retrying.
</on-failure>
```

**Key rules:**

- The orchestrator contains NO implementation logic — only phase routing
- Each phase instruction is "Read `<path>` and follow it" — nothing more
- Keep under 80 lines — if longer, the orchestrator is doing too much
- Phase files are numbered with zero-padded prefixes (00, 01, 02...)

## 4. Create Phase Files

Each phase lives in a `phases/` subdirectory. See @/recipes/phase-from-scratch.md for the full recipe.

```
.claude/resources/prompts/<domain>/
  <orchestrator>.md           # Slim routing file
  phases/
    00-config.md              # Phase 0
    01-bootstrap.md           # Phase 1
    02-preflight.md           # Phase 2
    ...
```

## 5. Apply Determinism

For each phase, check: can this phase be a script?

- **Yes** → Create the script, have the phase prompt invoke it
- **Partially** → Script does the work, AI interprets results
- **No** → Phase prompt contains AI instructions directly

## 6. Validation

After creating all files:

1. Verify the orchestrator references every phase file path correctly
2. Run `/framework-maintenance` (check mode) to check XML compliance on all files
3. Walk through the orchestrator manually — does each phase path exist?
4. Test idempotency — run the workflow twice, verify the second run skips completed work

## Checklist

- [ ] Orchestrator is slim (~60-80 lines), contains only phase routing
- [ ] Phase files are numbered, self-contained, and under 50 lines each
- [ ] Determinism ladder applied to each phase
- [ ] Orchestrator has `<context>`, `<constraints>`, `<instructions>`, `<on-success>`, `<on-failure>`
- [ ] `/framework-maintenance` (check) passes on all files

## Related

- @/recipes/phase-from-scratch.md — Creating individual phase files
- @/foundation/determinism-ladder.md — Determinism ladder reference
