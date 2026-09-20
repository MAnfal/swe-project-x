---
chunk: 01
title: Boilerplate — Next.js app, dependencies, gates, project facts
branch: feat/project-grain-prototype--boilerplate
base: feat/plan--project-grain-prototype
execution: sequential
depends: []
file-limit-waived: false
file-limit-reason: "Scaffolder output (create-next-app, shadcn init) is generated and does not count toward the limit."
---

# Chunk 01 — Boilerplate

## Context

The repository is empty: one commit, no `package.json`, no source tree, and
`.claude/resources/project.md` is entirely placeholders. Nothing in the plan can be built,
type-checked, tested or reviewed until a runnable project exists and the verification gates
have real commands behind them.

This chunk creates **only** the boilerplate. No product code: no ingest, no canvas, no
snapshot schema, no API routes. Its deliverable is a Next.js application that starts, a
dependency set every later chunk relies on, four gate commands that have been run and
recorded, and a `project.md` that is true.

Every later chunk reads `project.md` for its commands and conventions, and
`generate-chunk-rubric` reads its Convention Map to build the review checks for chunks
02–06. A thin or inaccurate `project.md` here degrades every review that follows.

## Acceptance Criteria

- Given a clean checkout, When install and `dev` are run, Then a Next.js page serves
  locally on the documented port.
- Given the project, When each of the type check, lint, unit test and build commands is
  run, Then each exits zero and the exact invocation is recorded in `project.md`.
- Given a spec file placed where the project's test convention says specs live, When the
  unit test command runs, Then that spec is discovered and executed.
- Given `project.md`, When it is read, Then its Stack, Commands, Principles, Convention Map
  and Layout sections describe what is actually on disk, with versions read from the
  installed packages rather than from manifest ranges.
- Given the repository, When `git status` is run after an install, Then no dependency
  directory, build output, or environment file is untracked-and-unignored.

## What To Do

Work from the repository root.

### 1. Scaffold the application

Use the official scaffolder rather than hand-writing config:

```bash
pnpm dlx create-next-app@latest . --typescript --tailwind --eslint --app \
  --src-dir --import-alias "@/*" --use-pnpm
```

Answer its prompts for anything it asks that the flags do not cover. It will refuse to
write into a non-empty directory unless told otherwise — if so, scaffold into a temporary
directory and move the contents in, preserving the existing `.claude/`, `plans/`,
`CLAUDE.md` and `.git/`.

**Verify what it produced rather than assuming.** Scaffolder output changes between
versions: read the generated `package.json`, `tsconfig.json`, and the directory layout, and
write `project.md` from what is actually there.

### 2. Add the dependencies later chunks need

These were checked against the npm registry on 2026-09-20; install the current versions and
record what resolves rather than pinning these numbers blindly.

| Package | Version seen 2026-09-20 | Used by |
| ------- | ----------------------- | ------- |
| `@xyflow/react` | 12.11.6 | canvas (chunks 04, 05) |
| `@dagrejs/dagre` | 3.1.1 | graph layout (chunk 04) |
| `@octokit/rest` | 22.0.1 | GitHub ingest (chunks 02, 06) |
| `zod` | 4.6.5 | snapshot schema, model output schema (02, 03) |
| `ai` | 7.0.107 | model calls (chunks 03, 06) |
| `@ai-sdk/anthropic` | 4.0.58 | Anthropic provider (chunks 03, 06) |
| `vitest` | 5.0.1 | unit tests (all chunks) |

Add `@types/dagre` only if `@dagrejs/dagre` does not ship its own types — check
`node_modules/@dagrejs/dagre/package.json` for a `types` field before adding a redundant
types package.

Initialize shadcn/ui with its own CLI (`pnpm dlx shadcn@latest init`) and add only the
primitives later chunks need: `button`, `select`, `slider`, `badge`, `card`, `dialog`,
`input`. Do not hand-write these components.

### 3. Wire the test runner

