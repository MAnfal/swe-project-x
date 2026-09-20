---
name: generate-chunk-rubric
description: Generate a chunk's rubric.md from its plan — match the files it touches against the project's convention map and inject the right review checks and test expectations. Run after writing each chunk plan.
allowed-tools: Read, Glob, Grep, Write, Edit
---

# Generate Chunk Rubric

<context>
Reads a chunk's `plan.md`, works out which files it touches, matches those against the
convention map in `.claude/resources/project.md`, and writes a complete `rubric.md`.

This exists so review checks are **systematic rather than remembered**. A hand-written
rubric only contains what the planner happened to think of that turn; a generated one
contains whatever the project has declared about the kind of files in the chunk.
</context>

<usage>
/generate-chunk-rubric plans/2026-01-05-some-plan/01-some-chunk
</usage>

## Step 1 — Read the chunk

From `$ARGUMENTS/plan.md`, extract:

- The chunk title from the `# Chunk NN — <Title>` heading
- Every file path it touches — from the Tasks list, the What To Do section, and any
  backticked path or discovery command
- The acceptance criteria

## Step 2 — Match the convention map

Read the **Convention Map** in `.claude/resources/project.md`. For each file path, find
every row whose glob matches. Deduplicate: two files hitting the same row produce one
rubric item.

Each matched row contributes:

- Its **review checks**, as rubric items
- Its **doc** reference, so the reviewer reads the rule rather than inferring it

**The `Doc` column points into `.claude/resources/bibles/`.** Carry the path onto the
rubric item itself, so the reviewer opens the rule instead of grading from memory:

```
- [ ] Interface-first: the contract is its own module and the class implements it
      explicitly — `.claude/resources/bibles/swe/patterns/service-design.md`
```

Cite the **leaf page**, never a bible's `decision-tree.md`. A reviewer handed a routing
table has to go find the rule, and a reviewer who has to go find the rule grades on memory
instead.

If a row's `Doc` is `—`, emit the review check without a citation rather than inventing a
page. If the map is empty or nothing matches, say so in your report rather than silently
producing a thin rubric — an empty map is a project that hasn't declared its conventions
yet, and that is worth knowing.

### When the chunk touches `.claude/` itself

Any chunk editing a prompt, skill, command, template, or bible is governed by the
prompt-engineering bible even when the Convention Map has no row for it. Follow
`.claude/resources/bibles/prompt-engineering/decision-tree.md` to the leaf pages that apply
— frontmatter, sizing, XML structure, taxonomy — and emit them as chunk-specific checks.
This is the one case where you add citations the map didn't supply.

## Step 3 — Derive test expectations

For each file gaining **new behavior** (not a re-export, not a moved line), emit a specific
test item naming the file and the functions:

```
- [ ] Unit tests for `parseConfig()` and `validateConfig()` in `config.spec.ts`
```

Use the project's test-file convention from the Convention Map. One item per file that
gains testable behavior — not one per layer, and not a generic "has tests".

If the chunk adds no testable behavior, write `N/A — <which of types / declarative config /
docs this chunk is>`. An explicit N/A is a grade; a blank is an omission.

**Always emit the constructed-input item** for any chunk with testable behavior, verbatim:

```
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red
```

This one is standing rather than derived. A test drawn from real captured output only ever
contains the cases its source produced, so the guard for the case it didn't produce is
pinned by nothing and deletes green while the suite stays whole. It is the single most
common surviving mutant, and it is invisible to every other item in the rubric.

## Step 4 — Check for plan/rubric contradictions

Before writing, compare the rubric items you are about to emit against the chunk plan's
stated constraints.

A plan that says "do NOT modify X" and an acceptance criterion that implies X must change
is a contradiction, and the rubric is what the reviewer grades — so a rubric that follows
the idealized criterion fails correct work. Resolve toward the plan's constraint and note
why:

```
- [ ] `oldFunction()` is marked deprecated, not deleted (plan constraint: its caller is
      out of scope until chunk 05)
```

## Step 5 — Write it

From `.claude/resources/templates/rubric.md`, into `$ARGUMENTS/rubric.md`:

1. **Title** — the real chunk title
2. **Universal Checks** — copy verbatim. Never edit these; they are the same for every
   chunk by design, and a rubric that trims them is a rubric that decided which
   fundamentals to skip.
3. **Test Coverage Checks** — from step 3
4. **Chunk-Specific Checks** — one per acceptance criterion, plus the convention items
   from step 2, with contradictions resolved per step 4

Report what you injected: which conventions matched, how many test items and chunk-specific
items you generated, and any contradiction you resolved.

## Two rules the generator must not break

**The rubric never references `plan.md`, and `plan.md` never references the rubric.** The
implementer works from one, the reviewer grades against the other. Merging them teaches to
the test.

**Rubric items state the rule, not the example.** "Only properties that differ from the
default" — not "only the horizontal layout deltas" lifted from the plan's sample code. A
reviewer reads the rubric cold; an item that is too literal produces a false FAIL on work
that satisfied the intent.
