# Bible Authoring

Rules for writing and maintaining bible docs. These apply to every file under `.claude/resources/bibles/`.

## Core Rules

**SRP — one concern per doc.**
If writing a section requires a new heading that doesn't belong to the current concern, stop and create a new leaf file instead. Add an `@/` ref in the relevant index.

**No enumeration of discoverable items.**
Never list specific components, contract keys, config options, bible paths, or any other items that can be discovered by reading the codebase or filesystem. Never count them ("there are 12 of these"). Bible docs document patterns and foundations — inventory becomes stale immediately. If an agent needs a list, it should discover it dynamically (grep, ls, reading the source file). Point to the authoritative source (e.g., "see `PseudoVariantsSchema` in the contract") rather than reproducing its contents.

**No plan, chunk, PR, or tracker references.**
Never write `2026-MM-DD-<slug>` plan slugs, `chunk 03` references, `PR #1234`, or tracker IDs (`VIV-156`) into bible content — not in prose, not in "Evidence:" / "Origin:" lines, not in code-block comments. Plans are ephemeral (active → completed → deleted); a bible naming one ages into a dangling reference the moment the plan directory is removed. PRs and tracker IDs are provenance metadata, not knowledge a future reader can verify against the current codebase. Rewrite evidence as durable technical detail: the file paths involved, the symbol names, what broke, what fixed it. If stripping the plan reference leaves no useful evidence, the "Evidence:" line was carrying provenance, not tribal knowledge — drop it and keep only the rule.

**Router pattern for index files.**
Index files route — they do not teach. But a router still needs labels on its routes. Each `@/` ref should include a one-line annotation (`-- description`) explaining what the reader will find there. Without annotations, the AI has no way to decide which doc to read without opening all of them.

A README (the top-level entry point for a bible domain) can additionally include a title, a 1-2 sentence description, prerequisites, and organized section headers — it's the table of contents, not a bare list.

```markdown
<!-- helpers/index.md — correct: annotations guide routing -->

# Helpers

Helper functions that transform values in binding expressions.

## Contents

- @/helpers/string.md -- capitalize, uppercase, lowercase, trim, truncate, concat, initials
- @/helpers/number.md -- formatNumber, formatNumberWithUnit, math
- @/helpers/property.md -- formatPrice, formatPropertyStatus, formatAreaUnit

<!-- helpers/index.md — WRONG: bare refs with no guidance -->

@/helpers/string.md
@/helpers/number.md

<!-- helpers/index.md — ALSO WRONG: long-form content that belongs in a leaf -->

## How Helpers Work

Helpers are registered at bootstrap via the `registerHelper()` function...
(this content belongs in a leaf doc, not the index)
```

**Self-contained docs.**
Never write "as mentioned above" or "now that you've configured X". Reading order is unpredictable — each doc must be actionable in isolation. If context from another doc is required, state the dependency explicitly: "This doc assumes you've read `foundation/single-concern.md`."

**Examples over prose.**
One concrete example beats three paragraphs of abstract rules. Show the wrong way and the right way side by side.

**Code snippets must cite source.**
Every code snippet that references a codebase symbol or file must include the source path so an agent can verify it's still accurate.

**Exclude-import rules must enumerate side-effects.**
When a bible says "do NOT import X — do Y instead," it MUST also list every implicit side-effect of X that Y does not reproduce. Excluded-import guidance without side-effect documentation creates silent bugs that only surface at runtime.

Failure mode observed: a bible documented "don't import the design system's compiled `/styles` bundle; scope the variables manually instead." The excluded bundle also shipped a universal-selector `border-color` rule from its base layer. With it gone, the CSS framework's preflight zeroed `border` to `0 solid` with no color, so every `border-*` utility rendered as inherited `currentColor`. The build was clean and the type check passed; only an in-browser smoke caught it. The fix was 19 lines — adding the universal-selector rule back, scoped manually.

