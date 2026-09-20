---
id: resources/project
description: The living record of what this project is — stack, commands, principles, conventions. Every phase of the loop reads it; plans keep it current.
---

# Project Facts

**This file is the single source of truth for what the project looks like.** Every phase of
the loop reads it, and nothing else in `.claude/` names a language, a framework, or a
command — they all defer here. Swap this file and the same framework drives a different
stack unchanged.

Keep it short and true. Delete what does not apply rather than leaving a placeholder that
reads as a fact.

## How this file stays current

It is written and maintained by the loop, not filled in once and left:

| When | Who | What changes |
| ---- | --- | ------------ |
| Before the first plan, if the stack is already known | You | Stack, Commands, Principles |
| Chunk 01 of a bootstrap plan, if it isn't | That chunk, as its deliverable | Stack, Commands, Principles, Convention Map, Layout |
| During a chunk that changes an architecture fact | The implementer, **in the same chunk** | Whichever section the change made false |
| At each wave boundary | The lead | Anything the merged wave invalidated |
| At delivery | `/plan:complete` Part 2 | Conventions learned, gotchas, promoted tribal knowledge |

**An architecture fact changed by a chunk is updated by that chunk.** A new dependency, a
new command, a new kind of file, a moved directory, a new principle — these are not
delivery-time cleanup. A stale Convention Map is read by `generate-chunk-rubric` when it
builds the *next* chunk's rubric, so staleness here compounds into unreviewed work.

**Every claim here is measured, never assumed.** Read versions off what is installed on
disk, and run each command before writing it into the table.
`.claude/resources/prompts/evidence.md` binds this file as much as any plan.

## Stack

Versions read from `node_modules/<pkg>/package.json` on **2026-09-20**, not from the
ranges in `package.json`. Toolchain versions from `node --version` / `pnpm --version`.

- **Language / runtime**: TypeScript 5.9.3 on Node.js v24.13.0
- **Framework**: Next.js 16.3.5 (App Router, Turbopack) with React 19.2.8
- **Package manager**: pnpm 9.15.4 (pinned in `package.json` as `packageManager`)
- **Test framework**: Vitest 5.0.1 (on Vite 8.3.0)
- **Styling / UI**: Tailwind CSS 4.3.3; shadcn/ui 4.21.0 CLI on the `base-nova` preset,
  which builds on `@base-ui/react` 1.8.0 (not Radix) and `lucide-react` 1.47.0
- **Lint**: ESLint 9.39.5 with `eslint-config-next` 16.3.5 (flat config)
- **Deployment target**: Vercel — no writable filesystem and no git binary at request time

Dependencies later chunks are built on, all resolved 2026-09-20:

| Package | Installed | Used by |
| ------- | --------- | ------- |
| `@xyflow/react` | 12.11.6 | canvas (chunks 04, 05) |
| `@dagrejs/dagre` | 3.1.1 | graph layout (chunk 04) — ships its own types, no `@types/dagre` |
| `@octokit/rest` | 22.0.1 | GitHub ingest (chunks 02, 06) |
| `zod` | 4.6.5 | snapshot schema, model output schema (02, 03) |
| `ai` | 7.0.107 | model calls (chunks 03, 06) |
| `@ai-sdk/anthropic` | 4.0.58 | Anthropic provider (chunks 03, 06) |

## Commands

The verification gates run these. Use the exact invocation, not a description of it. Mark
anything that does not exist yet as `N/A` — a gate skips an `N/A` command rather than
inventing one.

**Bootstrap** is what makes a newly created worktree able to run the gates: installing or
symlinking dependencies, linking gitignored files the app needs (`.env` and friends), and
any codegen. It runs once per worktree, before an implementer is dispatched into it. Get
this wrong and every chunk's first gate run fails for reasons unrelated to its work.

All commands run from the repository root.

