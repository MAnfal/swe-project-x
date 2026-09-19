# Context Budget

Every doc loaded into an agent's context window competes for attention. Oversized docs waste tokens, slow responses, and bury critical instructions in the middle where LLMs perform worst.

## Size Limits

| Doc type                     | Limit                         | Rationale                                                |
| ---------------------------- | ----------------------------- | -------------------------------------------------------- |
| `CLAUDE.md` (always-loaded)  | ≤80 lines                     | Paid on every conversation — each line has constant cost |
| Bible leaf docs              | ≤150 lines                    | Loaded on demand but still compete for context budget    |
| Prompt files (skills/phases) | See `@/conventions/sizing.md` | Governed by prompt sizing guidelines                     |

**Counting:** Count content lines only. Exclude YAML frontmatter delimiters and trailing blank lines.

## The Filtering Test

For every line: **"Would removing this cause Claude to make a mistake?"**  
If no — cut it. This applies to both content and structure (headers, blank lines, repeated rules).

## Inline vs Reference

**Inline content** when:

- Under 10 lines
- Required to understand the current doc (removing it creates a gap)
- No existing doc covers it better

**Reference another file** when:

- Over 10 lines
- Tangential or supplementary detail
- Already documented elsewhere

````markdown
<!-- Good: reference, not inline dump -->

See `.claude/skills/plan-check/SKILL.md` for the full implementation pattern.

<!-- Bad: inlines 30 lines that already live in another file -->

```yaml
[full SKILL.md contents duplicated here]
```
````

```

## `@` Imports vs File Path References

| Mechanism          | When loaded           | Use for                                          |
| ------------------ | --------------------- | ------------------------------------------------ |
| `@path` import     | Always, every session | Essential context needed before any task starts  |
| File path ref      | On demand via Read    | Supplementary detail the agent pulls when needed |

**Keep `@` imports to the minimum necessary.** Every `@` import runs on every conversation. A `CLAUDE.md` with 20 `@` imports loads 20 files unconditionally.

## Prompt Cache TTL

The Claude API caches prompt context for **5 minutes**. Agents that complete a full turn within this window share the cache — the first agent pays to load a doc, subsequent agents within 5 minutes get it for free.

**Practical implication:** Docs loaded together frequently should stay together in the same file. Fragmentation into many small files forces more reads but doesn't improve cache efficiency.

## When a Doc Exceeds 150 Lines

1. **Extract** — Can a section become a separate leaf with a reference?
2. **Cut** — Does every line pass the filtering test?
3. **Split** — Is the doc covering two concerns that should be two files?

If all three are "no", the doc may legitimately need the length. Document the justification inline.

## Related

- @/conventions/bible-authoring.md — structural rules for bible docs
- @/conventions/sizing.md — prompt file sizing guidelines (separate from bible docs)
```
