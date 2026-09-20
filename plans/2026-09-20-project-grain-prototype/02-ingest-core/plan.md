---
chunk: 02
title: Ingest core — snapshot schema and deterministic GitHub analysis
branch: feat/project-grain-prototype--ingest-core
base: feat/plan--project-grain-prototype
execution: sequential
depends: [01]
file-limit-waived: true
file-limit-reason: "Tests-first ordering pairs each of five deterministic modules (schema, client, topology, attribution, ingest) with its own spec. Splitting would separate a module from the test that proves it; the captured fixture is generated output."
---

# Chunk 02 — Ingest core

## Context

Everything the canvas renders comes from one artifact: a **snapshot** of a repository's
structure and its pull-request history. This chunk builds the deterministic half of that
artifact — no model calls, no judgment, no interpretation. Given a repository and a time
window, it answers four questions with scripts alone:

1. What apps and packages does this monorepo contain, and which depends on which?
2. Which pull requests merged in this window?
3. Which packages did each pull request touch — directly, and transitively through the
   dependency graph?
4. What are the ordered commits and changed files inside each pull request?

The snapshot is also the contract between this chunk and every chunk after it. Chunk 03
enriches it with model-generated labels, chunk 04 and 05 render it, chunk 06 produces it at
request time. Getting its shape right here is what keeps those from diverging.

**Pull-request identity comes from the GitHub API, not from commit messages.** Parsing
`git log --first-parent` for `Merge pull request #N` or a `(#N)` suffix covers squash and
merge commits and silently misses rebase merges, which leave no merge commit and no PR
number anywhere in the history. `/repos/{owner}/{repo}/pulls` and `/pulls/{n}/commits` are
exact under every merge strategy.

## Acceptance Criteria

- Given a repository identifier and a time window, When ingest runs, Then it returns an
  object that the snapshot schema validates, containing the package topology, the pull
  requests merged in that window, and per-pull-request file and commit detail.
- Given a monorepo with workspace packages, When topology is discovered, Then each app and
  package is a node, and an edge exists from package A to package B when A's manifest
  declares a workspace dependency on B.
- Given a pull request that changed a file inside package A, When attribution runs, Then
  that pull request is recorded as reaching package A **directly**.
- Given a pull request that changed only files inside package B, and package A depends on
  package B, When attribution runs, Then that pull request is recorded as reaching package
  A **indirectly, through B**, and the path is recorded.
- Given the same snapshot inputs, When ingest runs twice, Then the two snapshots are
  byte-identical after serialization — no timestamps, iteration order, or set ordering
  leaks in.
- Given a repository whose pull requests were merged by squash, by merge commit, and by
  rebase, When ingest runs, Then all three appear as pull requests with their commits
  attached.
- Given a malicious or malformed package name from repository content, When it is used as a
  record key, Then it is rejected rather than written.

## What To Do

### 1. The snapshot schema

Define the snapshot as a Zod schema, and derive the TypeScript types from it rather than
declaring them twice. The shape below is the contract; adjust names if the implementation
argues for it, but record the change in the completion report because chunks 03–06 read it.

```ts
// packages: the monorepo's apps and packages, and the dependency edges between them
// pullRequests: one entry per PR merged in the window, with attribution and raw detail
// enrichment:   filled by chunk 03 — OPTIONAL here, keyed by merge SHA
```

Required fields per pull request: number, title, body, author, merged timestamp, merge
commit SHA, the ordered commit SHAs and messages, the changed file paths, the set of
packages reached directly, and the set reached indirectly with the path that reached them.

The `enrichment` field is declared here and left optional. Chunk 03 populates it; chunks
04 and 05 must render a snapshot with it absent.

### 2. Topology discovery

One function, `discoverTopology`, returning `{ nodes, edges }`:

- Nodes come from the workspace directories the repository actually uses. Read the root
  workspace configuration to find them rather than assuming `apps/*` and `packages/*` —
  then fall back to those two if no workspace configuration exists.
- Edges come from each package manifest's dependency fields, filtered to names that match
  another node in this repository. Declared dependencies only; do not scan import
  statements.
- Fetch the file list with one recursive tree request rather than walking directories one
  request at a time.

Do not build a provider or plugin interface around this. One function, one body; a second
ecosystem later replaces the body.

### 3. Pull requests and attribution