| Gate | Command |
| ---- | ------- |
| Install | `pnpm install` |
| Bootstrap a fresh worktree | `pnpm install` (plus `cp .env.example .env.local` and fill it in, for any chunk that calls the GitHub or Anthropic API) |
| Type check | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Unit tests | `pnpm test` |
| Build | `pnpm build` |
| Run the app | `pnpm dev` — serves http://localhost:3000 |
| Ingest a repository | `node scripts/ingest.mts --repo <owner/repo> --since <iso> --until <iso> --out <file>` — also `--branch`, `--max-pull-requests`, `--record <transcript>`, `--record-sample <n>`, `--replay <transcript>`, `--enrich`, `--model <id>`, `--concurrency <n>`, `--reuse <snapshot.json>`. Needs `GITHUB_TOKEN` unless `--replay`; `--enrich` additionally needs `ANTHROPIC_API_KEY` |
| Bake a curated snapshot | `node scripts/ingest.mts --repo <owner/repo> --since <iso> --until <iso> --out src/lib/snapshots/<owner>-<repo>-<since-date>.json --enrich` — **spends money**, one model call per pull request. Add `--reuse <the same file>` to retry only failures after a code change |
| Regenerate the snapshot index | `node scripts/build-snapshot-index.mts` — reads `src/lib/snapshots/` and rewrites `src/lib/view/catalog.generated.ts`. Runs automatically as `prebuild`, so `pnpm build` regenerates it |

Regenerating the committed ingest fixture is exactly:

```bash
node scripts/ingest.mts --repo xyflow/xyflow \
  --since 2026-08-31T00:00:00Z --until 2026-09-02T00:00:00Z \
  --out /tmp/snap.json \
  --record src/lib/ingest/fixtures/xyflow-xyflow-2026-08-31.transcript.json \
  --record-sample 3
```

**Run the type check last.** `pnpm test` (Vitest) and `pnpm dev` (Turbopack) transpile
without type-checking and pass errors `tsc` catches. `pnpm build` also runs TypeScript, and
**it is not limited to the build graph** — Next runs `tsc` over the tsconfig `include`, so a
module no route imports is still type-checked by the build. Corrected 2026-09-20 by chunk
02, which measured it: a `const canary: number = "not a number"` planted in
`src/lib/ingest/ingest.ts`, reachable from no route, fails `pnpm build` with
`src/lib/ingest/ingest.ts(170,7): error TS2322`. Re-verified independently by the lead —
build exits 1 with the canary and 0 once it is removed. (An earlier version of this file
claimed the opposite. Run the type check last anyway, because Vitest and Turbopack really do
transpile without checking; just don't skip `pnpm build` believing it is blind to
`src/lib/`.)

Command behaviour that is not what it looks like:

- **`pnpm build` runs a codegen step first.** `package.json` carries
  `"prebuild": "node scripts/build-snapshot-index.mts"`, and pnpm 9.15.4 does run `pre*`
  lifecycle hooks — so `pnpm build` rewrites `src/lib/view/catalog.generated.ts` before
  `next build` starts. Added by chunk 04. A build that "changed a file you didn't touch" is
  this, not a stray edit.
- **`pnpm test --run` does not reach Vitest.** pnpm consumes `--run` as its own option and
  fails with `ERROR Unknown option: 'run'` before the script starts. Use `pnpm test` (the
  script is already `vitest run`) or `pnpm test -- --run`. The bare failure mode is
  dangerous in a gate: it exits non-zero for a reason unrelated to any test.
- **`pnpm lint` runs `eslint` with no path argument**, which lints the whole project
  directory under the flat config. Measured 2026-09-20 after chunk 02: 30 files
  (`pnpm exec eslint --debug | grep -c "Linting "`), including `vitest.config.mts`, the
  specs under `src/`, and `scripts/`. It is not a vacuous no-file run.
