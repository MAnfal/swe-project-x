# Adding to the Bible

When you discover a new pattern, principle, or convention during execution, follow this process to codify it so future work benefits.

## 1. Identify the New Pattern

A pattern is worth codifying when:

- You've applied it successfully in 2+ prompts or skills
- It prevents a class of errors you've encountered
- It changes how prompts should be structured or evaluated
- It's not obvious from reading existing documentation

**Not worth codifying:** one-off fixes, project-specific workarounds, patterns already covered by existing docs.

## 2. Determine Where It Belongs

| Category        | What goes here                                  | Directory      |
| --------------- | ----------------------------------------------- | -------------- |
| **Foundation**  | Core concepts, determinism ladder, prompt types | `foundation/`  |
| **Conventions** | XML structure, frontmatter rules, naming        | `conventions/` |
| **Recipes**     | Step-by-step "how to build X" walkthroughs      | `recipes/`     |
| **Evolution**   | Meta-docs about evolving the bible itself       | `evolution/`   |

If it doesn't fit any existing category, consider whether a new section is warranted — but prefer extending an existing section over creating a new one.

## 3. Write the Doc

Follow the formatting conventions of sibling documents in the same directory:

- **Foundation docs** — conceptual, explain the "why"
- **Convention docs** — prescriptive, show the "what" with examples
- **Recipe docs** — walkthrough style, numbered steps, checklist at the end
- **Index files** — `@/` refs only, no prose

## 4. Update the Decision Tree

Add a new "I need to..." row to `foundation/decision-tree.md` pointing to your new doc. The decision tree is how developers find the right doc — if it's not there, the doc won't be discovered.

## 5. Update the Index

Add an `@/` ref to the relevant `index.md` file. Index files contain ONLY refs — no prose, no descriptions.

## 6. Validate

Run `/framework-maintenance` (check mode) to ensure the new doc follows XML and frontmatter conventions (if applicable). Check that all `@/` refs in index files resolve to existing files.

## 7. Propagate If Needed

If the new standard affects existing prompts (e.g., a new required frontmatter field):

1. Identify all affected prompts — grep for the pattern being changed
2. If fewer than 10 prompts affected — update them in the same PR
3. If 10+ prompts affected — create a pending item in `sdd-plans/pending/local/` describing which prompts need updating and why

**Reference:** @/evolution/updating-existing-prompts.md for the full propagation process.

## Checklist

- [ ] Pattern is proven (2+ successful applications, not speculative)
- [ ] Placed in the correct category (foundation/conventions/recipes/evolution)
- [ ] Follows formatting conventions of sibling docs
- [ ] Decision tree updated with a new "I need to..." row
- [ ] Relevant index.md updated with `@/` ref
- [ ] `/framework-maintenance` (check) reports no new warnings
- [ ] Propagation plan created if existing prompts are affected
