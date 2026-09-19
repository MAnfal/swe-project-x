# Single Concern

Every prompt should do one thing well. This is not a style preference — it is grounded in how language models process instructions.

## Why It Matters

### Lost in the Middle

Research (Liu et al., 2023) shows that language models attend strongly to the beginning and end of their context, with a performance valley in the middle. Long prompts with multiple concerns bury critical instructions in the valley where they are most likely to be missed.

### Attention Dilution

Every instruction in a prompt competes for the model's attention budget. Irrelevant instructions — git strategies in a validation prompt, agent team setup in a phase prompt — waste tokens and dilute focus on the actual task.

### The God Prompt Anti-Pattern

A single prompt that handles planning, execution, git workflow, agent team coordination, and verification. Symptoms:

- Prompt exceeds 150 lines
- Multiple `<instructions>` blocks or deeply nested sections
- Agent needs only one section but must process the entire prompt
- Changes to one concern risk breaking unrelated concerns

## The Test

> "If an agent only needs this prompt for one phase of its work, the prompt is doing too much."

If a prompt fails this test, decompose it: extract phases into separate files, split concerns into an orchestrator + phases, or move reference material into a dedicated reference prompt.

## Max Sizing Guidelines

| Type         | Target Lines | Hard Max |
| ------------ | ------------ | -------- |
| Orchestrator | ~80          | 120      |
| Pipeline     | 50-100       | 150      |
| Phase        | 30-50        | 80       |
| Skill        | 40-80        | 120      |
| Reference    | 80-120       | 150      |
| Template     | 40-80        | 120      |
| Router       | 20-40        | 60       |
| Watch/Loop   | 40-80        | 120      |

These are guidelines, not laws. If a prompt exceeds its hard max, that is a signal to decompose — not an automatic failure.
