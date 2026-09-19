# Recipe: Scaffold Skill with `.tmpl` Templates

When a skill creates many similar files (entity + service + spec +
admin section + …), don't hand-write file contents inside `SKILL.md`
or generate them with sed. Use the three-layer pattern below.

This recipe assumes you've read
[`skill-from-scratch.md`](skill-from-scratch.md) — the structure
here is a specialized form of "Level 2 — Script + AI" with a
templating sub-layer.

## The Three-Layer Architecture

```
SKILL.md         ← orchestrator: validates input, invokes bash, then
                   performs context-dependent edits to existing files
   │
   ▼
scripts/<name>.sh  ← placer: reads .tmpl files, substitutes placeholders,
                     writes new files. Pure file creation. Idempotent.
   │
   ▼
.claude/resources/templates/<domain>/*.tmpl
                   ← file bodies with __PLACEHOLDER__ markers. Read-only
                     at runtime.
```

**Responsibility split:**

| Layer        | Owns                                              | Never does                                          |
| ------------ | ------------------------------------------------- | --------------------------------------------------- |
| `SKILL.md`   | Pre-validation, integration edits to **existing** files | Writes file bodies inline; uses sed for edits        |
| Bash placer  | Creates **new** files from templates              | Touches existing files; embeds large file bodies   |
| `.tmpl` file | The literal content of one generated file         | Logic, conditionals (it's a string-substitution target) |

Why this split: integration edits (insert into an enum, add a
constructor param, wire a provider) land on anchors in files that may
have drifted — a model reading the current file finds the spot more
reliably than sed. File creation, by contrast, is deterministic and
belongs in bash.

**Reference:**
`.claude/skills/plan-scaffold/SKILL.md` is the
canonical example of this pattern; its `scripts/scaffold-design-profile-library.sh`
shows the placer; its templates live in
`.claude/resources/templates/`.

## `.tmpl` vs `.md` Templates

The taxonomy lists Template as one of the eight prompt types
(see [`@/foundation/prompt-taxonomy.md`](../foundation/prompt-taxonomy.md)).
That type splits into two by consumer:

| Extension | Consumed by | Substitution method                          | Example                                      |
| --------- | ----------- | -------------------------------------------- | -------------------------------------------- |
| `.md`     | Claude      | Claude reads the template and fills blanks   | `.claude/resources/templates/chunk.md`  |
| `.tmpl`   | Bash        | Script does literal string replacement       | `.claude/resources/templates/<domain>/entity.tmpl` |

**Use `.md`** when the template is read by Claude and filled with
judgment (a plan, a PR description, a ticket). The template can
contain instructions, examples, and structural hints — Claude
interprets it.

**Use `.tmpl`** when the template is read by a script and filled by
deterministic substitution (an entity class, a SQL migration, a test
spec). The template must be plain text with `__PLACEHOLDER__` markers
and no instructions — every byte ends up in the generated file.

A useful sniff test: if the template includes the literal string
`TODO:` that should appear in the generated file as a breadcrumb,
it's a `.tmpl`. If the template includes guidance for whoever is
filling it in, it's a `.md`.

## Placeholder Convention

`.tmpl` files use `__UPPER_SNAKE__` placeholders. The bash placer
maps a single input (typically kebab-case) to all required casings
before substitution. Example transforms for input `typography`:

| Placeholder         | Value           |
| ------------------- | --------------- |
| `__KEBAB_NAME__`    | `typography`    |
| `__SNAKE_NAME__`    | `typography`    |
| `__PASCAL_NAME__`   | `Typography`    |
| `__CAMEL_NAME__`    | `typography`    |
| `__PASCAL_PLURAL__` | `Typographies`  |
| `__SNAKE_PLURAL__`  | `typographies`  |

The script — not the template — owns the casing transforms.
Templates only declare which casing they want by choosing the right
placeholder.

## Checklist

Before publishing a scaffold-style skill:

- [ ] All file bodies live in `.tmpl` files under `.claude/resources/templates/<domain>/`
- [ ] Bash placer reads templates, substitutes placeholders, writes new files only
- [ ] `SKILL.md` owns pre-validation and integration edits to existing files
- [ ] Integration edits use anchor descriptions ("after the last peer entry"), not line numbers
- [ ] Skill aborts cleanly if the bash placer exits non-zero — partial integration is worse than no integration
- [ ] TODO breadcrumbs in the templates are ordered by dependency in `<on-success>`

## Related

- [`skill-from-scratch.md`](skill-from-scratch.md) — base recipe for any skill
- [`@/foundation/determinism-ladder.md`](../foundation/determinism-ladder.md) — why the bash layer exists
- [`@/foundation/prompt-taxonomy.md`](../foundation/prompt-taxonomy.md) — where Template fits in the eight prompt types