```markdown
<!-- Good: exclude-import rule with side-effect enumeration -->

## Do NOT import the design system's compiled `/styles` bundle

It writes its aliases onto `:root`, colliding with the host shell.
Use the manual alias-map block (see § Canonical CSS Entry) instead.

**Side-effects you lose by excluding it — reproduce manually:**

- `@layer base { * { border-color: var(--border-subtle); } }` — the universal-selector
  default border color. Without it, every `border-*` utility renders with no color and
  inherits `currentColor`.
- Scrollbar styling (`scrollbar-width`, `scrollbar-color`)
- `outline-color: var(--ring)`
- Smooth scroll behavior

See § Canonical CSS Entry for the verbatim block that reproduces these defaults.

<!-- Bad: exclude-import rule with no side-effect enumeration -->

## Do NOT import the design system's compiled `/styles` bundle

It writes its aliases onto `:root`. Use the manual alias-map instead.

<!-- (silent bug: consumer follows this guidance and their borders break) -->
```

````markdown
<!-- Good: cites source so the snippet can be verified -->

See `.claude/skills/plan-check/SKILL.md` for a reference implementation.

<!-- Bad: unverifiable inline snippet with no source -->

```yaml
name: lint-docs
description: ...
```
````

```

## Structure Checklist

Before creating a new bible doc:

- [ ] One concern only — does this doc have a single, nameable topic?
- [ ] No duplicated content — does any existing doc already cover this?
- [ ] Under 150 lines — if not, split into two docs
- [ ] No YAML frontmatter — bible docs are reference docs, not prompt files
- [ ] At least one concrete example included
- [ ] No component or artifact enumeration
- [ ] No plan slugs, chunk numbers, PR #s, or tracker IDs anywhere in the doc
- [ ] Added to the relevant index file
- [ ] Decision tree updated with a routing row

## Related

- @/foundation/single-concern.md — why single-concern matters for prompts
- @/conventions/context-budget.md — sizing limits for bible docs
```

## Gate-rule self-description sweeps

When adding a new rule to a validation gate (e.g. a `validate-*` skill or its backing script), do **two sweeps** as part of the same change:

1. **Update every artifact that self-describes the gate**: the skill `SKILL.md`, script banners that say "N rules", the authoring bible's rule list/count, any doc that enumerates the checks — so the count and rule set stay consistent.
2. **Confirm the docs' claims about what the gate catches match what the gate actually enforces.** A doc that claims "the gate flags breakpoint prefixes in class-string VALUES" must be false-flagged if the gate only scans object KEYS.

A gate rule and its documentation must be kept in lockstep. Documentation that overclaims enforcement (describes a check the gate doesn't perform) is worse than no documentation — it trains authors to expect protection that doesn't exist.

Failure modes observed: (1) adding a new rule to a validate-* skill's script without touching the playbook header, the skill's `SKILL.md`, or validator comments leaves a "N rules" count scattered across the corpus at the old value — a full-tree grep is the only way to catch every mention. (2) A doc claiming the gate flagged breakpoint prefixes in class-string VALUES was false because the gate only scanned object KEYS — the claim went undetected until an author tripped over the missing protection.

## Universality claims require a quantified scope

Bible claims of the form "every X does Y" or "X is always called at the boundary of every Y" are universally quantified over a set that changes with code motion. True at write-time; false the moment a new member of X is added that does not match the pattern. The claim reads as authoritative in the next reviewer's pass and directly contradicts the code.

**Rule**: universality claims must do ONE of:

1. **Enumerate the exact set** — "``SSGPage``, ``JsonPage``, ``JsonDocument``, ``CSRPage`` all call ``emit()``" so the reviewer can grep the exact set for drift.
2. **Scope the claim** — if the universal is invariant within a bounded architectural contract (not just "all current implementations"), name the contract: "every factory that satisfies the ``RenderFactory`` interface MUST call ``emit()`` before returning."

The construction "as of this writing, every X does Y" is NOT acceptable — it is a dated claim masquerading as a rule. Use the exact-set or contract forms.

Evidence: a claim "every render factory calls ``emitCacheSnapshotAtRenderEnd()`` before returning" was true at time of write but invalidated when CSR-effect-timing producers were added. Required rewriting both ``caching.md`` and ``architecture.md`` to describe SSG/JSON factory-body wiring separately from CSR useEffect wiring.

