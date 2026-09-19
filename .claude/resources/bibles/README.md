---
id: bibles/README
description: The knowledge layer — durable engineering and prompt-authoring standards the loop cites as authority
---

# Bibles

**Prompts say what to do. SOPs say how to do an operation. Bibles say what good looks like.**

A bible page is a standard an implementer follows and a reviewer cites. It outlives any one
plan, which is what separates it from `project.md` (facts about *this* project, which change
as the project does) and from a chunk plan (instructions for one piece of work).

## What's here

| Bible | Covers | Start at |
| ----- | ------ | -------- |
| `swe/` | Engineering standards — testing, service design, orchestration, comments, migrations | `swe/decision-tree.md` |
| `prompt-engineering/` | Authoring standards for everything in `.claude/` — prompts, skills, commands, templates, bibles | `prompt-engineering/decision-tree.md` |

## How they get used

Every bible has a `decision-tree.md` that routes by task. **Follow it to the leaf page and
cite that** — never cite the decision-tree itself. A reference to a routing table tells an
implementer where to start looking, not what rule to follow.

- **Brainstorming** (`prompts/brainstorm.md`) — during Explore, check the bible covering the
  area so the approach doesn't contradict a standard before it's written down.
- **Planning** (`prompts/planning.md`) — each chunk's Reference Files cite the leaf pages its
  work touches, with a one-line note on which rule applies.
- **Rubric generation** (`generate-chunk-rubric`) — the Convention Map's `Doc` column points
  here, and the reviewer reads the rule rather than inferring it.
- **Implementation** (`agents/implementer.md`) — the cited pages are read before writing code.
- **Review** (`agents/code-reviewer.md`) — a bible rule is citable as a blocking finding.

## What earns a page

A page earns its place by naming **what it prevents**: a defect that recurred, or a
documented rule that a reasonable default would violate. Content that merely restates
widely-known good practice costs context on every rubric generation and changes no
behaviour — the model already does it.

This matters more here than it looks. `generate-chunk-rubric` turns a `Doc` entry into a
rubric item a reviewer blocks a PR over. That is a high bar for a paragraph to clear.

## Provenance is required

Every page carries, in its frontmatter, where its authority comes from:

- `source:` — the URL and the date it was read, for anything derived from external
  documentation. Docs move and get rewritten; an undated claim about them silently expires.
- `origin:` — the retro, plan, or chunk that produced it, for anything the project learned.

`.claude/resources/prompts/evidence.md` binds these files as much as it binds a plan. A
bible page asserting a mechanism nobody opened is a guess with better formatting.

## Adding one

1. Write the page under the right bible, with `source:` or `origin:` filled in.
2. Add a routing row to that bible's `decision-tree.md` — a page with no row is a page
   nobody will find.
3. If a *kind of file* should always be checked against it, add a `Doc` entry in
   `project.md`'s Convention Map so rubric generation picks it up automatically.

`prompt-engineering/conventions/bible-authoring.md` covers how to write one;
`prompt-engineering/evolution/adding-to-bible.md` covers when a finding is ready to become
one.