Configure Vitest so that:

- it resolves the `@/*` import alias the same way `tsconfig.json` does,
- its include pattern matches the location this project will keep specs in, and
- that location is written into `project.md` under **Test file convention**.

Check the include pattern against a real file — a spec the runner never matches passes by
not running.

### 4. Scripts and ignores

Add `package.json` scripts for type check, lint, test and build. Check what
`create-next-app` already generated before adding anything: `lint` and `build` will exist.
Do not duplicate a script the scaffolder shipped.

Extend `.gitignore` for dependency directories, build output, test coverage, and
environment files. `.gitignore` currently contains only `.worktrees/` — append, do not
replace.

Add `.env.example` documenting the two variables later chunks read, with **empty values**:

```
GITHUB_TOKEN=
ANTHROPIC_API_KEY=
```

`.env.example` is committed. `.env`, `.env.local` and friends are ignored and never
committed.

### 5. Write `project.md`

Fill in, from measurement:

- **Stack** — language, runtime, framework, package manager, test framework, each with the
  version resolved on disk and the date read. Read versions from the installed packages
  (`node_modules/<pkg>/package.json`), not from the ranges in `package.json`.
- **Commands** — the exact invocation for Install, Bootstrap a fresh worktree, Type check,
  Lint, Unit tests, Build, and Run the app. Run each one before writing it down. Mark
  anything that genuinely does not exist as `N/A`.
- **Principles** — five or six rules a reviewer would block a PR over. They are this plan's
  constitution and every later chunk is graded against them. Derive them from the plan's
  Design Decisions rather than inventing generic advice; at minimum they must forbid:
  secrets reaching the client, a model call in the render path, a request-time dependency
  on a writable filesystem or a git subprocess, and hand-authored data fixtures standing in
  for captured ingest output.
- **Convention Map** — a row per kind of file this project will contain: React components,
  library modules under `lib/`, route handlers, test specs, and snapshot data files. Each
  row names the gates it runs and the review checks that apply. Cite
  `.claude/resources/bibles/swe/testing.md` on the rows covering test specs and snapshot
  data files.
- **Layout** — the directory tree as it now exists, with one line on what belongs where.

### Tasks

- [ ] T001 — write failing spec at the project's chosen spec location, asserting that a
      module imported through the `@/*` alias returns its expected value — fails today
      because there is no runner, no alias resolution, and no module
- [ ] T002 — run `pnpm dlx create-next-app@latest . …` per step 1 — scaffolded app on disk
- [ ] T003 — edit `package.json` — add the dependencies in step 2 and the gate scripts
- [ ] T004 — run `pnpm dlx shadcn@latest init` and add the listed primitives
- [ ] T005 [P] — create `vitest.config.ts` — alias resolution and the include pattern
- [ ] T006 [P] — edit `.gitignore` — append dependency, build, coverage and env entries
- [ ] T007 [P] — create `.env.example` — the two variable names, empty values
- [ ] T008 — run each gate command and record its exact invocation and exit status
- [ ] T009 — edit `.claude/resources/project.md` — Stack, Commands, Principles, Convention
      Map, Test file convention, Conventions, Layout, all from measurement
- [ ] T010 — create `completion-report.md` in this chunk directory

Judgment calls to explain in the completion report:

- You may keep `create-next-app`'s `src/` layout or flatten it; say which and why, and make
  `project.md`'s Layout match.
- You may configure Vitest through `vitest.config.ts` or through the Next.js-recommended
  integration; say which, and show the spec being discovered.
- You may write Principles as a list derived from this plan's Design Decisions or extend it
  with others you can justify; say what you added and why.

## Test Plan

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |
| Alias-resolution spec (T001) | The test runner exists, discovers specs at the documented location, and resolves the `@/*` alias | There is no `package.json`, no runner, no alias config and no module to import — the command itself does not exist |

