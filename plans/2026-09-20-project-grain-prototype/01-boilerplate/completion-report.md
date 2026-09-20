# Chunk 01 — Completion Report

Boilerplate: Next.js app, dependencies, gates, project facts.
Branch `feat/project-grain-prototype--boilerplate`, worktree
`/Users/anfal/Projects/hobby_projects/swe-take-home/.worktrees/01-boilerplate`.

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `package.json`, `pnpm-lock.yaml` | created (scaffolder) then edited | `create-next-app` output; added the six runtime deps later chunks need, `vitest`, and the `test` / `typecheck` scripts |
| `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `next-env.d.ts` | created (scaffolder) | Unmodified `create-next-app` config — not hand-written |
| `src/app/{layout.tsx,page.tsx,globals.css,favicon.ico}`, `public/*.svg`, `README.md` | created (scaffolder) | Default Next.js App Router app; `globals.css` was then rewritten by `shadcn init` |
| `AGENTS.md` | created (scaffolder) | Kept deliberately — see Judgment calls; deleting it makes `next dev` overwrite the project's `CLAUDE.md` |
| `components.json` | created (shadcn CLI) | shadcn config, `base-nova` preset |
| `src/components/ui/{button,select,slider,badge,card,dialog,input}.tsx` | created (shadcn CLI) | The seven primitives the plan lists |
| `src/lib/utils.ts` | created (shadcn CLI) | `export { cn } from "cn"` — the module T001 imports through the alias |
| `src/lib/utils.test.ts` | created | T001 — the alias-resolution spec |
| `vitest.config.mts` | created | Include pattern + tsconfig-derived alias resolution |
| `.gitignore` | edited (appended) | Scaffolder's entries appended below the pre-existing `.worktrees/`; then `!.env.example` |
| `.env.example` | created | The two variables later chunks read, empty values |
| `.claude/resources/project.md` | edited | This chunk's primary deliverable — Stack, Commands, Principles, Convention Map, Test file convention, Conventions, Layout |

Not touched: `CLAUDE.md`, `.claude/` other than `project.md`, `plans/` other than this
directory.

## Acceptance criteria

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| Clean checkout, install + `dev` → a Next.js page serves on the documented port | yes | `pnpm dev` then `curl http://localhost:3000/` → HTTP `200`, `<title>Create Next App</title>`. Server log: `▲ Next.js 16.3.5 (Turbopack) — Local: http://localhost:3000 / ✓ Ready in 425ms / GET / 200 in 1585ms` |
| Type check, lint, unit test and build each exit zero, exact invocation recorded in `project.md` | yes | Final run below: `pnpm lint exit=0`, `pnpm test exit=0`, `pnpm build exit=0`, `pnpm typecheck exit=0`. All four are in `project.md` § Commands verbatim |
| A spec at the documented location is discovered and executed | yes | `src/lib/utils.test.ts` matches `src/**/*.test.{ts,tsx}`; `pnpm test` → `Test Files 1 passed (1) / Tests 3 passed (3)`. Falsified: breaking the include pattern makes the run report `No test files found` (canary D) |
| `project.md` describes what is on disk, versions read from installed packages | yes | Every version in § Stack read via `node_modules/<pkg>/package.json` on 2026-09-20 — e.g. `next 16.3.5`, `vitest 5.0.1`, `zod 4.6.5`, `@types/node 24.13.6`. `package.json` ranges (`^4`, `^19`, `^5`) are deliberately not what is recorded |
| After an install, no dependency dir, build output or env file is untracked-and-unignored | yes | `git status --porcelain` lists no `node_modules/`, `.next/`, `tsconfig.tsbuildinfo` or `.env*`. `git check-ignore -q` returns ignored for `node_modules/x`, `.next/x`, `out/x`, `coverage/x`, `.env`, `.env.local`, `.worktrees/x`, and **not** ignored for `.env.example` |

## Tests

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| `src/lib/utils.test.ts` — `cn` joins classes / drops falsy conditionals / resolves conflicting Tailwind utilities, imported as `@/lib/utils` | Spec written first, before the scaffold existed. `pnpm test --run` → ` ERROR  Unknown option: 'run'` / `exit=1`. `pnpm exec vitest run src/lib/utils.test.ts` → ` ERR_PNPM_RECURSIVE_EXEC_NO_PACKAGE  No package found in this workspace` / `exit=1`. Exactly the plan's predicted failure: no `package.json`, no runner, no alias config, no module — the command itself does not exist | `pnpm test` → `RUN v5.0.1` / `Test Files 1 passed (1)` / `Tests 3 passed (3)` / `exit=0` |

**The red run is a missing-command failure, so it proves the toolchain was absent but not
that the spec asserts anything.** A second negative control closes that: with
`tsconfig.json`'s `paths` repointed to `./src-wrong/*`, `pnpm test` fails to resolve the
import — `Test Files 1 failed (1) / Tests no tests` — and passes again once restored
(`Tests 3 passed (3)`). The alias is therefore load-bearing in the passing run, not
incidental.

The three assertions were written before `src/lib/utils.ts` existed and were **not**
adjusted afterwards; they held against the installed `cn@0.3.0` as written.

## Gates

Baseline: **no baseline of errors or warnings was capturable.** The base tree has no
`package.json`, so no type checker, linter or test runner exists to produce one — `pnpm`
exits with `ERR_PNPM_NO_PKG_MANIFEST`. Every count below is therefore an absolute count
against a zero baseline, which is the one case where absolute and delta coincide. Evidence
files are in the session scratchpad at
`/private/tmp/claude-501/-Users-anfal-Projects-hobby-projects-swe-take-home/d9228db7-b1f5-45bd-b279-3f9d8148cad8/scratchpad/ev/`.

All gate results below were produced **after the last edit to the tree**. They were re-run
once more, unchanged, after the two documentation edits recording the lead's `src/lib/**`
arbitration (`project.md` § Convention Map and this report), so the run matches the final
tree rather than an earlier one: `lint exit=0`, `Tests 3 passed (3)`,
`✓ Compiled successfully in 521ms`, `typecheck exit=0`, `gate 2 PASS`, `gate 3 PASS`,
`gate 4 PASS`.

| Gate | Command | Result | Fails on base? |
| ---- | ------- | ------ | -------------- |
| 1 — app gates, type check last | `pnpm install` / `pnpm lint` / `pnpm test` / `pnpm build` / `pnpm typecheck` | `exit=0` each. Lint: no output. Test: `Tests 3 passed (3)`. Build: `✓ Compiled successfully in 2.0s`, routes `/` and `/_not-found` prerendered. Typecheck: no output | **Yes.** On base: ` ERR_PNPM_NO_PKG_MANIFEST  No package.json found in …/01-boilerplate`, `exit=1` at the first command |
| 2 — the discovered spec actually ran | `out=$(pnpm test 2>&1); grep -Eq '[1-9][0-9]* (passed\|passing)'` | `Test Files 1 passed (1)` / `Tests 3 passed (3)` → `gate 2 PASS` | **Yes.** On base the capture itself fails: ` ERROR  Unknown option: 'run'` under the plan's wording, `exit=1`. Additionally canaried on the finished tree — include pattern repointed to `src/**/*.nomatch.{ts,tsx}` → `No test files found, exiting with code 1` → `FAIL: test runner reported no executed tests`, `gate 2 exit=1`; restored → `gate 2 OK`, `exit=0` |
| 3 — no credential file or dependency dir committed | `git ls-files --error-unmatch .env` / `git ls-files \| grep -c '^node_modules/'` / `git check-ignore -q` per path | `tracked node_modules files: 0; .env tracked: no; ignores verified` → `gate 3 PASS` | **The plan's version could not fail on base — revised.** See below |
| 4 — `project.md` placeholder is gone | `grep -q '^- \*\*Language / runtime\*\*:[[:space:]]*$' .claude/resources/project.md` | Needle absent; line 42 now reads `- **Language / runtime**: TypeScript 5.9.3 on Node.js v24.13.0` → `gate 4 PASS` | **Yes.** On base: `FAIL: project.md Stack section is still empty`, `exit=1` — the placeholder line is present verbatim |

### Gate 3 was vacuous as written, and was revised

Run against the base tree exactly as the plan wrote it, gate 3 printed `gate 3 clean` and
exited **0**. It asserts that `.env` and `node_modules/` are untracked, and on a tree with
no dependencies installed and no `.env` that is trivially true. Per
`.claude/resources/prompts/gates.md` ("If any gate exits 0 on base it proves nothing:
revise it and record the revision") it was given a needle that base genuinely lacks — the
ignore rules themselves:

```bash
for p in node_modules/x .next/x coverage/x .env .env.local; do
  git check-ignore -q "$p" || { echo "FAIL: $p is not gitignored" >&2; exit 1; }
