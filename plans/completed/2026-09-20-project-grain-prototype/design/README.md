# Mid-fidelity designs

`mid-fi.pdf` in this directory is the authoritative visual specification for this plan.
**Where it contradicts a chunk plan's description of layout, hierarchy, wording or
interaction, the design wins** — record the contradiction in the completion report so the
plan gets corrected rather than silently diverging.

Open the pages your chunk needs. Do not implement a screen you have not looked at.

| Page | Screen | Chunk |
| ---- | ------ | ----- |
| 1 | Landing card — repository dropdown, pre-analyzed entries with package counts, `Other…` row, `Open canvas` | 04, 06 |
| 2 | Repository field, three states — default select, `Other…` swapped to URL input with back arrow, invalid URL error | 06 |
| 3 | Ingest progress — five named steps, per-step counts, live "just read" list, percentage and estimate | 06 |
| 4 | **Level 1 topology** — lit and dimmed packages, direct/indirect badges, focus mode, legend, minimap, canvas controls | 04 |
| 5 | **Level 2 changes** — package card at left, change cards with the approach note, `Also touched` sidebar, indirect callout | 05 |
| 6 | **Level 3 steps** — ordered step cards with files, line counts, `Open on GitHub`, the "your package" marker and the entry-point note | 05 |
| 7 | Empty state — "Nothing landed in this window", nearest-activity jump, widen presets | 04 |
| 8 | Error states — analysis stopped, repository not found, rate limit spent | 06 |
| 9 | Onboarding tour — four steps, progress rail, replay from the help menu | 05 |
| 10 | **Time slider anatomy** — histogram across the repository's whole life, two handles, presets, hover tooltip, keyboard model, four interaction states | 04 |
| 11 | Light theme of the Level 1 canvas | 04 |

## Decisions the designs settled

These override what the chunk plans said when they were written:

1. **Level 1 draws dependency edges, but only between touched packages.** The plan said
   edges would be computed and never rendered, to avoid a hairball. The designs solve that
   with dimming instead: untouched packages are dimmed and edgeless, and the dashed edge
   from `package-2` into `render-engine` is what makes "2 via package-2" legible. Follow
   the designs.
2. **Level 2 is a card list anchored to the package, not a graph of pull-request nodes.**
   The approach note is a sentence and needs room to be read; cards give it that.
3. **Level 3 marks the step where the change entered the expanded package**, and states it
   in a line beneath the chain. This is derived from the step's files and the package that
   owns them — deterministic, not model output.
4. **Each step shows its files, its added and removed line counts, and a link to GitHub.**
   Line counts come from the pull-request files endpoint.
5. **No background jobs.** The prototype analyzes inside one request. Any copy promising
   that analysis continues after the tab closes, or that a retry resumes from a partially
   fetched step, is out of scope — a retry restarts the analysis. Build the error screen
   from page 8's layout with copy that matches this.

## Conventions visible across every canvas screen

- Amber marks a package touched directly; violet marks one reached through a dependency;
  untouched packages are dimmed with a dashed border — never colour alone.
- The header carries the change count and "N of M packages touched" for the selected range.
- The breadcrumb carries depth (`repo / package / change`) and the level indicator names
  the level and its keyboard affordances.
- The time slider is persistent at the bottom of every canvas screen and drives everything
  above it, at every level.
