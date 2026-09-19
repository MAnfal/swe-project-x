# Prompt Taxonomy

Every prompt in this project falls into one of 8 types. Knowing the type determines the structure, sizing, and conventions a prompt must follow.

## The 8 Types

| Type         | Example                                | Key Traits                                       | When to Use                                    |
| ------------ | -------------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| Router       | `plan.md`, `dev.md`                    | Parses `$ARGUMENTS`, delegates via `<routes>`    | Entry point that dispatches to sub-prompts     |
| Pipeline     | `scaffold.md`                          | Single-flow, step-by-step execution              | Linear task with clear sequential steps        |
| Orchestrator | `setup.md`, `create-execution-plan.md` | Coordinates phases, reads sub-prompts at runtime | Multi-phase work requiring delegation          |
| Phase        | `phases/00-config.md`                  | Single step, self-contained                      | One step in a multi-phase flow                 |
| Skill        | `lint-check`, `plan-analyze`           | `SKILL.md` + optional scripts in `scripts/`      | Standalone capability invoked by name          |
| Reference    | `gather-website-data.md`               | Knowledge or procedure for a specific domain     | Step-by-step guide for a specific task         |
| Template     | `orchestrator.md`, `chunk.md`          | Fill-in-the-blank for generated artifacts        | Pattern for artifacts created by other prompts |
| Watch/Loop   | `explorer-watch.md`                    | Continuous monitoring, uses `<loop>` tag         | Long-running observation/reaction cycle        |

## Invocation Form: Commands ≡ Skills

The 8 types describe a prompt's **structure and role** — they are independent of how it is *invoked*.

Claude Code treats **commands and skills as the same kind for invocation**: both are entry points invoked by name (`/plan:execute`, or a skill called by name). The historical "command vs. skill" split is a packaging detail, not an invocation difference — a Router or Pipeline may ship as either. Prefer skills for new capabilities: they bundle logic + scripts and are the modern form.

`resources/prompts/` are **not invocable**. They are the shared-resource layer — read-and-followed by an invocable entry point or another resource, never called by name. A Phase, Reference, or Template lives here and runs only when something reads it.

So: pick the structural type from the 8 above; pick the *form* (skill vs. command) by packaging, knowing the two invoke identically; and remember `resources/` prompts are pulled in, not fired.

## How to Choose

1. **Does it dispatch to other prompts based on arguments?** → Router
2. **Does it run a linear sequence of steps itself?** → Pipeline
3. **Does it coordinate multiple phases, reading sub-prompts?** → Orchestrator
4. **Is it one step inside an orchestrator?** → Phase
5. **Is it a standalone capability with its own `SKILL.md`?** → Skill
6. **Does it document a procedure without executing it?** → Reference
7. **Is it a pattern for generating other files?** → Template
8. **Does it run continuously, watching for events?** → Watch/Loop

## Conventions by Type

- **Routers** must have a `<routes>` block mapping arguments to sub-prompts
- **Orchestrators** must have `<instructions>` with phase references and `<on-success>`/`<on-failure>`
- **Phases** must have `<context>`, `<instructions>`, `<on-success>`, `<on-failure>`
- **Skills** must have YAML frontmatter (`name`, `description`, `allowed-tools`) and `<context>`/`<instructions>`
- **Templates** use placeholder syntax for variable substitution
- **Watch/Loop** prompts must have a `<loop>` block defining the observation cycle
