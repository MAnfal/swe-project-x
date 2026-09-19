# Determinism Ladder

The core design principle for prompts in this project: **always pick the highest level that can handle the task.** Higher levels are more predictable, testable, and reproducible.

## The 4 Levels

### Level 1: Pure Script

Bash or shell. Fully deterministic, testable, zero variance between runs.

**Examples from this codebase:**

- `validate-registries` — checks that all component folders are registered in their index.ts files
- `prompt-contracts` guard script — parses YAML frontmatter and checks structural rules
- Worktree bootstrap — `git worktree add`, symlink `node_modules`, deterministic setup

**Use when:** The entire task is deterministic — no interpretation, no judgment, no ambiguity.

### Level 2: Skill (Script + AI)

Script handles the deterministic work (file scanning, data gathering, structural checks), then AI interprets the results. The script guarantees consistent inputs; the AI provides intelligent analysis.

**Examples from this codebase:**

- `plan-analyze` — script runs structural validation, AI performs semantic and codebase alignment analysis
- `framework-maintenance` — scripts run the deterministic guards, AI consolidates and severity-ranks the findings

**Use when:** Execution is deterministic but interpretation requires intelligence.

### Level 3: Agent with Fresh Context

Spawned in isolation with a clean context window. Gets a focused task description and works autonomously.

**Examples from this codebase:**

- `senior-software-engineer` implementing a chunk from an execution plan
- `code-reviewer` performing a post-write review
- Teammate agents executing parallel chunks via `TeamCreate` + `TaskCreate`

**Use when:** The task requires reasoning and benefits from context isolation — no prior conversation noise.

### Level 4: Inline AI (Current Context)

AI operates within the current conversation. Least preferred — context may be polluted with unrelated information, attention budget is shared.

**Use when:** The task is trivial, or it specifically requires current conversation state (e.g., answering a follow-up question about something just discussed).

## Decision Flowchart

```
Can a script do it deterministically?
  → YES → Level 1 (pure script)
  → NO  → Does it need AI to interpret results?
             → YES → Level 2 (skill = script + AI)
             → NO  → Does it benefit from fresh context?
                        → YES → Level 3 (agent)
                        → NO  → Level 4 (inline AI)
```

## Rule

When designing a new prompt or capability, start at Level 1 and only move down the ladder when the task genuinely requires it. Every level below 1 introduces variance — accept it only when the task demands it.