- **`pnpm lint` walks `.worktrees/`, so a leftover chunk worktree breaks the gate in the
  main checkout.** Because `pnpm lint` runs `eslint` with no path argument, it lints the
  whole project directory — including any worktree still sitting under `.worktrees/` and
  that worktree's own `node_modules`. Measured 2026-09-20 at the wave-3 boundary: with
  `.worktrees/02-ingest-core` present, `pnpm lint` reported
  `✖ 3240 problems (148 errors, 3092 warnings)` and exited 1; every reported file was under
  `.worktrees/`. After `git worktree remove`, the same command exits 0 with no output. This
  is why a merged chunk's worktree is removed as soon as its PR lands — until then the
  lead's own gate run on the plan branch is unreadable. If a gate must run while a worktree
  is live, scope it: `pnpm exec eslint src scripts`.

- **`pnpm lint` exits 0 on warnings, and the gate is weaker than it looks.** Only
  error-level rules fail it. Measured 2026-09-20 by the lead: a `const` reassignment plus
  an unused variable planted in `src/lib/ingest/ingest.ts` produced
  `✖ 1 problem (0 errors, 1 warning)` and **exit 0**. The resolved config has
  `no-const-assign: [0]` and `no-unused-vars: [0]`, with only
  `@typescript-eslint/no-unused-vars` at `[1]` — a warning, which does not fail anything.
  Read a rule's real severity with `npx eslint --print-config <file>` rather than assuming.
  Nothing here is unguarded — `tsc` catches const reassignment — but never treat "lint
  passed" as "lint had nothing to say", and if you need it to mean that, run
  `pnpm exec eslint --max-warnings 0`. **Not `pnpm lint -- --max-warnings 0`** — that exits
  **2** with `No files matching the pattern "--max-warnings"`, because the `lint` script is
  bare `eslint` and pnpm appends the forwarded argument as a path. Corrected 2026-09-20 by
  chunk 04, which measured it; an earlier version of this bullet recommended the broken form.
  Re-verified independently by the lead: the `--` form exits 2, the `pnpm exec` form exits 0.
- **A zero exit from `pnpm test` does not mean your spec ran.** Measured 2026-09-20 on
  vitest@5.0.1: when the include pattern matches *nothing at all* it exits 1 with
  `No test files found, exiting with code 1`. But a spec that sits outside
  `src/**/*.test.{ts,tsx}` while other specs match is skipped silently and the run still
  exits 0. Assert the passing count the runner reports, not the exit status alone.

## Principles

The project's constitution: the rules a plan is checked against before it's approved, and
that a reviewer can cite. Keep the list short — five or six you would actually block a PR
over. Each one is a rule, not an aspiration, and each says what it forbids and what a
violation looks like.

Amend deliberately: a principle changed mid-plan invalidates the reasoning of every chunk
approved under it, so record the date and the reason when one changes, and note which
version each plan was checked against.

Written 2026-09-20 by chunk 01 of `2026-09-20-project-grain-prototype`, derived from that
plan's Design Decisions and Plan-Specific Constraints. Chunks 02–06 are the first work
checked against them.

1. **A credential never reaches the client.** `GITHUB_TOKEN` and `ANTHROPIC_API_KEY` are
   read only inside route handlers and scripts. Violation: either name read in a file that
   is not a route handler or a `scripts/` module, any `NEXT_PUBLIC_*` variable holding a
   credential, or a committed `.env`. A token reaching a client bundle is published to
   every visitor.

2. **No model call sits between a click and a frame.** Enrichment is a separate pass keyed
   by merge SHA — baked into committed snapshots ahead of time, or generated once per pull
   request on expand and reused for the session. Violation: an `ai` or `@ai-sdk/*` import
   in a component, or a model call reached while rendering. Nothing the canvas draws may
   wait on a model.

3. **Nothing depends on a writable filesystem or a git subprocess at request time.** The
   deploy target has neither. Violation: `fs.write*`, a temp-directory write, or a
   `child_process` call to `git` on any path reachable from a route handler. Read-only
   reads of committed files are fine; ingest is GitHub API work only.

4. **Fixtures and snapshots are captured output of the real producer.** A data file under
   test is generated by running the ingester and committing what it wrote. Violation: JSON
   hand-authored to look like an API response or a snapshot. Hand-rolled fixtures exercise
   only the simple case, and the divergence surfaces as a bug in the path that was never
   tested — see `.claude/resources/bibles/swe/testing.md`.

