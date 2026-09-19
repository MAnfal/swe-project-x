# Spec-Driven Development Loop

Three commands, four phases. Brainstorming and plan creation are the same command: the
conversation converges, you approve, and it writes the plan.

```
Brainstorm  →  Plan Creation  →  Execution  →  Delivery
└──── /plan:brainstorm ────┘      :execute     :complete
```

| Phase | Command | Input | Output |
| ----- | ------- | ----- | ------ |
| Brainstorm | `/plan:brainstorm` | A vague idea | An agreed approach, or a parked idea in `plans/ideas/` |
| Plan Creation | ↳ same command, once you approve | An agreed approach | `plans/<date>-<name>/` with SPEC, ORCHESTRATOR, chunks, rubrics |
| Execution | `/plan:execute` | An approved plan | Chunks implemented, reviewed, merged one at a time |
| Delivery | `/plan:complete` | All chunks merged | Final PR, retro, plan archived to `plans/completed/` |

`/plan:list` shows active plans and parked ideas, and owns the numbering the other
three resolve against.

Entry point: **`CLAUDE.md`** at the project root. It loads every session and points here.

## Core ideas

1. **Chunks, not one big change.** Work splits into individually reviewable pieces of ~10
   files or fewer, each holding an ordered task list. A chunk plan is self-contained: an
   agent reading only it and the files it names can execute it.
2. **Sliced by value, not by layer.** Chunks group under prioritized, independently
   testable user stories, so the plan can stop after any story checkpoint and leave
   something demoable. Dependency-ordered plans can't be stopped early — every chunk is
   green and nothing is usable.
3. **The orchestrator is the state.** `ORCHESTRATOR.md` is a resumable state machine. A
   fresh session reads it and knows exactly where things stand.
4. **The implementer never reviews itself.** Work is delegated to subagents through the
   Agent tool — a fresh implementer per chunk, then a separate `code-reviewer` that grades
   against `rubric.md`, which the implementer never sees. Subagents can't nest, so the
   reviewer is always spawned by the lead.
5. **Gates are executable.** Every gate is a command that exits non-zero on failure, and
   it must be proven capable of failing before it's trusted.
6. **Tests are written first and seen failing.** A test that has never been observed red
   is not evidence that it checks anything.
7. **Uncertainty is marked, not guessed.** `[NEEDS CLARIFICATION: …]` in a spec is cheap;
   a plausible guess in a confident voice gets built as a decision. None may survive into
   an approved plan.
8. **Claims get verified, not repeated.** A capped search proves presence, never absence.
   A mechanism you haven't read is a guess.
9. **The loop improves itself.** `retro.md` captures friction during execution;
   `/plan:complete` turns it into edits to these files and facts in `project.md`.

## Where things live

- **`commands/`** — thin routers. They resolve an argument and hand off; no logic.
- **`skills/`** — prompt and shell together. A skill owns its script under `scripts/`, so
  the mechanical half can't drift from the instructions describing it.
- **`resources/prompts/`** — the protocol. Prose only.
- **`resources/templates/`** — the shape of every artifact the loop produces.
- **`resources/sops/`** — procedures. How to carry out one specific operation.
- **`resources/bibles/`** — the knowledge layer. What "good" looks like, durable across
  plans. Prompts say *what to do*, SOPs say *how to do it*, bibles say *what good looks
  like*. Each has a `decision-tree.md` that routes by task — follow it to the leaf page and
  cite that, never the tree.

## Layout

```
.claude/
  commands/plan/     brainstorm, execute, complete, list
  resources/
    project.md       ← FILL THIS IN: principles, stack, commands, conventions
    prompts/
      brainstorm.md  phase 1 — explore, then park or build
      planning.md    phase 2 — the plan, written
      execute.md     phase 3 — the state machine
      completion.md  phase 4 — ship, then close the loop
      preflight.md   run before each wave: do the plan's references still resolve?
      review.md      the implement → review → fix loop
      gates.md       the verification gate set, and how to write one that can fail
      evidence.md    how to establish a fact before acting on it
      rollback.md    a merged chunk broke something
      git.md         branches, commits, PRs
      worktree.md    one worktree per chunk, with plain git — create, bootstrap, use, remove
      fan-in.md      what the lead does when an implementer reports done
      execution-journal.md  when to write to retro.md, and what belongs in it
    sops/            procedures: HOW to do a specific operation
      decision-tree.md      match the task, read the SOP, follow it
      planning/      run during plan authoring (Phase 2.5)
      implementation/ follow during a chunk when the task matches
    bibles/          standards: WHAT GOOD LOOKS LIKE, durable across plans
      README.md      what earns a page, and the provenance every page carries
      swe/           engineering standards — testing, service design, orchestration,
                     comments, migrations. Start at its decision-tree.md
      prompt-engineering/  authoring standards for everything in .claude/ itself —
                     taxonomy, frontmatter, sizing, XML structure, recipes
    templates/       spec, orchestrator, chunk, rubric, completion-report, retro,
                     idea, pr-description
  agents/            implementer + code-reviewer
  skills/
    plan-scaffold/   create a plan or a chunk from the templates
    generate-chunk-rubric/  build a chunk's rubric from the Convention Map
    plan-list/       enumerate and resolve plans and ideas — one numbering,
                     shared by every command that takes a <#>
    plan-check/      validate a plan; the script settles what is mechanically
                     decidable, the skill covers what needs judgment
    plan-retro/      distill the execution journal into patterns
plans/
  <YYYY-MM-DD-name>/ active plan
  ideas/             parked ideas awaiting a plan
  completed/         archived plans — their retros are read before every new plan
```

## Before the first run

1. **Fill in `CLAUDE.md`** at the project root — what the project is, and where the facts
   live. It points at `project.md` rather than restating it; two copies of the stack drift.
2. **Fill in `.claude/resources/project.md`** — *if you already know the stack.* Two
   sections matter most: the **command table**, without which the verification gates
   degrade to nothing, and the **Principles** — the rules every plan is checked against and
   every reviewer can cite.
3. **`git init`** if this isn't a repo yet. The loop's review surface is the diff.

### If you don't know the stack yet

Don't guess it into `project.md`. A confidently-written stack section is cited as authority
by `plan-check`, `generate-chunk-rubric`, and `gates.md`, and a wrong one is worse than an
empty one.

Leave it as placeholders and make **chunk 01 of your first plan the one that writes it** —
scaffold the project, measure what landed, and fill in Stack, Commands, Principles, and the
Convention Map as that chunk's deliverable. This is `planning.md`'s convention-first
ordering applied to the framework's own config: the chunk that establishes a convention
comes first, and later chunks quote it.

Nothing deadlocks on an empty `project.md` — it degrades and says so. `check-prereqs.sh`
never reads it, `gates.md` skips `N/A` commands, `plan-check` Step 3b has no principle to
check against, and `generate-chunk-rubric` announces the empty map instead of emitting a
thin rubric. The cost is real but bounded: **chunk 01 gets the weakest review it will ever
get.** Keep it small, and make chunk 02 onward run against the file it wrote.