- List merged pull requests in the window with pagination, newest first.
- For each, fetch its files and its commits.
- Map each changed file path to the package that owns it by longest matching node path.
- **Direct** = the pull request changed a file inside that package.
- **Indirect** = a package whose dependency closure contains a directly-touched package.
  Record which dependency path reached it; the canvas renders that as "2 via Package 2".
- A package that is both direct and indirect for the same pull request is **direct**.

Compute the closure once per snapshot, not per pull request.

### 4. Boundary validation

Package names and file paths come from repository content and become **object keys** in the
snapshot. Before any of them is used as a key:

- Reject `__proto__`, `constructor`, and `prototype`.
- Build keyed records on null-prototype objects (`Object.create(null)`).
- Reject duplicate package names explicitly rather than letting the later one win.
- Cap the number of packages and pull requests the schema will accept, and fail with a
  message naming the limit rather than silently truncating.

This is a deliverable of the chunk, not an implementation detail to notice later.

### 5. Windowing and bounds

Ingest takes an explicit window and an explicit maximum pull-request count. It never
fetches "everything" — chunk 06 runs this same code inside a request with a rate limit and
a wall-clock ceiling.

### 6. The CLI

A script that takes a repository and a window and writes a snapshot JSON file. This is what
chunk 03 extends to bake the curated repositories, and what produces the committed fixture
this chunk's tests read.

### 7. Fixtures

Capture **real** GitHub API responses for one small window of one of the curated
repositories and commit them. Tests run against those captured responses with the network
stubbed.

Do not hand-author fixture JSON that looks like a GitHub response. Hand-rolled fixtures
exercise only the simple case, and the difference between them and real output is exactly
where the bugs live (`.claude/resources/bibles/swe/testing.md`). Capture, then trim for
size if needed — keep at least one pull request that spans more than one package, and one
whose files sit outside any package.

### Tasks

- [ ] T001 — write failing spec for topology discovery — asserts nodes from workspace
      directories and an edge from a declared workspace dependency; fails because no
      topology module exists
- [ ] T002 — write failing spec for attribution — asserts direct, indirect-with-path, and
      the direct-wins-over-indirect rule; fails because no attribution module exists
- [ ] T003 — write failing spec for boundary validation — asserts a `__proto__` package
      name is rejected and a duplicate name is rejected; fails because no validation exists
- [ ] T004 — write failing spec for determinism — asserts two ingests over the same fixture
      serialize identically; fails because no ingest module exists
- [ ] T005 [P] — create the snapshot schema module — Zod schema plus derived types
- [ ] T006 [P] — create the GitHub client module — authenticated Octokit, pagination, and
      the recursive tree request
- [ ] T007 — create the topology module — `discoverTopology`
- [ ] T008 — create the attribution module — file→package mapping, dependency closure,
      direct and indirect sets
- [ ] T009 — create the ingest entry point — window and bound arguments, returns a
      schema-valid snapshot
- [ ] T010 — capture real API responses into a committed fixture and wire the specs to them
- [ ] T011 — create the ingest CLI script
- [ ] T012 — create `completion-report.md` in this chunk directory

Judgment calls to explain in the completion report:

- You may model indirect attribution as a single path or as every path that reaches the
  package; say which, and why the canvas can render it.
- You may key `enrichment` by merge SHA or by pull-request number; say which, and note that
  chunk 03 and chunk 06 both write it.
- You may cap pull requests by count, by window, or by both; say which and what the default
  is.

Verify every GitHub API call against the installed `@octokit/rest` before relying on it.
Endpoint shapes and pagination helpers change between major versions; where the measurement
contradicts this plan, **the measurement wins** — record it and proceed on what you
observed.

## Test Plan

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |
| Topology spec (T001) | Nodes discovered from workspace layout; edge created from a declared workspace dependency; a non-workspace dependency creates no edge | No topology module exists; the import fails |
| Attribution spec (T002) | Direct attribution, indirect attribution with the reaching path, direct-wins precedence | No attribution module exists |
| Boundary spec (T003) | Reserved key rejection, duplicate package rejection, size cap | No validation exists; the reserved key would land on the record |
| Determinism spec (T004) | Two ingests over one fixture serialize identically | No ingest entry point exists |
| Schema spec | A snapshot missing `enrichment` validates; a snapshot missing a required PR field does not | No schema module exists |

Order: schema and contract specs, then attribution and topology, then determinism over the
whole pipeline. Record the red run's output in the completion report, not just the green
one.

