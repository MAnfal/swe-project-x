---
id: sops/planning/audit-before-create
description: Verify a deliverable does not already exist before a plan says "create" it
---

# SOP: Audit Existing State Before Specifying "Create"

**When**: a chunk plan includes a "create X" deliverable.

## Procedure

1. For each deliverable, check whether it already exists in the codebase.
2. For anything that might exist, write the plan as "audit and extend if needed" rather
   than "create from scratch".
3. State the finding explicitly in the chunk plan:
   - "This exists at `path/to/thing` — verify it works, extend if needed", or
   - "This does not exist yet — create from scratch."

A plan that says "create X" without checking causes the implementer to over-build:
constructing scripts, config entries, and scaffolding that are already there.

## Origin

An implementer built an entire harness that already existed, because the plan said
"create" and nobody had looked.
