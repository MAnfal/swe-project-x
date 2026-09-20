# Grain

See what happened in your packages while you weren't looking — and how each change was
built.

Grain reads a TypeScript monorepo's merged pull requests over a window and draws three
levels: the package topology with what was touched, the changes that reached one package,
and the ordered steps that produced one change. It ships with pre-analyzed snapshots and
can analyze any public GitHub repository on demand.

## Submission

**→ [Resources and execution history](https://swe-project-x.vercel.app/submission)** — one page
with everything below, including the eight build transcripts as rendered HTML. The transcripts
do not render on GitHub, so read them there rather than here.

| | |
| --- | --- |
| **Prototype** | https://swe-project-x.vercel.app |
| **Video walkthrough** | [Loom, ~5 min](https://www.loom.com/share/13273d9f4c384711bb2fd908b4c74a73) — the problem, the prototype driven end to end, and how it was built |
| **Design rationale** | [Google Doc](https://docs.google.com/document/d/1B6-XtsuPth4XSiOevKFVXq4RyE39KCGvYjSAGURytJ4/edit?usp=sharing) — why this theme, what makes it non-obvious, the tradeoffs, and what's next |
| **Spec-driven development** | [The method this was built with](https://anfalmushtaq.com/articles/primitives-of-spec-driven-development) |
| **Mid-fi design** | [Claude artifact](https://claude.ai/artifact/P1zvfQgt23ZYJUezR9u7i1) — what the canvas was built against |
| **Prototype brainstorm** | [PDF](https://swe-project-x.vercel.app/submission/prototype-brainstorm.pdf) — the session that scoped the spec |
| **Build transcripts** | [Eight Claude Code sessions](https://swe-project-x.vercel.app/submission#execution), 08:01–19:44 on 2026-09-20 |

The spec, the six chunk plans, every review iteration and the retro are checked in under
[`plans/completed/2026-09-20-project-grain-prototype/`](plans/completed/2026-09-20-project-grain-prototype/).

## Running locally

Requires Node.js 24 (`.mts` scripts run under bare Node) and pnpm 9.

```bash
pnpm install
cp .env.example .env.local   # then fill it in — see below
pnpm dev                     # http://localhost:3000
```

`pnpm dev` is enough to browse the committed snapshots: they are static imports in the
bundle, so the landing page needs no network request, no database and no credential. The
environment variables below are needed only for live analysis and on-demand enrichment.

To exercise what actually deploys — the static prerender plus the client chunks that ship
— run the production build instead:

```bash
pnpm build && pnpm start
```

### Environment variables

Both are read **only** inside route handlers (`src/app/api/**/route.ts`) and the scripts
under `scripts/`. Neither is ever exposed to the browser, and neither is prefixed
`NEXT_PUBLIC_`. `.env.local` is gitignored.

| Variable | Required for | Notes |
| -------- | ------------ | ----- |
| `GITHUB_TOKEN` | Live analysis (`/api/analysis`) and the ingest CLI | A classic or fine-grained token with public-repository read access is enough. Without it the app still serves the committed snapshots; live analysis answers with a clear error. |
| `ANTHROPIC_API_KEY` | On-demand enrichment (`/api/enrichment`) and `scripts/ingest.mts --enrich` | Spends money: one model call per pull request the reader expands. Without it a change node falls back to the pull request's own title rather than going blank. |

Two optional settings bound a live analysis. Both have defaults and neither is a
credential:

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `GRAIN_ANALYSIS_WINDOW_DAYS` | `90` | How far back a live analysis looks. Whole number, 1–365. |
| `GRAIN_MAX_PULL_REQUESTS` | `100` | The ceiling on pull requests analyzed, applied before any fetch starts. Whole number, 1–500. |
| `ENRICHMENT_MODEL` | `claude-haiku-4-5` | The model on-demand enrichment and the bake command use. |

A value that is present but unusable makes the route fail loudly rather than silently
falling back to the default.

## Commands

| Command | What it does |
| ------- | ------------ |
| `pnpm dev` | Development server on http://localhost:3000 |
| `pnpm build` | Production build. Regenerates the snapshot index first (`prebuild`) |
| `pnpm start` | Serves the production build |
| `pnpm test` | Vitest, once |
| `pnpm lint` | ESLint over the project |
| `pnpm typecheck` | `tsc --noEmit` |

Baking a new committed snapshot (spends money — one model call per pull request):

```bash
node scripts/ingest.mts --repo <owner/repo> \
  --since <iso> --until <iso> \
  --out src/lib/snapshots/<owner>-<repo>-<since-date>.json --enrich
```

## Deploying

The app targets a serverless host with no writable filesystem and no git binary at request
time — Vercel is what it was built against. Nothing depends on either: ingest is GitHub
API work, and the committed snapshots are static imports rather than files read at
runtime.

1. Import the repository into the host and let it detect Next.js. The default
   `pnpm build` / `pnpm start` pipeline is correct; no custom build command is needed.
2. Set `GITHUB_TOKEN` and `ANTHROPIC_API_KEY` as **server-side** environment variables for
   the environments you want live analysis in. Do not prefix either with `NEXT_PUBLIC_`.
3. Optionally set `GRAIN_ANALYSIS_WINDOW_DAYS` and `GRAIN_MAX_PULL_REQUESTS` to narrow the
   work a single request may do.

Both API routes declare `export const runtime = 'nodejs'` — Octokit and the AI SDK do not
run on the Edge runtime — and an explicit `maxDuration`: 300 seconds for `/api/analysis`,
which is the ceiling Vercel's free tier allows and cannot be raised there, and 60 for
`/api/enrichment`, which is one model call.

**There are no background jobs.** A live analysis runs inside the request that asked for
it. Closing the tab ends it, a retry starts it over, and nothing is queued, stored or
resumed. The enrichment cache is in-memory and lives only as long as the serving instance
that holds it — a cold instance re-asks the model, which is a normal miss and not an
error.

## How work happens here

Non-trivial changes run through the spec-driven loop in `.claude/`. Read
`.claude/README.md` for the loop and `.claude/resources/project.md` for the stack,
commands, principles and conventions a reviewer will cite.
