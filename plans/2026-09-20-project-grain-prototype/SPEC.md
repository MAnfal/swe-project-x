# Project Grain — Codeowner Visibility Prototype

## Problem Statement

AI writes most of the code in a large monorepo, and the optimal approach for a package
lives in its codeowner's head rather than in an ADR. When the owner is not in the room,
what ships is not technically wrong — it is reasonable code that is not the approach the
owner would have taken. Diff viewers, linters and review bots all inspect what is *in* a
change, so nothing catches it; the cost sits in what the change didn't do, and in how many
times that gets copied before anyone notices. Grain gives a codeowner a time-scrubbable
map of their domain so the shape of accumulated decisions is visible while it is still
early. It reports; it never blocks, gates, or judges.

## User Stories

### US1 — See how work in my domain got done, over a window of time `[P1]`

**As** the codeowner of a package, **I want** to select a period of time and see which
parts of the monorepo changed, what each change was, and how it was built, **so that** I
can plan with confidence after being away from the code.

**Acceptance Criteria:**

- Given a pre-analyzed repository is selected, When the page loads, Then the monorepo's
  apps and packages render as nodes on an infinite canvas with a time slider spanning the
  repository's history.
- Given a time range is selected, When the canvas renders, Then only packages changed in
  that range are rendered active and every other package is visibly inactive (not by
  colour alone).
- Given a package changed in the range, When its node is read, Then it shows how many
  changes reached it directly and how many reached it through a dependency.
- Given an active package, When it is expanded, Then one node per pull request that
  touched it in the range is revealed, each showing a label, the PR number, author, merge
  date, the packages it spanned, and a one-line note on the approach taken.
- Given a change node, When it is expanded, Then the ordered steps that produced it are
  revealed as a left-to-right chain, each naming its files and the lines it added and
  removed, with the step where the change entered the expanded package marked.
- Given a range containing no activity, When the canvas renders, Then an empty state says
  so rather than rendering an empty canvas.

**Independently testable because:** the pre-analyzed snapshots are committed to the
repository. The whole story demos with no network access, no API tokens, and no model
calls — open the page, pick a repo, scrub.

### US2 — Analyze a repository I choose `[P2]`

**As** a codeowner evaluating the tool, **I want** to point it at a GitHub repository,
**so that** I can see my own domain rather than a curated example.

**Acceptance Criteria:**

- Given the landing page, When `Other…` is chosen from the repository dropdown, Then the
  dropdown is replaced in place by a GitHub repository URL input with a back arrow to its
  left that restores the dropdown.
- Given a valid repository URL, When analysis starts, Then specific progress is reported
  as it proceeds rather than an indeterminate spinner.
- Given analysis completes, When the canvas renders, Then it behaves exactly as it does
  for a pre-analyzed repository.
- Given a change node from a live-analyzed repository, When it is expanded, Then its
  label, approach note and steps are produced on demand and reused for the rest of the
  session without being regenerated.
- Given an invalid URL, a repository that cannot be read, or an exhausted rate limit,
  When analysis is attempted, Then the failure is stated with what went wrong and the
  dropdown remains usable.

**Independently testable because:** it is reached from the same landing page US1 ships,
and demos against any public TypeScript monorepo.

## Clarifications

| Question | Answer | Date |
| -------- | ------ | ---- |
| Squash vs merge vs rebase — can PR boundaries be derived from git alone? | No. Rebase merges leave no merge commit and no PR number. The GitHub API is the single source for PR identity, which removes the gap entirely. | 2026-09-20 |
| Should Level 1 draw dependency edges? | No. Edges are computed (they define transitive attribution) but not rendered by default — a monorepo with every edge drawn is unreadable. They surface as a per-node count and on focus. | 2026-09-20 |
| Does AI sit in the render path? | No. Enrichment is a per-PR pass keyed by merge SHA, baked into curated snapshots ahead of time and generated on demand for live repositories. | 2026-09-20 |
| Which repositories are pre-analyzed? | `xyflow/xyflow`, `shadcn-ui/ui`, `trpc/trpc` — all verified on 2026-09-20 as TypeScript monorepos with a `packages/` directory. | 2026-09-20 |
| Local clone or GitHub API for ingest? | API only. The deployed app has no git binary and no writable filesystem, and a second clone-based path would diverge from the path the demo runs on. | 2026-09-20 |
| Should Level 1 draw dependency edges? (revised) | Yes, but only between touched packages. The mid-fi designs avoid the hairball by dimming untouched packages rather than by hiding edges, which makes indirect reach legible. Supersedes the earlier "computed, never drawn" answer. | 2026-09-20 |
| Does analysis survive a closed tab, or resume a failed step? | No. The prototype analyzes inside one request; a retry restarts. Design copy implying otherwise is rewritten, not implemented. | 2026-09-20 |

## Success Metrics

- Selecting a pre-analyzed repository renders the topology view without any third-party
  network request and without any model call — verifiable by loading the page with
  outbound network blocked.
- Given the same snapshot input, the topology, the set of active packages for a window,
  and the per-package direct/indirect counts are identical on every run — asserted by
  tests over a committed fixture. The snapshot's declared `metadata` block is the only
  part exempt, and it is the only place a timestamp appears.
- For a window in which exactly N pull requests touched a package, expanding that package
  reveals exactly N change nodes, each carrying a label, an approach note, and at least
  one ordered step.
- A live analysis of a repository with no more than 100 pull requests in the selected
  window completes within a single request without exhausting the GitHub rate limit, and
  reports progress at least once per 10 pull requests processed.
- A change node's label, approach note and steps are generated at most once per pull
  request per session; a second expansion of the same node issues no further model call.

## Non-Goals

- **Judging, blocking, or gating changes.** Grain surfaces activity; interpretation is the
  owner's. Nothing in this prototype approves, flags, or fails a change.
- **User-supplied "golden rules" filtering.** The `approach` note this plan captures is the
  substrate that feature would read, but the rules engine itself is out of scope.
- **Conversational AI.** No chat surface over the canvas.
- **Non-TypeScript ecosystems.** Topology discovery targets a TypeScript monorepo with
  workspace packages. Other ecosystems are a later replacement of one function body.
- **Persistent server-side caching, background jobs, and resumable analysis.** Live
  analysis runs inside the request that asked for it and is cached in memory for the life
  of the serving instance. Closing the tab ends the work, and a retry restarts rather than
  resuming. Durable job state is not in scope.
- **Authentication, multi-user state, mobile layouts, and multi-repository comparison.**
- **Temporal (co-change) coupling analysis.** A known-valuable, language-agnostic signal,
  deliberately deferred.
