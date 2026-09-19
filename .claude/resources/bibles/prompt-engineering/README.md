---
id: bibles/prompt-engineering/README
description: Authoring standards for everything under .claude/ — prompts, skills, commands, templates, bibles
origin: Imported 2026-09-19 from a prior project's framework bible.
source: Cross-check against https://code.claude.com/docs/en/skills and /slash-commands and /sub-agents before trusting a frontmatter claim; those docs are first-party and move.
---

# Prompt Engineering Bible

Standards and patterns for building AI prompts in this project. Every prompt — skill, command, orchestrator, phase, or reference — follows the principles documented here.

## Quick Start

- @decision-tree.md -- Find the right doc for your task (start here)

## Sections

- @foundation/index.md -- Core principles: determinism ladder, prompt taxonomy, module contracts, single-concern
- @conventions/index.md -- Prescriptive rules: frontmatter, XML structure, sizing, bible authoring, context budget
- @recipes/index.md -- Step-by-step walkthroughs: building skills, commands, orchestrators, phases
- @evolution/index.md -- Meta-docs: adding to the bible, updating existing prompts
