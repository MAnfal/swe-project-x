# Composition at Scale

How bible docs and prompt files reference each other. These rules prevent reference chains that require reading 5+ files to understand one concept.

## Reference Depth Limit

**Maximum 3 hops.** If understanding concept A requires reading A → B → C → D, flatten the chain. Either inline the critical content from D into A, or restructure so the concept lives at a shallower depth.

```
A → B → C          ✓  (3 hops — acceptable)
A → B → C → D      ✗  (4 hops — too deep, flatten)
```

## Two Reference Mechanisms

### `@` Imports — Always Loaded

Use `@` imports only for content the agent needs before any task starts. Every `@` import runs on every conversation — it's always in context, always consuming tokens.

```markdown
<!-- CLAUDE.md — appropriate use -->

@decision-tree.md ← agent always needs this routing doc

<!-- index.md — appropriate use -->

@/foundation/single-concern.md ← always loaded as part of foundation
```

**When to use `@`:**

- Content that is essential context, not supplementary detail
- Routing docs that help the agent find the right leaf
- Rules that apply to every task in the domain

### File Path References — Read on Demand

Use file path references for detail the agent can pull when needed. The agent uses the Read tool when it encounters the reference.

```markdown
See `.claude/skills/plan-check/SKILL.md` for a reference implementation.
```

**When to use file path refs:**

- Implementation examples and reference implementations
- Supplementary context the agent might not need
- Large docs that would bloat always-loaded context

## Index Files Are Routers

Index files contain only `@/` refs — no prose, no descriptions. Their job is to make a directory's contents discoverable, not to document them.

```markdown
<!-- conventions/index.md — correct: pure router -->

@/frontmatter.md
@/xml-structure.md
@/bible-authoring.md

<!-- conventions/index.md — WRONG: content in router -->

## Frontmatter

@/frontmatter.md
Controls how prompt files declare their contract.
```

## No Circular References

If doc A references doc B, doc B must not reference doc A. The dependency graph must be acyclic. The `dependency-graph` guard enforces this for prompt files — apply the same discipline to bible docs manually.

## Progressive Disclosure

Start with the routing doc (`decision-tree.md`), let the agent pull detail as needed:

1. Agent reads `decision-tree.md` — finds the right doc for the task
2. Agent reads the specific leaf — gets the actionable rules
3. Agent reads referenced examples/implementations — only if needed

This keeps the always-loaded context minimal and lets agents self-select what they actually need.

## Naming Conventions as Signals

Folder structure communicates intent without requiring the agent to read every file:

| Directory      | Content type                                    |
| -------------- | ----------------------------------------------- |
| `foundation/`  | Core concepts — why things work the way they do |
| `conventions/` | Prescriptive rules — what to do and how         |
| `recipes/`     | Step-by-step walkthroughs for common tasks      |
| `evolution/`   | Meta-docs about changing the bible itself       |

## Related

- @/conventions/context-budget.md — sizing and `@` import costs
- @/conventions/bible-authoring.md — structural rules for individual docs
