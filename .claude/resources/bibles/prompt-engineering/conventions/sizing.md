# Sizing Guidelines

Target line counts per prompt type, derived from the single-concern principle. A file that exceeds its hard max likely has more than one concern.

## Target Sizes

| Type               | Target | Hard Max | Rationale                         |
| ------------------ | ------ | -------- | --------------------------------- |
| Router             | 20-40  | 60       | Routing only, no implementation   |
| Phase              | 30-50  | 80       | Single step, self-contained       |
| Skill SKILL.md     | 40-80  | 120      | One capability                    |
| Template           | 40-80  | 120      | Structural pattern                |
| Pipeline           | 50-100 | 150      | Linear flow                       |
| Orchestrator       | ~80    | 120      | Delegates, doesn't implement      |
| Reference          | 80-120 | 150      | Domain knowledge, may need detail |
| Watch/Loop         | 40-80  | 120      | Continuous monitoring             |

## When a File Exceeds Hard Max

Check these in order:

1. **Extract** — Can any section become a separate referenced file?
2. **Externalize** — Can deterministic logic move to a script (Level 1 on the determinism ladder)?
3. **Split** — Is the file doing two jobs that should be two files?

If the answer to all three is "no", the file may legitimately need the extra length (e.g. a reference doc with dense domain knowledge). Document the justification in the file itself.

## Counting Rules

- Count content lines only (exclude YAML frontmatter delimiters and blank lines at EOF)
- XML tags count as content — they carry structural meaning
- Code blocks inside prompts count toward the total
- Inline comments and blank lines within content sections count
