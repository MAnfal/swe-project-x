---
id: bibles/swe/decision-tree
description: Routing table for the engineering bible — match the task, read the leaf page, follow it
---

# SWE Bible — Decision Tree

Find your scenario, read the leaf page. **Cite the leaf page, never this table** — a
reference to a routing table tells someone where to start looking, not what rule to follow.

## Testing

| I need to… | Read |
| ---------- | ---- |
| Test code that transforms a third-party library's generated output | `testing.md` |
| Decide whether a hand-written fixture is good enough | `testing.md` |
| Prove a refactor changed no behaviour | `patterns/migration-verification.md` |

## Service and module design

| I need to… | Read |
| ---------- | ---- |
| Design a new service or module with a public API | `patterns/service-design.md` |
| Decide where an interface lives | `patterns/service-design.md` |
| Make an implementation substitutable | `patterns/service-design.md` |
| Decide what a method should return | `patterns/service-design.md` |

## Pipelines and orchestration

| I need to… | Read |
| ---------- | ---- |
| Write an orchestrator, pipeline controller, or workflow coordinator | `patterns/orchestrator-pattern.md` |
| Decide whether logic belongs in the orchestrator or a step | `patterns/orchestrator-pattern.md` |
| Handle a fire-and-forget side effect | `patterns/orchestrator-pattern.md` |

## Migrations and contract changes

| I need to… | Read |
| ---------- | ---- |
| Change a contract shape across many consumers without behaviour drift | `patterns/migration-oracle.md` |
| Sequence a migration so the build stays green throughout | `patterns/migration-oracle.md` |
| Prove the ported code behaves identically to the original | `patterns/migration-verification.md` |

## Code quality

| I need to… | Read |
| ---------- | ---- |
| Decide whether a comment earns its place | `code-comments.md` |
| Avoid comments that go stale | `code-comments.md` |

## What is deliberately not here

**Generic engineering principles — SOLID, DRY, KISS, YAGNI, the testing pyramid — are not
written down in this bible.** They are already the model's default behaviour, and a page
restating them costs context on every rubric generation while changing nothing. The
project's own non-negotiables live in `project.md`'s Principles, which is where a reviewer
cites them from.

**Stack-specific standards are added when the stack is chosen** — language-level typing
rules, framework conventions, build and packaging shapes. Add them under
`swe/<language>/` or `swe/<framework>/` with a routing row here, once there is a stack to
be specific about.

## Adding a page

See `.claude/resources/bibles/README.md` § "What earns a page" — a page justifies itself by
naming the defect it prevents, and carries `source:` or `origin:` provenance. Then add its
routing row above; a page with no row is a page nobody will find.
