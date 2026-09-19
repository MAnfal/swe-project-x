---
id: sops/planning/boundary-validation
description: Fail-fast validation where external data becomes keys, or an upstream guarantee is dropped
---

# SOP: Boundary Validation for Shape-Changing Chunks

**When**: a chunk turns request- or source-derived data into object **keys**, or stops
relying on a guarantee some upstream step used to enforce.

## Why this is missed

Both shapes open injection or corruption paths that neither plan review nor ordinary code
review reliably catches — they look like plumbing. In practice they get caught after merge,
by an automated reviewer, rather than before it.

## Class 1 — external data becoming object keys

When a shape changes from a list to a keyed record and the key comes from input, validate
at the service boundary before the keys are used:

- Reject reserved keys (`__proto__`, `constructor`, `prototype`).
- Reject duplicates explicitly rather than letting a later write win silently.
- Build the result on a null-prototype object so a hostile key can't reach the prototype.
- Constrain the collection size at the schema boundary.

## Class 2 — trusting carried-through data

When a chunk consumes data that some earlier step was responsible for regenerating, check
the invariant at the boundary instead of assuming the upstream ran. A stale value that
looks structurally valid is the failure this catches.

## Rule for plan authors

Any chunk doing either of these carries a boundary-validation item in its deliverables. It
is not the implementer's job to notice.
