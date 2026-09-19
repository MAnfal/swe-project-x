---
id: bibles/prompt-engineering/decision-tree
description: Routing table for the prompt-engineering bible — match the task, read the leaf page, follow it
---

# Decision Tree

When you need to create, design, maintain, or validate a prompt, find your scenario below. Each entry points to the relevant doc.

## Creating Prompts

| I need to...                                           | Go to                                         |
| ------------------------------------------------------ | --------------------------------------------- |
| Build a standalone capability invoked by name          | @foundation/prompt-taxonomy.md (Skill)        |
| Build an entry point that dispatches to sub-prompts    | @foundation/prompt-taxonomy.md (Router)       |
| Build a linear task with clear sequential steps        | @foundation/prompt-taxonomy.md (Pipeline)     |
| Coordinate multi-phase work with delegation            | @foundation/prompt-taxonomy.md (Orchestrator) |
| Build one step in a multi-phase flow                   | @foundation/prompt-taxonomy.md (Phase)        |
| Write a step-by-step guide for a specific domain       | @foundation/prompt-taxonomy.md (Reference)    |
| Create a fill-in-the-blank pattern for generated files | @foundation/prompt-taxonomy.md (Template)     |
| Build a scaffold skill that generates many files       | @recipes/scaffold-with-templates.md           |
| Decide between `.tmpl` (bash-consumed) and `.md` (Claude-consumed) templates | @recipes/scaffold-with-templates.md |
| Build a long-running observation/reaction cycle        | @foundation/prompt-taxonomy.md (Watch/Loop)   |

## Designing Prompts

| I need to...                                            | Go to                                      |
| ------------------------------------------------------- | ------------------------------------------ |
| Decide whether to use a script, skill, agent, or inline | @foundation/determinism-ladder.md          |
| Decide where a new resource file lives                  | @foundation/resource-placement.md          |
| Determine if a prompt/agent/skill is an orphan          | @foundation/resource-placement.md          |
| Understand how large a prompt should be                 | @foundation/single-concern.md (sizing)     |
| Understand why prompts must stay focused                | @foundation/single-concern.md              |
| Learn what anti-patterns to avoid                       | @foundation/single-concern.md (god prompt) |
| Understand how docs reference each other at scale       | @foundation/composition-at-scale.md        |
| Check context window impact of a doc                    | @conventions/context-budget.md             |
| Optimize a doc for AI consumption                       | @conventions/ai-optimized-writing.md       |

## Maintaining Prompts

| I need to...                                  | Go to                                        |
| --------------------------------------------- | -------------------------------------------- |
| Add a contract (frontmatter) to a prompt file | @foundation/module-contracts.md              |
| Understand the 5 required frontmatter fields  | @foundation/module-contracts.md              |
| Update an existing prompt's contract          | @foundation/module-contracts.md              |
| Understand how prompts reference each other   | @foundation/module-contracts.md (references) |
| Slim frontmatter on a prompt file             | @conventions/frontmatter-slim.md             |

## Authoring Bible Docs

| I need to...                      | Go to                                |
| --------------------------------- | ------------------------------------ |
| Write or update a bible doc       | @conventions/bible-authoring.md      |
| Optimize a doc for AI consumption | @conventions/ai-optimized-writing.md |
| Check if a doc is too large       | @conventions/context-budget.md       |

## Validating Prompts

| I need to...                                | Go to                                           |
| ------------------------------------------- | ----------------------------------------------- |
| Run the prompt convention validator         | `/framework-maintenance` (check mode)           |
| Read the dependency graph between prompts   | @foundation/module-contracts.md (reverse index) |
| Check if a prompt follows sizing guidelines | @foundation/single-concern.md (max sizing)      |
| Verify a prompt's taxonomy type is correct  | @foundation/prompt-taxonomy.md                  |