5. **One snapshot schema, one ingest path.** Everything the view renders is a snapshot that
   the Zod schema validates, whether it came from a committed file or a live request.
   Violation: the view branching on provenance, a second schema for live results, or a
   raw GitHub response reaching a component.

6. **Every live ingest is bounded before it starts.** The window and the pull-request count
   are capped at the call site, not discovered mid-loop. Violation: a paginated fetch with
   no ceiling on a user-supplied repository. An unbounded fetch spends the owner's GitHub
   rate limit and model budget on one URL.

A chunk that violates a principle needs an explicit justification in the plan's Design
Decisions, or it doesn't ship. "This was easier" is not a justification.

## Convention Map

What each kind of file must satisfy. The `generate-chunk-rubric` skill reads this to build
each chunk's review checks, and the gates listed here are what a chunk touching that area
runs. A path matching several rows collects all of their checks.

Fill it in as the project grows — an empty map means every rubric is only as good as what
the planner remembered that day, and `generate-chunk-rubric` will say so out loud rather
than emit a thin rubric silently.

Globs are written relative to the repository root.

**The `Doc` column points at a bible leaf page** under `.claude/resources/bibles/` — the
page carrying the rule, found by following that bible's `decision-tree.md`. Never cite the
decision-tree itself; a reviewer handed a routing table grades from memory. Use `—` when no
page applies, and the review check ships without a citation rather than with an invented
one.

| Files | Gates | Review checks | Doc |
| ----- | ----- | ------------- | --- |
| `src/components/**/*.tsx`, `src/app/**/page.tsx`, `src/app/**/layout.tsx` | `pnpm lint`, `pnpm build`, `pnpm typecheck` | No `ai`/`@ai-sdk/*` import and no model call (Principle 2); no `process.env` read of a credential (Principle 1); renders a schema-validated snapshot rather than a raw API shape (Principle 5); a state distinction is never carried by colour alone | — |
| `src/components/ui/**` | `pnpm lint`, `pnpm typecheck` | Generated by `pnpm dlx shadcn@latest add <name>`; not hand-authored and not hand-edited. Re-run the CLI instead of patching a primitive | — |
| `src/lib/**/*.ts` | `pnpm test`, `pnpm lint`, `pnpm typecheck` | Standalone functions over plain objects — no class hierarchy, registry or provider interface with one implementation; no `fs` write and no `child_process` (Principle 3); reads no credential — a token arrives as a parameter (Principle 1); imports a sibling by **relative specifier with an explicit `.ts` extension**, never `@/`; validates every repository-derived record key through `assertSafeKey`/`buildRecord` rather than relying on the schema; each module has a co-located spec | — |
| `scripts/**` | `pnpm lint`, `pnpm typecheck` | Reads credentials here legally (Principle 1) and may write files — Principle 3 forbids filesystem writes only on paths reachable from a route handler, and a CLI is not one. Thin: parses arguments and sequences `src/lib/` functions, holds no domain logic. Runs under bare Node, so it imports `src/lib/` by relative specifier with an explicit extension, never `@/`. No co-located spec — the logic it drives is tested in `src/lib/` | — |
| `src/app/**/route.ts` | `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm typecheck` | `export const runtime = 'nodejs'` when it touches Octokit or the AI SDK — the Edge runtime supports neither; thin — sequences and wires `src/lib/` functions, holds no domain logic; bounds every fetch before starting it (Principle 6); reads credentials here, never below (Principle 1) | `.claude/resources/bibles/swe/patterns/orchestrator-pattern.md` |
| `src/**/*.test.ts`, `src/**/*.test.tsx` | `pnpm test`, `pnpm lint`, `pnpm typecheck` | Asserts the value a consumer receives after resolution, never reads back the literal it passed in; a transform over a producer's output is tested against that producer's real captured output, not a hand-rolled approximation | `.claude/resources/bibles/swe/testing.md` |
| `src/**/fixtures/**/*.json`, `src/**/snapshots/**/*.json` | `pnpm test` | Captured output of the real ingester, committed as written (Principle 4). Carries the incidental fields a real API response has and a hand-written file would not bother with; regenerated by re-running the producer, never edited by hand | `.claude/resources/bibles/swe/testing.md` |
| `src/**/*.generated.ts` | `pnpm test`, `pnpm build`, `pnpm typecheck` | Written by its generator, never hand-edited; committed so `pnpm dev`/`pnpm test` work without running the generator; a co-located spec asserts the committed copy still matches its source of truth | — |
| `package.json`, `tsconfig.json`, `vitest.config.mts`, `eslint.config.mjs`, `next.config.ts`, `components.json` | `pnpm install`, `pnpm build`, `pnpm typecheck` | Changed by the tool that owns it where one exists (`pnpm add`, the shadcn CLI) rather than hand-edited; a new dependency or command is recorded in this file in the same chunk | — |

