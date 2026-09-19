---
id: bibles/swe/code-comments
description: What belongs in a code comment, and which references go stale the moment they are written
origin: Imported 2026-09-19 from a prior project's framework bible. Each section traces to a defect that shipped more than once.
---

# Code Comments

## No plan or ticket references

Code comments must never reference plan chunks, ticket numbers, PR numbers, or internal planning artifacts ("see chunk 11", "added for issue #123", "part of PR #456"). These rot immediately as plans close and tickets archive. Comments should explain **why** — the constraint, invariant, or non-obvious reason behind the code.

```typescript
// BAD — references a planning artifact
// Added for the nested-scope plan, chunk 03
const scopePath = [...parentScope, nodeId];

// BAD — references a ticket
// Fix for PROJ-142: nested styles not resolving

// GOOD — explains the why
// Append to the parent scope so nested nodes build the correct theme key path
const scopePath = [...parentScope, nodeId];
```

## When to write comments

Default to no comments. Only add one when the **why** is non-obvious: a hidden constraint, a subtle invariant, a workaround for a specific bug, or behavior that would surprise a reader. If removing the comment wouldn't confuse a future reader, don't write it.
