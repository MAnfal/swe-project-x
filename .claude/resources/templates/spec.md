---
id: templates/spec
description: Template for a plan's SPEC.md
---

# <Plan Title>

## Problem Statement

<1–3 sentences: what's wrong or missing today, and why it matters.>

## User Stories

<!-- Priority order, P1 first. Each story must be INDEPENDENTLY TESTABLE: buildable,
     demoable, and valuable on its own. P1 alone should be worth shipping — that is what
     lets the plan stop early and still leave something that works. A story that is only
     meaningful once a later story lands is not a story; it is a step inside one. -->

### US1 — <Title> `[P1]`

**As** <role>, **I want** <capability>, **so that** <outcome>.

**Acceptance Criteria:**

- Given <state>, When <action>, Then <outcome>
- Given <state>, When <action>, Then <outcome>

**Independently testable because:** <how you would demo this with no later story built>

### US2 — <Title> `[P2]`

…

## Clarifications

<!-- Mark any genuine uncertainty inline, anywhere in this file, as:
     [NEEDS CLARIFICATION: the specific question]
     rather than guessing. Record the resolutions here as they come in.
     ZERO markers may remain when the plan is approved. -->

| Question | Answer | Date |
| -------- | ------ | ---- |

## Success Metrics

<!-- Two rules, both enforced by plan-check:
     1. MEASURABLE — names the observation that settles it, with a number where one
        applies. "Fast" is not a metric; "renders in under 200ms on the sample file" is.
     2. TECHNOLOGY-AGNOSTIC — describes the outcome, not the implementation. "Uses a
        worker thread" is a design decision that wandered into the spec; "stays
        responsive while parsing a 10MB file" is the thing you actually wanted. -->

- <Measurable, technology-agnostic outcome>

## Non-Goals

- <What this explicitly does not do, and why>