**Anything under `.claude/` is governed by the prompt-engineering bible** whether or not a
row above matches it. `generate-chunk-rubric` adds those citations on its own — see that
skill's "When the chunk touches `.claude/` itself".

**The `src/lib/**` row has no `Doc` on purpose — do not "fix" it.** The SWE decision tree
routes "design a new service or module with a public API" to
`.claude/resources/bibles/swe/patterns/service-design.md`, but that page's § "Interface-first
(mandatory for shared services)" requires an interface in `contracts/`, an `@Injectable()`
class implementing it, and a NestJS provider token (§ "NestJS provider registration") — a
DI-container pattern for swapping implementations. `src/lib/` here is standalone functions
over plain objects with exactly one implementation each, which ORCHESTRATOR.md § Complexity
rejects the alternative to by name: *"an abstraction with exactly one implementation, built
for a non-goal."* The routing row matches on the words, not the situation. Ruled on
2026-09-20 by the plan lead, who read the page: the plan's Complexity decision wins, and the
row ships its review checks uncited rather than citing a page that contradicts the design.
Read the two named sections before reopening this.

**Test file convention**: specs are co-located with the module they cover, named
`<module>.test.ts` (or `.test.tsx`), and live under `src/`. `vitest.config.mts` includes
exactly `src/**/*.test.{ts,tsx}`; a spec outside `src/` is never discovered and passes by
not running. Verified 2026-09-20: `src/lib/utils.test.ts` is matched and executed —
`pnpm test` reports `Test Files 1 passed (1) / Tests 3 passed (3)`.

## Conventions

Things an implementing agent would otherwise get wrong. Add to this as they surface — a
convention learned during execution belongs here in the same change that learned it, not in
a follow-up.

- **Do not delete `AGENTS.md`.** `next dev` regenerates agent files on every start. With
  `AGENTS.md` present and hosting the rules block it writes there and skips `CLAUDE.md`;
  with `AGENTS.md` absent it writes the Next.js block into `CLAUDE.md` instead, clobbering
  this project's instructions. See `writeAgentFiles` in
  `node_modules/next/dist/server/lib/generate-agent-files.js` (next@16.3.5).
- **`.gitignore` ignores `.env*`**, so `.env.example` is committed only because of an
  explicit `!.env.example` negation at the end of the file. Any other committed env
  template needs its own negation.
- **The Vitest config is `vitest.config.mts`, not `.ts`.** `package.json` has no
  `"type": "module"`, so a `.ts` config is loaded as CommonJS and Vite 8 warns that ESM
  syntax there is unsupported by the incoming native config loader.
- **Do not add `vite-tsconfig-paths`.** Vite 8.3.0 resolves tsconfig paths natively via
  `resolve: { tsconfigPaths: true }`, which is what `vitest.config.mts` sets. The alias
  mapping is therefore read from `tsconfig.json` and is never restated — add a path there
  and the runner picks it up.
- **`cn` is re-exported, not defined here.** `src/lib/utils.ts` is
  `export { cn } from "cn"` — the shadcn `base-nova` preset depends on the `cn` package
  (0.3.0) rather than inlining `clsx` + `tailwind-merge`. Do not rewrite it by hand.