This chunk is boilerplate, so this is the only spec it adds. It is not a placeholder: it is
the evidence that the toolchain every later chunk depends on actually executes, which is
exactly the claim `project.md` will make.

## Reuse Audit

`New: no existing implementation found.` The repository contains no application code —
verified by `find . -path ./.git -prune -o -type f -print`, which returns only `.claude/`,
`plans/`, `CLAUDE.md` and `.gitignore`.

Framework defaults were checked before adding configuration: `create-next-app` already
ships `lint` and `build` scripts, TypeScript configuration, and Tailwind wiring. Do not
hand-write config the scaffolder provides — verify it is absent before adding it.

## Reference Files

| File | Why |
| ---- | --- |
| `.claude/resources/project.md` | The file this chunk fills in; its section headings define what must be measured |
| `.claude/resources/bibles/swe/testing.md` | Cited in the Convention Map rows this chunk writes: fixtures must be real generated output, not hand-rolled approximations |
| `.claude/resources/prompts/gates.md` | How to prove a gate can fail, and which shapes silently pass |

## External Dependencies

- `create-next-app` — scaffolds the application; its output is authoritative over this
  plan's description of it
- `shadcn` CLI — installs UI primitives into the project
- `@xyflow/react`, `@dagrejs/dagre`, `@octokit/rest`, `zod`, `ai`, `@ai-sdk/anthropic`,
  `vitest` — installed here, used by later chunks

Verify each package's installed API surface and peer requirements against what lands in
`node_modules` before relying on this table. The versions above were read from the npm
registry on 2026-09-20 and are a starting point, not a guarantee.

## Verification Gates

Read `.claude/resources/prompts/gates.md` first.

```bash
bash -s <<'GATE'
set -euo pipefail

# Gate 1 — the app's own gates all pass. Substitute the exact invocations recorded in
# project.md. Run the type check LAST: test runners transpile without type-checking.
pnpm install
pnpm lint
pnpm test --run
pnpm build
pnpm exec tsc --noEmit

# Gate 2 — the spec the runner must discover actually ran. Assert the runner reports at
# least one passing test, rather than trusting a zero exit code from an empty run.
out=$(pnpm test --run 2>&1)
echo "$out"
echo "$out" | grep -Eq '[1-9][0-9]* (passed|passing)' || {
  echo "FAIL: test runner reported no executed tests" >&2; exit 1; }

# Gate 3 — no credential file and no dependency directory is committed.
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "FAIL: .env is tracked" >&2; exit 1
fi
tracked_deps=$(git ls-files | grep -c '^node_modules/' || true)
[ "$tracked_deps" -eq 0 ] || { echo "FAIL: node_modules is tracked" >&2; exit 1; }

# Gate 4 — project.md no longer carries the placeholder it shipped with.
if grep -q '^- \*\*Language / runtime\*\*:[[:space:]]*$' .claude/resources/project.md; then
  echo "FAIL: project.md Stack section is still empty" >&2; exit 1
fi
GATE
```

**Prove each gate can fail.** Run every gate against the base commit — the tree with none
of this chunk's work applied — and record the exact command, its exit status, and the
failure evidence. Gates 1 and 2 have no `pnpm` project to run against on base; gate 4's
needle is present on base because `project.md` is a placeholder. Record what each one
actually printed. If any gate exits 0 on base it proves nothing: revise it and record the
revision.

## Deliverables

- [ ] `completion-report.md` in this directory, **committed**, written from
      `.claude/resources/templates/completion-report.md`
- [ ] A Next.js application that installs, runs, type-checks, lints, tests and builds
- [ ] `.claude/resources/project.md` filled in from measurement
- [ ] `.env.example` with empty values; no `.env` committed

## Artifacts Checklist

- ☐ New tests for new behavior
- — Existing tests updated for changed behavior (none exist)
- ☐ Docs / conventions updated for changed behavior
- — Generated code re-run (no schema or contract yet)
- ☐ `.claude/resources/project.md` updated — this chunk's primary deliverable
