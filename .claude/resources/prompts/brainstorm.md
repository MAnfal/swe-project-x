---
id: prompts/brainstorm
description: Phase 1 — shape a vague idea into an agreed approach, then hand off to planning or park it
produces:
  - An agreed approach handed to prompts/planning.md, OR a parked idea in plans/ideas/
references:
  - prompts/planning.md
  - templates/idea.md
---

# Phase 1 — Brainstorm

An interactive session that turns a vague idea into something concrete enough to plan.

<context>

Don't jump to solutions. Listen first, ask questions, explore the problem together. The
user may not know exactly what they want yet — helping them figure that out is the job.

</context>

<input>

**seed** (optional): text from the caller, or the contents of a parked idea file. If
absent, ask the user what they're thinking about.

**idea_file** (optional): path under `plans/ideas/` the seed came from. Used for
parking updates and for deletion once a plan is written.

</input>

<constraints>

- Do NOT write plan files until the user explicitly approves. Look for "let's do it",
  "build the plan", "go ahead", "write it up".
- Until then, stay in conversation. The user may want to keep iterating.
- Do NOT propose solutions during the Listen phase.
- Do NOT use `EnterPlanMode` / `ExitPlanMode` — this runs in normal mode.
- This phase produces a plan or a parked idea. It never produces implementation.
- **Mark uncertainty, don't resolve it silently.** When something genuinely can't be
  settled from the code or the conversation, say so and ask. Anything still open when the
  plan gets written goes in as `[NEEDS CLARIFICATION: <question>]` — a plausible guess
  written in a confident voice reads as a decision and gets built as one.
- **When the user pushes back twice on the same conclusion, go get evidence** before
  responding again. Read the code, fetch the library's actual docs, check the installed
  version on disk. A second pushback means the user holds context the conversation is
  missing; defending the prior position with the same evidence wastes the signal.

</constraints>

<phases>

<phase name="Listen">

1. Use the seed if there is one; otherwise ask what they're thinking about.
2. Ask clarifying questions: What problem is this solving? Who is affected? What does
   success look like? What constraints exist (time, scope, dependencies)?
3. Do not propose solutions yet.

</phase>

<phase name="Explore">

1. Research the current state — read the relevant code, check `.claude/resources/project.md`,
   skim the retros in `plans/completed/` for prior art.
2. **Check the standards before the approach hardens.** Read
   `.claude/resources/bibles/README.md`, follow the decision-tree of whichever bible covers
   this area, and read the leaf pages that apply. An approach agreed here becomes the plan;
   a standard discovered at review time costs a rework cycle, and one discovered after
   delivery costs a follow-up plan.

   Two bibles exist. `swe/` covers engineering — service and module design, orchestration,
   testing, migrations, comments. `prompt-engineering/` covers anything that changes
   `.claude/` itself, which includes this framework's own prompts, skills and templates.
3. Report what you found: "Here's how this works today…" — and name any standard that
   constrains the shape of the answer, with the page it came from.
4. Propose 2–3 approaches when there are meaningful alternatives, with tradeoffs. An
   approach that contradicts a bible page is not an option to present neutrally: say which
   rule it breaks, and either drop it or carry the justification forward into the plan's
   Design Decisions.
5. Keep asking as the idea sharpens.

</phase>

<phase name="Converge">

1. Summarize the agreed approach in a few bullets.
2. Identify the chunks of work it would take.
3. Call out risks and unknowns.
4. **Blast radius check.** Before presenting, grep for what the change will break —
   renamed symbols, changed interfaces, removed fields, moved files. Name the files and
   the nature of the breakage, then ask whether fixing them is in scope or separate. If
   separate, that goes in the SPEC's Non-Goals, along with the fact that the project may
   not build until the follow-up lands.
5. Present exactly this shape:

   **Proposed approach:**
   - …

   **Risks / unknowns:**
   - …

   **High-leverage addition:**
   - **What:** the single most valuable thing you could add to this plan, in one sentence
   - **Why:** the disproportionate value it delivers
   - **How it fits:** which chunk it slots into, or whether it's a new one

   "Do you want to incorporate the high-leverage addition before we finalize?"

### Design bias: start flat

Prefer standalone functions and plain objects over class hierarchies and layered
abstractions in an initial design. Complexity is cheap to add later and expensive to
remove mid-plan. If an abstraction is genuinely needed, it goes in the ORCHESTRATOR's
Design Decisions with explicit justification — never as a default shape.

### "Follow X's pattern" is incomplete on its own

Saying "model it after X" must also say **where the new code lives** (a new sibling
module, or inside the existing one) and **whether the runtime mechanics actually
transfer**. Same-looking code can behave differently under a different loader, runtime,
or config path. Check the mechanism, not just the file shape.

</phase>

<phase name="Decide">

If the seed came from a parked idea, it's already parked — go straight to Build once the
user is happy. Otherwise present both paths with neutral framing:

"Two options from here:
1. **Build the plan** — I'll generate SPEC, ORCHESTRATOR, and chunks
2. **Park it** — I'll save everything we discussed for later

Which would you like?"

If the answer is ambiguous ("sounds good", "wrap it up"), ask which one. Don't guess.

</phase>

<phase name="Park" trigger="user wants to set it aside">

The parked file is the archive of this conversation — a future session reads it as its
seed, so thin content means a cold start later. Nothing discussed should be lost.

- **Idea came from `plans/ideas/`**: append a `## Brainstorm Notes — <YYYY-MM-DD>`
  section to the existing file with the findings, decisions, and open questions. Do not
  delete it.
- **Free-form idea**: write `plans/ideas/<kebab-case-name>.md` from
  `.claude/resources/templates/idea.md`. Copy the template's *content*, not its header —
  the `id: templates/idea` block is the framework's own bookkeeping, and the idea file's
  real frontmatter is the `created`/`priority` block below it. Fill every section: the problem as the user
  framed it, every piece of evidence gathered (file paths, existing patterns, prior art),
  every approach considered including rejected ones and why, and the open risks.

</phase>

<phase name="Build" trigger="user approves planning">

1. Read `.claude/resources/prompts/planning.md` and follow it. The conversation is the
   source material — skip its Phase 1 discovery, you already did it.
2. When the plan files are written, delete the consumed idea file if there was one:
   `rm <idea_file>`
3. **Stop there.** Planning ends when the plan is written and presented. Execution is a
   separate command in a separate session.

</phase>

</phases>

<on-failure case="the idea is infeasible">

1. Explain why, with specific evidence from the code.
2. Propose the closest feasible alternative if one exists.
3. Ask whether to pivot or drop it.

</on-failure>