- **`shadcn init` is only non-interactive with all three choices supplied**:
  `pnpm dlx shadcn@latest init --base base --preset nova --no-monorepo --yes`. With
  `--yes` alone it still prompts for the component library and the preset and hangs.
- **`find node_modules/...` does not follow pnpm's symlinks**, so it reports a package's
  files as absent. Use `find -L`, or read the manifest with `node -e`, before concluding a
  package ships no types.
- **Zod does not guard reserved object keys — `assertSafeKey`/`buildRecord` do.** Measured
  2026-09-20 on zod 4.6.5 and re-verified independently by the lead:
  `z.record(z.string(), z.number()).safeParse(JSON.parse('{"__proto__":1,"safe":2}'))`
  returns `success: true` and the result simply has no `__proto__` key — **silent loss, not
  rejection**, and a `.refine` cannot see it either. So validation runs *before* parsing,
  in `assertSafeKey` and `buildRecord` (`src/lib/snapshot.ts`), which reject reserved keys
  and duplicates and build on `Object.create(null)`. Any code turning a repository-derived
  string into a record key must call them; the schema will not catch the mistake. This
  applies directly to `enrichment`, which is keyed by merge SHA and written by more than
  one producer.
- **Inside `src/lib/`, modules import each other by relative specifier with an explicit
  `.ts` extension** (`import { … } from './topology.ts'`), which is why `tsconfig.json`
  sets `"allowImportingTsExtensions": true` — TypeScript rejects the extension otherwise
  (TS5097). The reason is the CLI: Node 24.13.0 runs `.ts`/`.mts` natively, so no `tsx` or
  `ts-node` is needed, but it strips types **without reading tsconfig `paths`**, so `@/…`
  fails under bare Node with `ERR_MODULE_NOT_FOUND`. Specs keep the `@/` alias, since they
  only ever run under Vitest. A new library module written with `@/` works under Vitest and
  Next and breaks the CLI — and nothing else catches it.
- **Recorded HTTP transcripts are a fixture kind**, at `src/**/fixtures/*.transcript.json`,
  shaped `{entries: [{method, url, status, headers, json?, text?}]}`. JSON bodies are stored
  **parsed**, so the file stays reviewable and `grep '"node_id"'` works. The recorder drops
  response headers describing the caller's credential (`x-oauth-scopes`,
  `x-oauth-client-id`, `x-accepted-oauth-scopes`, `set-cookie`) and never records request
  headers at all, because `Authorization` is on every request and a transcript is committed.
- **`enrichmentEntrySchema` strips unknown keys, so a marker cannot be a new property.**
  Measured 2026-09-20 on zod 4.6.5 by chunk 03: parsing an enrichment entry carrying an extra
  field returns it *without* that field. A degraded record is therefore identified by the
  `FALLBACK_APPROACH` constant and the `isFallbackEnrichment` predicate in
  `src/lib/ai/enrichment.ts`, not by an added flag.
- **The `ai` test double is `MockLanguageModelV4` from `ai/test`.** Its `doGenerate` result
  needs the nested V4 `usage` shape and an object-shaped `finishReason`. A spec must **not**
  import types from `@ai-sdk/provider` — it is not a direct dependency and does not resolve.
- **`.env.example` defeats a naive tracked-env-file gate.**
  `git ls-files | grep -E '(^|/)\.env($|\.)'` matches the committed template, so any such
  gate needs `| grep -v '^\.env\.example$'` or it fails on a clean tree.
- **A gate that loops over a `git ls-files` result must assert the corpus is non-empty
  first.** Otherwise the loop runs zero times and the gate exits 0 — it passes vacuously on
  exactly the tree it was written to fail on. Both chunk 03's and chunk 04's gate 2 shipped
  with this defect; both were corrected. This is the single most common way a gate in this
  project proves nothing.
