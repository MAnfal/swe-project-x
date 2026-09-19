# AI-Optimized Writing

Best practices for writing content consumed by LLMs. Apply these to every bible doc, prompt file, and resource prompt.

## The Filtering Test

For every line in a doc, ask: **"Would removing this cause Claude to make a mistake?"** If no, cut it. This one rule eliminates most bloat.

## Structure

**Use XML tags for semantic boundaries between content types** (in prompt files). Markdown headers organize hierarchy _within_ a section; XML tags separate concerns.

```xml
<!-- Good: semantic boundaries are clear -->
<context>
What this skill does and why.
</context>

<instructions>
The actual work steps.
</instructions>
```

**Bullets for rules, prose only for "why".**
Bullets let Claude parse discrete rules without reading surrounding text. Reserve prose for explanations that need narrative flow.

**Tables for decision matrices and property mappings.**
Tables are token-dense and scannable. Use them for option comparisons, property specs, and when-to-use guides.

| Format      | Use when                             |
| ----------- | ------------------------------------ |
| Bullet      | Discrete rules, checklists           |
| Table       | Decision matrix, property mapping    |
| Prose       | Explaining WHY behind a rule         |
| `<example>` | Concrete demonstrations of a pattern |

## Information Density

**State the WHY behind rules.** Claude generalizes from explanations better than bare commands.

```markdown
<!-- Weak: bare command -->

Don't use `id` in frontmatter.

<!-- Strong: explains why, enables generalization -->

Remove `id` from frontmatter — the file path is the identity. Redundant fields waste tokens on every load.
```

**Omit what Claude already knows.** Don't explain standard language conventions, TypeScript basics, or obvious best practices. Only document project-specific decisions.

**Use file path references over inline code dumps.** When a pattern is fully defined in a source file, point to the file — don't duplicate it.

```markdown
<!-- Good: agent reads on demand -->

See `.claude/commands/plan/brainstorm.md` for a reference router implementation.

<!-- Bad: duplicates content that will drift -->

Here is the full router pattern:
[200 lines of code]
```

## Self-Containment

**No "as mentioned above."** Docs are read in unpredictable order by agents with no shared state. Each doc must be actionable independently.

**No vague qualitative terms.** Replace "important", "clean", "proper" with measurable definitions.

```markdown
<!-- Vague -->

Use a clean frontmatter structure.

<!-- Precise -->

Frontmatter must contain only: description, name, allowed-tools, references.
```

## Redundancy

**Zero redundancy across docs.** Each rule lives in exactly one doc. Other docs reference it. Duplicated rules diverge and create conflicting guidance.

## Examples

Wrap concrete demonstrations in `<example>` tags:

```xml
<example>
<!-- Wrong: causes a prompt-contracts WARN -->
<instructions>
Do the work.
</instructions>

<!-- Correct: context before instructions -->
<context>
What the skill does.
</context>

<instructions>
Do the work.
</instructions>
</example>
```

## Related

- @/conventions/bible-authoring.md — structural rules for bible docs
- @/conventions/context-budget.md — sizing and context window impact
