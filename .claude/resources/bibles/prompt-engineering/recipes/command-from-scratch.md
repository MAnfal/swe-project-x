# Recipe: Command from Scratch

Commands live in `.claude/commands/` and are invoked via `/namespace:command-name`. There are two patterns — choose based on the command's behavior.

## Which Pattern?

| Pattern      | When to use                                            | Example                                |
| ------------ | ------------------------------------------------------ | -------------------------------------- |
| **Router**   | Command has multiple sub-actions selected by arguments | `/plan:brainstorm`               |
| **Pipeline** | Command runs a fixed sequence of steps                 | `/plan:execute`                      |

---

## Router Command

A router parses the first argument as an **action** and dispatches to the matching route. Each route is self-contained or delegates to a prompt file.

**Reference:** `.claude/commands/plan/brainstorm.md`

### 1. Frontmatter

```yaml
---
description: 'Short description of what the command does'
argument-hint: 'action <args> | other-action'
---
```

- `description` — shown in command listings
- `argument-hint` — shows available actions (displayed as usage hint)

### 2. Input Block

```xml
<input>
Arguments: `$ARGUMENTS`

Parse the first word as the **action**. Remaining words are **extra args**.
</input>
```

### 3. Routes

Define one `<route>` per action inside a `<routes>` block:

```xml
<routes>

<route action="list">
Describe what this action does. Include inline logic for simple actions,
or delegate: "Read and follow `.claude/resources/prompts/<name>.md`."
</route>

<route action="pending">
Read and follow `.claude/resources/prompts/planning.md`.
The text after `pending` is the item filename.
</route>

<route action="*">
Wildcard — matches when no other route matches. Use for the default/interactive behavior.
</route>

</routes>
```

**Key rules:**

- Each route is self-contained — it either does the work inline or delegates to a prompt file
- The `*` route is the fallback — always include one
- Routes that delegate should say "Read and follow `<path>`" explicitly

### 4. Instructions

```xml
<instructions>
Match the parsed action against the routes above.

- Action is `list` → execute the list route.
- Action is `pending` → execute the pending route.
- Action is anything else → execute the `*` (interactive) route.
</instructions>
```

Keep the matching logic simple — a flat if/else mapping action to route.

---

## Pipeline Command

A pipeline runs a fixed sequence of steps, optionally invoking skills and collecting results.

**Reference:** `.claude/commands/plan/execute.md`

### 1. Frontmatter

```yaml
---
description: 'Short description of the pipeline'
---
```

Pipeline commands typically don't need `argument-hint` since they have no sub-actions.

### 2. Context

```xml
<context>
What this pipeline does and why. Explain the overall goal so the AI
understands the purpose behind the sequence of steps.
</context>
```

### 3. Constraints

```xml
<constraints>
- Always invoke skills via the Skill tool — never call scripts directly
- Only include sections with findings — skip clean sections
- Other guardrails specific to this pipeline
</constraints>
```

### 4. Instructions

```xml
<instructions>

## Step 1 — Run checks

Invoke each skill and capture output. Skills with no dependencies
run concurrently:

**Parallel group:**
1. Invoke `skill-a` skill
2. Invoke `skill-b` skill

**Sequential (after parallel completes):**
3. Invoke `skill-c` skill

## Step 2 — Synthesize results

Combine outputs into a single artifact (report file, summary, etc.).

## Step 3 — Report to user

Present findings in a structured format.

</instructions>
```

### 5. Success/Failure

```xml
<on-success>
What to tell the user when the pipeline completes successfully.
</on-success>

<on-failure>
How to handle partial failures — which steps succeeded, which failed,
and what the user should do next.
</on-failure>
```

---

## Checklist

- [ ] Correct pattern chosen (router vs pipeline) based on command behavior
- [ ] Frontmatter has `description` (and `argument-hint` for routers)
- [ ] Router: has `<input>`, `<routes>` with `<route action="*">` fallback, and `<instructions>`
- [ ] Pipeline: has `<context>`, `<constraints>`, `<instructions>`, `<on-success>`, `<on-failure>`
- [ ] Pipeline invokes skills via Skill tool, never calling scripts directly
- [ ] `/framework-maintenance` (check) reports no new warnings

## Related

- @/conventions/xml-structure.md — XML tag conventions
- @/conventions/frontmatter.md — Frontmatter field reference
- @/recipes/skill-from-scratch.md — Building the skills that pipelines invoke