- **Scripts are `.mts`, for the same reason `vitest.config.mts` is.** Node still prints
  `MODULE_TYPELESS_PACKAGE_JSON` for the first imported `.ts` file; it is cosmetic stderr
  noise, and the only fix is `"type": "module"`, which this project rules out.
- **Committed snapshots are reached through `src/lib/view/catalog.ts`, never by reading the
  directory.** The index it imports is generated by `scripts/build-snapshot-index.mts` as a
  list of static `import`s, because a source directory nothing imports is not carried into
  the build output. Measured 2026-09-20 by chunk 04 and re-verified by the lead:
  `find .next -path '*snapshots*' -name '*.json'` returns nothing, while a snapshot's merge
  SHA (`0a1f9575…`) appears in `.next/server/chunks/ssr/src_00jhk_s._.js`. Adding a snapshot
  means re-running the generator — `src/lib/view/catalog.test.ts` fails until you do
  (canary: an unindexed snapshot file makes it report `Tests 1 failed | 4 passed`).
- **`@dagrejs/dagre`'s default export does not carry `Graph`.** On 3.1.1 the default export
  is `{graphlib, version, layout, debug, util}`, so
  `import dagre from '@dagrejs/dagre'; new dagre.Graph()` throws `TypeError:
  default.Graph is not a constructor`. Use the named exports:
  `import { Graph, layout } from '@dagrejs/dagre'`. Note also that dagre reports a node's
  **centre** while React Flow positions by the **top-left** corner.

## Layout

Where things live, and what belongs where.

```
src/
  app/          Next.js App Router. Pages and layouts render; route handlers
                (app/**/route.ts) are the ONLY place a credential is READ, and the
                only place a model call may originate.
  components/
    ui/         shadcn/ui primitives, generated by the CLI. Not hand-edited.
    canvas/     This app's canvas presentation components — the workspace, topology
                canvas, package node, time slider, repository picker, empty state.
    */          Presentation components for this app. No data fetching, no model calls.
  lib/          Standalone functions over plain objects — ingest, enrichment, view
                derivation, the snapshot schema. No React, no request context, no fs
                writes, no git subprocess. May call the GitHub API, but never reads a
                credential: the token arrives as a parameter. Co-located *.test.ts.
    ai/         The enrichment module and its specs — one model call per pull request.
                Reads no credential: a configured model arrives as a parameter.
    ingest/     GitHub ingest, topology discovery, and the recorded HTTP transcripts
                under fixtures/.
    view/       View derivation and the snapshot catalog. catalog.generated.ts is
                written by scripts/build-snapshot-index.mts — never hand-edited.
    snapshots/  Committed baked snapshots, <owner>-<repo>-<since-date>.json. Captured
                output of `scripts/ingest.mts --enrich`; never hand-edited. Reached
                through view/catalog.ts, never by reading the directory.
scripts/        CLIs run by hand or at bake time, under bare Node. Alongside a route
                handler, the only place a credential is read — and unlike one, may
                write files, since no request reaches it.
public/         Static assets served as-is.
.claude/        The spec-driven loop: prompts, bibles, skills, and this file.
plans/          Plan directories — one per plan, with SPEC, chunks and retro.
```

The boundary the Principles police is **where a credential is read**, not where a socket is
opened. Secrets and model calls live in `src/app/**/route.ts` and `scripts/`; `src/lib/`
takes data and returns data, and `src/components/` renders what it is handed. A file that
needs a *token* or a *model* is in the wrong directory. A `src/lib/` module that performs
GitHub I/O with a token handed to it is in the right one — Principle 3 says ingest is
GitHub API work, and the route handler row says routes stay thin and wire `src/lib/`
functions, so the network call has nowhere else to live.

**Amended 2026-09-20 at the wave-2 boundary.** This paragraph previously read "secrets,
network calls and model calls live on the route side of it; `src/lib/` is pure functions",
which contradicted Principle 3 and the `src/app/**/route.ts` convention row in the same
file — chunk 02 hit the contradiction and correctly followed the Principles over the
Layout. Reworded so the next implementer is not told two different things.
