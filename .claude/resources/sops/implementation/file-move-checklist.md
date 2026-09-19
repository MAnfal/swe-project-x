---
id: sops/implementation/file-move-checklist
description: What to update after moving or renaming files, beyond what the IDE catches
---

# SOP: File Move / Rename Checklist

**When**: a chunk moves, renames, or extracts files.

Import-aware tooling catches `import` statements and nothing else. These are what it misses.

## 1. Mock paths taking a string argument

Test mocks reference modules by string, so no import-based refactor touches them:

```bash
grep -rn "mock(.*old/path" src/ --include='*.test.*' --include='*.spec.*'
```

A stale mock path usually fails at run time in a *different* chunk, which is what makes it
expensive.

## 2. Every consumer, not just the neighbours

Grep for all of them — sibling render paths, factories, integration tests, and any barrel
or index file re-exporting from the old location.

## 3. Ported tests

A moved or deleted test file has its cases ported in the **same chunk**. A deleted test
with no replacement is a coverage regression that no gate reports, because the gate only
sees the tests that still exist.

## Origin

Recurring across file-move chunks: mock paths went stale, and consumers in sibling files
were missed — both surfacing only at test time, chunks later.