## Reuse Audit

`New: no existing implementation found.` Before writing any helper, search the tree three
ways — by the name it would have, by the algorithm (`closure`, `reachab`, `transitive`), and
by the problem (`package`, `topology`, `workspace`) — and record the result. Chunk 01
introduced no library code, so the expected outcome is "none found"; run the search anyway
and record it, because chunk 01's scaffolder output may include utilities.

## Reference Files

| File | Why |
| ---- | --- |
| `.claude/resources/project.md` | Stack, gate commands, Principles, Convention Map, and where specs live |
| `.claude/resources/bibles/swe/testing.md` | Fixtures must be captured real API output, not hand-authored approximations; assert the resolved value a consumer receives, not the input |
| `.claude/resources/sops/planning/boundary-validation.md` | This chunk turns repository-derived strings into object keys: reject reserved keys, reject duplicates, build on null-prototype objects, cap collection size |

## External Dependencies

- `@octokit/rest` — list merged pull requests, per-PR files and commits, and the recursive
  git tree. Verify endpoint names, pagination helpers and response shapes against the
  installed version.
- `zod` — the snapshot schema and its derived types.
- GitHub REST API — authenticated requests are limited to 5,000 per hour, with secondary
  limits of 900 points per minute and 100 concurrent requests
  (https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api, read
  2026-09-20). Per-PR file and commit requests are the volumetric cost; listing is cheap.

## Verification Gates

Read `.claude/resources/prompts/gates.md` first. Capture a baseline before running anything
that emits errors, and grade the delta.

```bash
bash -s <<'GATE'
set -euo pipefail

# Gate 1 — standard gates from project.md, type check last.
pnpm lint
pnpm test --run
pnpm build
pnpm exec tsc --noEmit

# Gate 2 — the fixture is captured API output, not hand-authored. Assert it carries fields
# a hand-written fixture would not bother to include.
fixture=$(git ls-files | grep -E 'fixtures?/.*\.json$' | head -1)
[ -n "$fixture" ] || { echo "FAIL: no committed fixture found" >&2; exit 1; }
for needle in '"node_id"' '"merge_commit_sha"'; do
  grep -q "$needle" "$fixture" || {
    echo "FAIL: fixture lacks $needle — it does not look like captured API output" >&2
    exit 1; }
done

# Gate 3 — no reserved key can reach a snapshot record. Assert the guard exists as code,
# not as a comment explaining it.
src=$(git ls-files 'src/**/*.ts' 'lib/**/*.ts' | tr '\n' ' ')
hits=$(grep -hE "__proto__" $src | grep -vE '^\s*(//|\*)' | wc -l | tr -d ' ')
[ "$hits" -ge 1 ] || { echo "FAIL: no reserved-key guard in source" >&2; exit 1; }

# Gate 4 — ingest is deterministic. Run the pipeline twice over the fixture and diff.
# Substitute the CLI invocation this chunk actually created.
GATE
```

Complete gate 4 with the CLI this chunk creates: run it twice against the committed
fixture, write both outputs to a temporary directory, and `diff` them. A difference is a
failure.

**Prove each gate can fail.** Run every gate against the base commit and record the exact
command, its exit status, and the failure evidence — the missing module for gates 1 and 4,
the absent fixture for gate 2, the absent guard for gate 3. Run the negative control per
assertion: plant a canary, confirm the gate fires, remove the canary, and confirm the gate
returns clean. Never restore a sabotaged file with `git checkout --`; copy it aside and copy
it back.

## Deliverables

- [ ] `completion-report.md` in this directory, **committed**, written from
      `.claude/resources/templates/completion-report.md`
- [ ] A Zod snapshot schema with derived types, `enrichment` optional
- [ ] Deterministic ingest: topology, merged pull requests, direct and indirect attribution
- [ ] Boundary validation on every repository-derived key
- [ ] A committed fixture of captured GitHub API responses
- [ ] A CLI that writes a snapshot for a repository and window
- [ ] "project.md deltas" section in the completion report listing any architecture fact
      this chunk changed, for the lead to apply at the wave boundary

## Artifacts Checklist

- ☐ New tests for new behavior
- — Existing tests updated (no prior behavior)
- ☐ Docs / conventions updated for changed behavior
- — Generated code re-run (no codegen)
- ☐ `.claude/resources/project.md` — report deltas; do not edit the file in this chunk