done
git check-ignore -q .env.example && { echo "FAIL: .env.example is ignored" >&2; exit 1; }
```

On base this fails at the first path — base `.gitignore` contains only `.worktrees/`:

```
FAIL: node_modules/x is not gitignored
BASE GATE 3 (revised) exit=1
```

The final `.env.example` assertion is the inverse needle: it catches the scaffolder's
`.env*` rule swallowing the committed template, which is a live failure mode here rather
than a hypothetical.

### Per-needle negative controls

`gates.md` requires one probe per assertion, and the full four-step cycle (plant, confirm
red, remove, **confirm clean again**). No `git checkout`/`git stash` was used — every file
was copied aside and copied back, then `diff -q`'d.

| Probe | Canary | Fired | Returned clean |
| ----- | ------ | ----- | -------------- |
| Lint | `const unusedCanary: any = 1;` appended to `src/app/page.tsx` | `71:21 error Unexpected any. Specify a different type @typescript-eslint/no-explicit-any` + `71:7 warning no-unused-vars`; `✖ 2 problems (1 error, 1 warning)`; `ELIFECYCLE Command failed with exit code 1` | restored, `diff -q` clean, `pnpm lint` silent |
| Type check | `export const typeCanary: number = "not a number";` appended to `src/lib/utils.ts` | `src/lib/utils.ts(3,14): error TS2322: Type 'string' is not assignable to type 'number'.` `exit code 2` | restored, `diff -q` clean, `pnpm typecheck` silent |
| Alias resolution | `tsconfig.json` `paths` → `{'@/*': ['./src-wrong/*']}` | `Test Files 1 failed (1) / Tests no tests` | restored, `Tests 3 passed (3)` |
| Test discovery (gate 2) | include → `src/**/*.nomatch.{ts,tsx}` | `No test files found, exiting with code 1` → `FAIL: test runner reported no executed tests`, `exit=1` | restored, `gate 2 OK`, `exit=0` |
| Gate 3 needle A — tracked `.env` | `echo SECRET=x > .env; git add -f .env` | `FAIL: .env is tracked`, `exit=1` | `git rm --cached`, file removed → `gate 3 clean`, `exit=0` |
| Gate 3 needle B — tracked `node_modules` | `node_modules/canary.txt` + `git add -f` | `FAIL: node_modules is tracked (1 files)`, `exit=1` | `git rm --cached`, file removed → clean, `exit=0`; `git diff --cached` empty |
| Gate 3 needle C — ignore rules | `node_modules` lines stripped from `.gitignore` | `FAIL: node_modules/x is not gitignored`, `exit=1` | restored, `diff -q` clean, `exit=0` |

Needle B's first attempt failed to plant: `git add -f node_modules/cn/package.json` →
`fatal: pathspec … is beyond a symbolic link` (pnpm's store layout), and the gate reported
`clean`/`exit=0` — a canary that never landed reading as a pass. Re-planted as a real file
directly under `node_modules/`, which fired.

## Judgment calls

- **Kept `create-next-app`'s `src/` layout.** Flattening would mean editing generated
  config (`tsconfig.json` paths, `components.json` aliases) away from what both the Next.js
  and shadcn CLIs emit and re-emit, for no gain. It also matches what chunk 02's gate
  already greps (`git ls-files 'src/**/*.ts' 'lib/**/*.ts'`). `project.md` § Layout
  describes the `src/` tree as it exists.

- **Vitest configured through `vitest.config.mts`, not the Next.js integration recipe.**
  The Next.js recipe adds `@vitejs/plugin-react` and jsdom, which exist to render
  components — this chunk renders nothing, and chunks 04/05 can add them when they have a
  component to render (YAGNI). Two measured corrections to the first draft: the file is
  `.mts` because `package.json` has no `"type": "module"` and a `.ts` config loads as
  CommonJS (Vite warned), and alias resolution uses Vite 8.3.0's native
  `resolve: { tsconfigPaths: true }` rather than the `vite-tsconfig-paths` plugin — Vite
  itself printed *"the plugin vite-tsconfig-paths is detected. Vite now supports tsconfig
  paths resolution natively"*, so the plugin was installed, then removed. Aliases are read
  from `tsconfig.json` rather than restated, so the two can't drift. Discovery shown above.

- **Principles: six, all derived from the plan, none invented.** The four the chunk brief
  mandates (no secret on the client; no model call in the render path; no request-time
  writable filesystem or git subprocess; no hand-authored fixtures) map to
  ORCHESTRATOR.md § Plan-Specific Constraints and Design Decisions 4 and 6. Two more were
  added from Design Decisions 1/"Complexity" and the bounded-analysis constraint: **one
  snapshot schema, one ingest path** (without it, "the view branches on provenance" is
  unreviewable) and **every live ingest is bounded before it starts** (chunk 06's main
  risk, and unenforceable if not written down before that chunk is planned). Each states
  what it forbids and what a violation looks like, so a reviewer can cite it rather than
  interpret it. Considered and **not** promoted: "Grain reports, never blocks or judges" —
  it is a product boundary already binding in SPEC.md § Non-Goals, and a seventh entry
  would push the list past the plan's "five or six you would actually block a PR over".

- **shadcn component library: Base UI, preset `nova`.** The CLI now prompts for a base
  (`base` / `radix` / `aria`) and a preset — neither existed when the plan was written, and
  `--yes` alone still hangs on both prompts. Took the CLI's own recommended defaults
  ("Base UI (Recommended)", "Nova") rather than overriding a scaffolder default on a guess.
  Consequence recorded in `project.md`: components depend on `@base-ui/react` 1.8.0, not
  Radix, so chunks 04–06 must read the Base UI API for `select`, `slider` and `dialog`.

- **`AGENTS.md` kept, `CLAUDE.md` not touched.** `writeAgentFiles` in
  `node_modules/next/dist/server/lib/generate-agent-files.js` (next@16.3.5) writes its
  rules block into `AGENTS.md` when that file exists and hosts the block, and returns
  `claudeMd: 'skipped'`. With `AGENTS.md` deleted it takes the `claudeMdExists` branch and
  upserts the block into `CLAUDE.md` instead. Keeping the scaffolder's `AGENTS.md` is what
  protects the project's own instructions file. Verified empirically: `shasum -c` on
  `CLAUDE.md` after a full `pnpm dev` cycle → `CLAUDE.md: OK`.

- **`@types/node` bumped from the scaffolder's `^20` to `^24`.** `pnpm add -D vitest`
  reported `✕ unmet peer @types/node@"^22.0.0 || >=24.0.0": found 20.19.43`. The machine
  runs Node v24.13.0, so `^24` (resolved 24.13.6) both satisfies the peer and matches the
  runtime the types are meant to describe.

- **Left `.claude/resources/project.md`'s `id:` frontmatter field in place.**
  `bibles/prompt-engineering/conventions/frontmatter-slim.md` says to remove `id` and slim
  opportunistically when touching a prompt file. Every file under `.claude/resources/`
  carries one, so removing it from this file alone makes the resource set inconsistent, and
  nothing in this chunk's scope establishes whether anything resolves files by `id`.
  Reported rather than fixed — see Left alone.

## Deviations from the plan

- **The plan's gate invocation `pnpm test --run` does not work, in either tree.** pnpm
  consumes `--run` as its own option before the script starts: ` ERROR  Unknown option:
  'run'` / `For help, run: pnpm help test`. This matters beyond a typo — it is the *same*
  error the base tree produces for a completely different reason (no `package.json`), so
  the plan's gates 1 and 2 would have "failed on base" and then failed identically on the
  finished tree, and the falsification would have proved nothing. Substituted `pnpm test`
  (the `test` script is already `vitest run`); `pnpm test -- --run` also works and is
  equivalent. `project.md` § Commands records the invocation and the trap.

- **Vitest does not silently pass an empty run, contrary to what I first wrote into
  `project.md`.** Measured on vitest@5.0.1: an include pattern matching nothing exits **1**
  with `No test files found, exiting with code 1`. The `project.md` bullet was corrected to
  the measurement: the exit code is meaningful for a fully empty run, but a *single* spec
  outside the include pattern is skipped silently while other specs keep the run green —
  which is why gate 2's passing-count assertion still earns its place.

- **`@dagrejs/dagre` ships its own types, so `@types/dagre` was not added** — as the plan
  allowed for. Worth recording *how* that was nearly got wrong:
  `find node_modules/@dagrejs/dagre -name '*.d.ts'` returned **nothing**, which reads as
  "ships no types". `node_modules/@dagrejs/dagre` is a pnpm symlink and `find` does not
  follow symlinks by default. `ls` on the resolved path shows
  `dist/types/index.d.ts` present, matching the manifest's `"types"` field. A false absence
  from a blind search, exactly the shape `evidence.md` warns about; noted in `project.md`
  § Conventions.

- **Scaffolder output differs from the plan's description in several places, and was
  treated as authoritative.** `create-next-app` emitted Next.js **16.3.5** with Turbopack,
  ESLint **9** flat config (`eslint.config.mjs`), Tailwind **4** via `@tailwindcss/postcss`
  with no `tailwind.config.*` file at all, and scripts `dev`/`build`/`start`/`lint` — so
  only `test` and `typecheck` were added. It also emitted `AGENTS.md` + `CLAUDE.md`, which
  the plan's "preserve these four" list did not anticipate; the scaffolder's `CLAUDE.md`
  (`@AGENTS.md`) was discarded and the repository's kept.

- **`.gitignore`: appending the scaffolder's entries was not sufficient.** Its `.env*` rule
  also ignores the `.env.example` the plan requires to be committed. Added an explicit
  `!.env.example` negation. The pre-existing `.worktrees/` entry is intact at the top of
  the file and verified ignored (`git check-ignore -q .worktrees/x`).

- **Convention Map — `src/lib/**` cites no bible page. Raised as a rule/plan conflict,
  arbitrated by the lead, resolved in favour of the plan.** The SWE decision tree routes
  "design a new service or module with a public API" to
  `bibles/swe/patterns/service-design.md`, but that page's § "Interface-first (mandatory
  for shared services)" requires an interface in `contracts/`, an `@Injectable()` class
  implementing it, and a NestJS provider token (§ "NestJS provider registration") — a
  DI-container pattern whose purpose is swapping implementations. ORCHESTRATOR.md
  § Complexity decides the opposite for this project: *"No layer, base class, or registry
  is introduced. Ingest, enrichment and view derivation are standalone functions over plain
  objects"*, and rejects the alternative by name as *"an abstraction with exactly one
  implementation, built for a non-goal."*

  **Ruling (lead, 2026-09-20, after reading the page):** the decision-tree row matches on
  the words, not the situation; the plan's Complexity decision wins and `—` is correct per
  `project.md`'s own rule against citing a page that does not carry the rule. This is
  **closed, not open** — chunks 02–06 should not re-litigate it. A note recording the
  ruling and naming both conflicting sections now sits under the Convention Map table in
  `.claude/resources/project.md`, so the next reader can check the sources rather than take
  the ruling on trust.

  `src/app/**/route.ts` does cite `bibles/swe/patterns/orchestrator-pattern.md`, which fits
  without conflict — the live route sequences `lib/` functions and must hold no domain
  logic.

## project.md deltas

The whole file, from placeholders to measurement. Section by section:

- **Stack** — every version read from `node_modules/<pkg>/package.json` via `node -e` on
  2026-09-20; `node --version` (v24.13.0) and `pnpm --version` (9.15.4) for the toolchain;
  Vite 8.3.0 read from the `node_modules/.pnpm` directory name. `package.json` ranges are
  not recorded anywhere in the section. Includes the six later-chunk dependencies with
  their resolved versions and which chunks use them.
- **Commands** — seven rows, each command executed before being written down (evidence in
  the Gates table). Plus three measured behavioural traps: `pnpm test --run` being eaten by
  pnpm, `pnpm lint` covering 15 real files (counted with `eslint --format json`, so the
  "runs but reads nothing" shape is ruled out by measurement rather than assumption), and
  what a zero exit from `pnpm test` does and does not prove.
- **Principles** — six, dated 2026-09-20, derived as described under Judgment calls.
- **Convention Map** — seven rows: app/page components, `src/components/ui/**`,
  `src/lib/**`, route handlers, specs, fixture/snapshot JSON, and tool-owned config. Gates
  per row are the exact commands from § Commands. `bibles/swe/testing.md` cited on both the
  spec row and the snapshot-data row, as the chunk requires — the spec row carries that
  page's "assert the resolved value, not the input" rule and the snapshot row carries
  "captured real output, not a hand-crafted approximation".
- **Test file convention** — co-located `<module>.test.ts(x)` under `src/`, include pattern
  quoted verbatim from `vitest.config.mts`, with the observed discovery output and the
  canary that proves a non-matching pattern is caught.
- **Conventions** — seven entries, each one something measured in this chunk that would
  otherwise be rediscovered the hard way (the `AGENTS.md`/`CLAUDE.md` mechanism, the
  `.env.example` negation, `.mts`, native tsconfig paths, `cn` being a package re-export,
  shadcn's three required flags, and `find` not following pnpm symlinks).
- **Layout** — the `src/` tree as it exists on disk, plus a closing paragraph naming the
  boundary the Principles police (`src/app/**/route.ts` vs everything else).

## Left alone

- **`id:` in `.claude/resources/project.md`'s frontmatter.** `frontmatter-slim.md` says to
  remove it. Left in place because every sibling under `.claude/resources/` has one and a
  single-file change makes the set inconsistent; a sweep is its own chunk.
- **The default `create-next-app` landing page and `README.md`.** Still the scaffolder's
  boilerplate. Chunk 04 replaces `src/app/page.tsx` with the canvas; rewriting either now
  is scope this chunk was not given.
- **`src/app/globals.css` as `shadcn init` rewrote it.** Not reviewed line by line and not
  edited — it is CLI output, and the "generated by the tool that owns it" rule in the
  Convention Map applies to it.
- **The `shadcn` package now sitting in `dependencies`.** The CLI added itself there rather
  than to `devDependencies` when it ran `init`. It is a build-time tool, so the placement
  is arguably wrong, but moving it means hand-editing what the CLI wrote — reported rather
  than changed.
- **`@types/react` / `@types/react-dom` left at the scaffolder's `^19`** (resolved 19.3.0).
  Only `@types/node` was bumped, and only because a peer dependency demanded it.
- **`public/*.svg`** — the scaffolder's Next.js/Vercel logos, unused once the landing page
  is replaced. Left for whichever chunk replaces the page.
