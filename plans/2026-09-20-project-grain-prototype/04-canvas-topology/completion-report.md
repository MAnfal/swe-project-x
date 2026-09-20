# Chunk 04 — Completion Report

Branch `feat/project-grain-prototype--canvas-topology`, worktree
`/Users/anfal/Projects/hobby_projects/swe-take-home/.worktrees/04-canvas-topology`,
base `a2b8565`. Commits: `de50039` (derivation, layout, catalog), `5f27970` (components),
plus this report.

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `src/lib/snapshots/xyflow-xyflow-2026-08-31.json` | created | T000. Captured output of the committed ingester, produced by replaying chunk 02's HTTP transcript. Never hand-edited. Every spec in this chunk reads it |
| `src/lib/view/derive.ts` | created | Pure derivation: active set, per-package direct/indirect counts grouped by the package a change came through, the drawn edges, the change-volume histogram, history bounds, presets, focus neighbourhood, nearest-activity window |
| `src/lib/view/derive.test.ts` | created | T001–T003 plus the snapshot-without-enrichment case and the determinism case |
| `src/lib/view/layout.ts` | created | T006. dagre positioning, out of the render path. Converts dagre's centre coordinates to React Flow's top-left positions |
| `src/lib/view/layout.test.ts` | created | T004 |
| `src/lib/view/catalog.ts` | created | The committed snapshots, each parsed through `snapshotSchema`, exposed as `listSnapshots()` / `getSnapshot(id)` |
| `src/lib/view/catalog.generated.ts` | created (generated) | Static `import` per snapshot file. This is what puts the JSON in the bundle — see § Deployment measurement |
| `src/lib/view/catalog.test.ts` | created | Asserts the generated index equals the directory listing (the staleness guard), and that the entry's fields come from the snapshot rather than a hardcoded row |
| `src/lib/view/fixture.ts` | created | Test support: reads and schema-parses the committed snapshot |
| `scripts/build-snapshot-index.mts` | created | Regenerates `catalog.generated.ts` from `src/lib/snapshots/`. Runs as `prebuild` |
| `package.json` | edited | Added `"prebuild": "node scripts/build-snapshot-index.mts"` |
| `src/components/canvas/package-node.tsx` | created | T007. The custom React Flow node |
| `src/components/canvas/topology-canvas.tsx` | created | T008. The one React Flow instance: pan/zoom, controls, minimap, legend, focus |
| `src/components/canvas/time-slider.tsx` | created | T009. Two handles, date readout, histogram, presets |
| `src/components/canvas/empty-window.tsx` | created | The empty state (design page 7) |
| `src/components/canvas/repository-picker.tsx` | created | T010. Rows come from the catalog |
| `src/components/canvas/grain-workspace.tsx` | created | T011. Client composition holding the selected repository, range and focus |
| `src/app/page.tsx` | edited | Replaced the create-next-app placeholder; hands the client the committed snapshots |
| `src/app/layout.tsx` | edited | Title/description, and a body that fills the viewport so the canvas can |

## Acceptance criteria

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| Every app and package appears as a node on a pannable, zoomable canvas | yes | `pnpm build && pnpm start`, page opened in Chrome at 1500×940: the a11y tree lists ten `button` nodes, one per package (`@xyflow/eslint-config`, `@xyflow/react`, `@xyflow/rollup-config`, `@xyflow/svelte`, `@xyflow/system`, `@xyflow/tsconfig`, `astro-examples`, `playwright`, `react-examples`, `svelte-examples`) plus `Zoom In` / `Zoom Out` / `Fit View` and a `Mini Map`. `layoutGraph` covers the node set in `layout.test.ts > returns one positioned node per input node` |
| Packages with a pull request in range are active, others inactive, distinguished by more than colour | yes | `derive.test.ts > marks every package a pull request reached in the range as active` and `> leaves a package with no pull request in the range inactive`. Non-colour distinction measured on the rendered page: untouched `{opacity: "0.45", borderTopStyle: "dashed"}`, direct and indirect both `{opacity: "1", borderTopStyle: "solid"}` (computed styles read from the live DOM) |
| An active package node shows direct and indirect counts, naming the package they came through | yes | `derive.test.ts > groups the indirect count by the package the change came through`. Rendered accessible names: `"@xyflow/react — 3 direct, 2 via @xyflow/system"`, `"astro-examples — 3 via @xyflow/react, 2 via @xyflow/svelte, 1 via @xyflow/system"` |
| Dependency edges are drawn only between touched packages; indirect reach is visually distinct | yes | `derive.test.ts > draws a dependency edge only when both ends are active` and `> draws a reach edge from the touched package into the package it reached`. On the rendered page the edge a11y names separate the two kinds (`"@xyflow/react depends on @xyflow/system"` vs `"3 changes reached astro-examples via @xyflow/react"`); a reach is dashed violet (`strokeDasharray: '6 4'`), a dependency solid grey |
| A focused package shows its neighbourhood and not the rest | yes | `derive.test.ts > returns the focused package and the active packages adjacent to it`. Verified in the browser: clicking `@xyflow/svelte` leaves four nodes on the canvas (`@xyflow/svelte`, `@xyflow/system`, `svelte-examples`, `astro-examples`) and shows the `Focused on @xyflow/svelte — showing its neighbours only Esc` pill |
| The slider shows full history, the range as dates, where volume clusters, and 7/30/90/all presets | yes | `derive.test.ts > covers the full history from the first bucket to the last`, `> leaves no gap between one bucket and the next`, `presetRange` block. Rendered: readout `Aug 31 – Sep 2, 2026`, `2 days · 6 changes · 6 packages touched`, histogram bars behind the track, buttons `7d` `30d` `90d` `All time` plus a `Custom` pill, and **two** `slider` roles in the a11y tree |
| A range with no activity shows an empty state | yes | `derive.test.ts > returns an empty active set for a range nothing landed in`. Rendered: moving the right handle to the history start produced the `Nothing landed in this window` card with `NEAREST ACTIVITY … Jump to that window` and `Or widen: Last 90 days / All time`, header reading `0 changes · 0 of 10 packages touched` |
| Derivation is deterministic | yes | `derive.test.ts > returns the same active set and the same counts when it runs twice`, `> returns the same series when it runs twice`, `layout.test.ts > returns the same positions for the same input` |
| The picker lists the snapshots actually present, not a hardcoded list | yes | `catalog.test.ts > lists every snapshot committed to the directory, and nothing else` — proven to fail when they diverge (see § Gates, staleness probe). Gate 2 proves no curated repository name appears in any source file |

## Tests

`pnpm test` reported **94 passed (94)** on the base tree and **135 passed (135)** now — 41
new assertions across four new spec files.

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| `src/lib/view/derive.test.ts` — the whole file (T001, T002, T003, snapshot-without-enrichment) | `FAIL src/lib/view/derive.test.ts [ src/lib/view/derive.test.ts ]` / `Error: Cannot find package '@/lib/view/derive' imported from …/src/lib/view/derive.test.ts` → `Test Files 2 failed \| 7 passed (9)` | `Test Files 10 passed (10) / Tests 135 passed (135)` |
| `src/lib/view/layout.test.ts` (T004) | Same import failure first; then after `derive.ts` existed, six of seven cases failed at runtime with `TypeError: default.Graph is not a constructor` at `layoutGraph src/lib/view/layout.ts:43:17` → `Tests 6 failed \| 121 passed (127)` | as above |
| `derive.test.ts > nearestActivity` (three cases, added for the empty state) | `TypeError: nearestActivity is not a function` at `src/lib/view/derive.test.ts:288:12` → `Tests 3 failed \| 132 passed (135)` | as above |
| `src/lib/view/catalog.test.ts` (five cases) | `FAIL src/lib/view/catalog.test.ts` / `Error: Cannot find package '@/lib/view/catalog' imported from …/src/lib/view/catalog.test.ts` → `Test Files 1 failed \| 9 passed (10)` | as above |

The layout red run is worth keeping: it is not a "module missing" failure but a real
measurement — see § Deviations.

## Gates

Baseline captured on the base tree (`a2b8565`) in this worktree before any edit, at
`/private/tmp/claude-501/-Users-anfal-Projects-hobby-projects-swe-take-home/71fa1585-6824-49ad-8941-37a0ae5c8eb4/scratchpad/baseline/`:
`pnpm lint` exit 0 with **no output**, `pnpm test` **94 passed (94)** in 7 files,
`pnpm typecheck` exit 0 with no output, `pnpm build` exit 0. **Zero pre-existing errors and
zero warnings**, so every result below is also the delta.

All four standard gates were re-run **after the last edit**, in order, type check last.

| Gate | Command | Result | Fails on base? |
| ---- | ------- | ------ | -------------- |
| Lint | `pnpm lint` | exit 0, no output | No — base is clean too. `pnpm exec eslint --max-warnings 0` also exits 0 with no output, so "lint passed" here does mean "lint had nothing to say" |
| Unit tests | `pnpm test` | exit 0, `Test Files 10 passed (10)` / `Tests 135 passed (135)` | Yes, for this chunk's specs: on base they fail to import (`Cannot find package '@/lib/view/derive'`). The base suite itself passes at 94 |
| Build | `pnpm build` | exit 0, `✓ Compiled successfully`, `Finished TypeScript in 2.1s`, `Route (app) ┌ ○ /` — statically prerendered | No — base builds clean. Falsified by canary instead (below) |
| Type check | `pnpm typecheck` | exit 0, no output | No — base is clean. Falsified by canary instead (below) |
| Gate 2 — no curated repository name in source | see script below | exit 0, `gate 2: scanning 38 source files` / `gate 2: PASS` | **No, and it cannot.** See the honest note below |
| Gate 3 — inactive is not colour alone | see script below | exit 0, `gate 3: PASS — the states differ by non-colour properties, not hue alone` with `inactive: 76: 'border-dashed border-muted-foreground/50 bg-transparent opacity-45'` and `active: 77: : 'border-solid bg-card shadow-sm'` | **Yes**, exit 1: `FAIL: src/components/canvas/package-node.tsx is missing — the gate has nothing to check` |

### Gate 2 cannot fail on the base tree — reporting it rather than claiming a pass

Gate 2 is a content gate proving **absence**. On the base tree there is no repository
picker at all, so it passes vacuously:

```
$ GATE_ROOT=<base tree extracted from a2b8565> bash gate2.sh
gate 2: scanning 24 source files
gate 2: PASS — no curated repository name appears in source
gate2_on_base_exit=0
```

Per `gates.md`, a gate proving content was *removed* is falsified by planting the needle,
not by the base tree. Three probes were run, one per needle, each planted in
`src/components/canvas/repository-picker.tsx`:

```
--- probe: xyflow/xyflow ---
FAIL: "xyflow/xyflow" is hardcoded in source:
src/components/canvas/repository-picker.tsx:55:const CANARY = ["xyflow/xyflow"];
  => gate exited 1 for xyflow/xyflow
--- probe: shadcn-ui/ui ---
FAIL: "shadcn-ui/ui" is hardcoded in source:
src/components/canvas/repository-picker.tsx:55:const CANARY = ["shadcn-ui/ui"];
  => gate exited 1 for shadcn-ui/ui
--- probe: trpc/trpc ---
FAIL: "trpc/trpc" is hardcoded in source:
src/components/canvas/repository-picker.tsx:55:const CANARY = ["trpc/trpc"];
  => gate exited 1 for trpc/trpc
working state restored byte-for-byte
--- after restore ---
gate 2: scanning 38 source files
gate 2: PASS — no curated repository name appears in source
  => gate returns clean once the canary is removed
```

Restored by `cp` from a copied backup, never `git checkout --`, and `git status --porcelain`
was empty afterwards.

**The plan's gate-2 recipe as written is blind to an uncommitted file.** Its corpus is
`git ls-files 'src/**/*.ts' 'src/**/*.tsx'`, which lists tracked files only. My first probe
run planted the canary in an as-yet-uncommitted `repository-picker.tsx` and the gate
reported PASS. The gate I ran unions tracked with
`git ls-files --others --exclude-standard`, which is what `gates.md` § "An empty corpus"
prescribes, and which raised the corpus from 24 to 38 files:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "${GATE_ROOT:-<worktree>}"
corpus=$( { git ls-files 'src/**/*.ts' 'src/**/*.tsx'; \
            git ls-files --others --exclude-standard 'src/**/*.ts' 'src/**/*.tsx'; } | sort -u )
count=$(printf '%s\n' "$corpus" | grep -c . || true)
[ "$count" -ge 1 ] || { echo "FAIL: empty corpus — this gate would pass vacuously" >&2; exit 1; }
echo "gate 2: scanning $count source files"
g2_fail=0
for g2_needle in 'xyflow/xyflow' 'shadcn-ui/ui' 'trpc/trpc'; do
  g2_hits=$(printf '%s\n' "$corpus" | xargs grep -nE "\"$g2_needle\"" 2>/dev/null \
            | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*)' || true)
  if [ -n "$g2_hits" ]; then
    echo "FAIL: \"$g2_needle\" is hardcoded in source:" >&2; printf '%s\n' "$g2_hits" >&2; g2_fail=1
  fi
done
[ "$g2_fail" -eq 0 ] || exit 1
echo "gate 2: PASS — no curated repository name appears in source"
```

Each needle is checked separately rather than as one `grep -E 'a|b|c'`, so a hit names which
one matched.

### Gate 3 — completed against the component this chunk wrote

The plan left gate 3 to be written against the real component. The claim under test is that
active and inactive differ in a **non-colour** property, so it is asserted on both sides:
the inactive class literal must carry `opacity-<n>` **and** `border-dashed`, and the active
one must carry `border-solid`. Only class-list string literals are searched and comment
lines are excluded — the comment above that branch says "a dashed border and reduced
opacity" in prose, and a bare-word grep would make rewording the comment a way to satisfy
the gate.

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "${GATE_ROOT:-<worktree>}"
FILE=src/components/canvas/package-node.tsx
[ -f "$FILE" ] || { echo "FAIL: $FILE is missing — the gate has nothing to check" >&2; exit 1; }
# A class literal alone on its line, optionally preceded by a ternary arm's ? or :.
literals=$(grep -nE "^[[:space:]]*([?:][[:space:]]*)?'[^']*',?$" "$FILE" \
           | grep -vE ':[0-9]+:[[:space:]]*(//|\*)' || true)
[ -n "$literals" ] || { echo "FAIL: no class-list literal found in $FILE" >&2; exit 1; }
inactive=$(printf '%s\n' "$literals" | grep -E "opacity-[0-9]+" | grep -E "border-dashed" || true)
active=$(printf '%s\n' "$literals" | grep -E "border-solid" || true)
fail=0
printf '%s\n' "$inactive" | grep -qE "border-dashed"   || { echo "FAIL: no inactive class literal sets a dashed border" >&2; fail=1; }
printf '%s\n' "$inactive" | grep -qE "opacity-[0-9]+"  || { echo "FAIL: no inactive class literal reduces opacity" >&2; fail=1; }
printf '%s\n' "$active"   | grep -qE "border-solid"    || { echo "FAIL: the active treatment does not set border-solid, so the border style does not distinguish the states" >&2; fail=1; }
[ "$fail" -eq 0 ] || exit 1
echo "gate 3: PASS — the states differ by non-colour properties, not hue alone"
printf '  inactive: %s\n' "$inactive"; printf '  active:   %s\n' "$active"
```

Three probes, one per needle, each restored from a copied backup:

```
--- probe: inactive loses opacity (colour + dashes remain) ---
FAIL: no inactive class literal sets a dashed border
FAIL: no inactive class literal reduces opacity
  => gate exited 1
--- probe: inactive loses the dashed border (colour + opacity remain) ---
FAIL: no inactive class literal sets a dashed border
FAIL: no inactive class literal reduces opacity
  => gate exited 1
--- probe: active loses border-solid (only hue would separate the states) ---
FAIL: the active treatment does not set border-solid, so the border style does not distinguish the states
  => gate exited 1
working state restored byte-for-byte
--- after restore ---
gate 3: PASS — the states differ by non-colour properties, not hue alone
```

(The first two probes print both inactive messages because `inactive` requires both tokens
on the same literal — removing either empties the set. That is correct, just chatty.)

The gate reads the source, so it was corroborated against the **rendered** output. Computed
styles read from the live DOM of the built app:

```json
{"count":10,
 "direct":   {"label":"@xyflow/react — 3 direct, 2 via @xyflow/system","opacity":"1","borderTopStyle":"solid"},
 "indirect": {"label":"astro-examples — 3 via @xyflow/react, 2 via @xyflow/svelte, 1 via @xyflow/system","opacity":"1","borderTopStyle":"solid"},
 "untouched":{"label":"@xyflow/eslint-config — untouched in this window","opacity":"0.45","borderTopStyle":"dashed"}}
```

Direct versus indirect does not rest on hue either: both the visible badge and the
accessible name spell out "3 direct" and "2 via @xyflow/system".

### Build and type-check falsification (canary, since base is clean)

A canary in `src/lib/view/derive.ts` — a module no route imports directly — confirms the
build really type-checks this chunk's new directory:

```
pnpm build     -> exit 1
src/lib/view/derive.ts(280,7): error TS2322: Type 'string' is not assignable to type 'number'.
pnpm typecheck -> exit 2
src/lib/view/derive.ts(280,7): error TS2322: Type 'string' is not assignable to type 'number'.
restored byte-for-byte from the copied backup
=== after restore ===
pnpm build     -> exit 0
pnpm typecheck -> exit 0
```

### The picker's discovery claim, falsified directly

The acceptance criterion is "lists the snapshots actually present". `catalog.test.ts`
enforces it, and the probe proves the enforcement is real — a snapshot file dropped into
the directory without regenerating the index turns the suite red:

```
=== canary: a snapshot lands in the directory without the index being regenerated ===
pnpm test -> exit 1
     × lists every snapshot committed to the directory, and nothing else 6ms
 FAIL  src/lib/view/catalog.test.ts > the snapshot catalog > lists every snapshot committed to the directory, and nothing else
AssertionError: expected [ 'xyflow-xyflow-2026-08-31.json' ] to deeply equal [ …(2) ]
      Tests  1 failed | 134 passed (135)
=== after removing the probe file ===
xyflow-xyflow-2026-08-31.json
pnpm test -> exit 0
 Test Files  10 passed (10)
      Tests  135 passed (135)
```

**This is the mechanism that will catch chunk 03.** When their snapshots land in
`src/lib/snapshots/`, `pnpm test` goes red until `node scripts/build-snapshot-index.mts` is
re-run (or `pnpm build`, which runs it). Worth telling them at the merge.

## Deployment measurement — how the picker discovers snapshots

Measured rather than assumed, as the dispatch asked.

**What I chose: a build-time-generated index of static imports.**
`scripts/build-snapshot-index.mts` reads `src/lib/snapshots/` and writes
`src/lib/view/catalog.generated.ts`, one `import … from '../snapshots/<file>.json'` per
snapshot. It runs as `prebuild`; the generated file is also committed so `pnpm dev` and
`pnpm test` work without running it, and `catalog.test.ts` fails if the committed copy has
drifted. Nothing reads the filesystem at request time, at build time, or anywhere outside
the test runner.

**The measurement.** `pnpm build`, then `pnpm start`, then the page fetched over HTTP:

```
$ curl -s -o page.html -w '%{http_code}\n' http://localhost:3000/
200
$ grep -c 'xyflow/xyflow' page.html
1
```

The repository is listed in the served output. Then, tracing where the data actually lives —
probing for a merge SHA that only exists inside the snapshot:

```
$ SHA=0a1f9575b25679f2880175de8d3eae21aedde921
$ grep -rl "$SHA" .next | sort
.next/server/app/index.html
.next/server/app/index.rsc
.next/server/app/index.segments/__PAGE__.segment.rsc
.next/server/app/index.segments/_full.segment.rsc
.next/server/chunks/ssr/src_0m27bux._.js
.next/server/chunks/ssr/src_0m27bux._.js.map

$ find .next -path '*snapshots*' -name '*.json'
(no output)
```

The snapshot's **content** is compiled into the server chunk and into the prerendered
payload; **no copy of `src/lib/snapshots/` exists anywhere in the build output.** That is
the trap, confirmed: a request-time `readdir('src/lib/snapshots')` has nothing in the built
artifact to read, and would only appear to work locally because the source tree happens to
sit next to `.next` under `pnpm dev` and `pnpm start`. I did not deploy to Vercel, so I am
not claiming a measurement of Vercel's tracer — what I measured is that Next's own build
output carries the data and not the directory, which is sufficient reason to prefer the
static-import index.

The route is reported as `○ (Static) prerendered as static content`, so in practice nothing
runs at request time at all. Keeping the range in component state rather than in a search
param is part of what preserves that (see § Judgment calls).

## Judgment calls

- **Range in component state, not the URL.** Chosen because the URL is chunk 06's surface —
  it owns `Other…`, the repository URL input and the back arrow, and a query param added
  here would be rewritten there — and because keeping the range out of `searchParams` keeps
  `/` statically prerenderable, which is what makes the deployment measurement above hold.
  **The cost: a scrubbed view cannot be shared as a link.** If that matters, it is a small
  change (`useSearchParams` + `router.replace`) and it should be made in chunk 06, together
  with the repository parameter, so there is one URL contract rather than two.

- **Histogram, not a sparkline.** The designs (page 10) say "Histogram — merged changes per
  bucket across the repo's whole life. Bars inside the range are lit; outside they stay
  muted." A sparkline implies a continuous quantity; merges are discrete events in a bucket,
  and lighting individual bars is what makes the selected range legible against the whole
  history. **When one window dominates:** bar heights are on a **square-root** scale, not
  linear. On a linear scale one release week with ten times the merges of a quiet week
  renders full-height while every other bar rounds to nothing, and the histogram stops
  showing where change clusters and shows only where it peaked. The square root keeps the
  tall bar tallest while leaving quiet weeks legible, and a non-empty bucket never renders
  shorter than 8% of the track height — so "some activity" is never visually identical to
  "none". Empty buckets render as a 2% sliver, which is why a quiet stretch reads as quiet
  rather than as missing data. Default resolution is 64 buckets across the whole history.

- **Focus on click, not hover.** Hover-to-focus fights panning: the pointer crosses nodes on
  its way anywhere, and the graph would reshape under the cursor mid-drag. Click is also
  what makes the interaction reachable from the keyboard here — **the node body is a real
  `<button>`**, so `Tab` reaches it and `Enter`/`Space` fire the same handler natively, with
  `aria-pressed` reflecting the toggle. React Flow's own node focus ring is switched off
  (`nodesFocusable={false}`) so the tab order has one stop per node instead of two.
  `Escape` clears focus, as the focus pill says, via a `keydown` listener mounted only while
  focus is active. Verified in the browser: the a11y tree lists ten buttons with names like
  `"@xyflow/react — 3 direct, 2 via @xyflow/system"`.

- **What the installed shadcn slider supports for two handles: everything needed, no new
  dependency.** Measured against the committed `src/components/ui/slider.tsx` and
  `@base-ui/react@1.8.0`. The shadcn wrapper already computes
  `_values = Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]`
  and renders `Array.from({length: _values.length}, … <SliderPrimitive.Thumb/>)` — one thumb
  per value, defaulting to **two**. `SliderRoot` is generic over
  `Value extends number | readonly number[]`, and also offers `minStepsBetweenValues`,
  `largeStep` and `thumbCollisionBehavior: 'push' | 'swap' | 'none'`. I pass
  `value={[from, to]}` with `minStepsBetweenValues={1}`. Confirmed at runtime: the rendered
  a11y tree contains two `slider` roles and two `input[type=range]` elements sharing one
  min/max. **No new dependency was added.**

- **Presets anchor to the end of the snapshot's history, not to `Date.now()`.** A snapshot is
  a recording; "the last 7 days" of a recording means the last seven days it contains.
  Anchoring to the wall clock would make the same snapshot derive differently on different
  days, which the SPEC's reproducibility metric forbids, and on this two-day capture every
  rolling preset would be empty. Presets clamp to the history start, so on this snapshot
  7d/30d/90d/all-time all collapse to the whole capture; the active-preset indicator
  searches from the widest end so the pill that lights up is the honest one (`All time`).

- **The slider's arrow-key step follows the span.** A day-sized nudge is meaningless on a
  two-day capture and essential on a three-year one, so the step is one day when the history
  is ≥ 60 days and one hour otherwise, and the keyboard hint text follows it ("← → nudge an
  hour" on this snapshot). The designs' hint reads "nudge a day"; see § Deviations.

- **History bounds come from `metadata.window`, widened to contain any pull request outside
  it.** The declared window is what was asked for and what the snapshot claims to cover; the
  widening exists so a merge outside it could never be unreachable by any range. Measured on
  this snapshot: the bounds are exactly the declared window.

- **All snapshots are serialized to the client, not just the selected one.** Four committed
  snapshots at ~24KB each is fine for a prototype and keeps the page static. It will not
  scale — see § Left alone.

## Deviations from the plan, and design contradictions

- **`@dagrejs/dagre`'s default export does not carry `Graph`.** The plan and the
  `dagre.layout(...)` idiom imply `import dagre from '@dagrejs/dagre'`. Measured against the
  installed 3.1.1: `import * as ns` gives
  `['Graph','debug','default','graphlib','layout','util','version']` but
  `Object.keys(ns.default)` is `['graphlib','version','layout','debug','util']` — **no
  `Graph`**. `new dagre.Graph(...)` throws `TypeError: default.Graph is not a constructor`,
  which is the layout spec's red run. The measurement wins: `layout.ts` uses named imports
  (`import { Graph, layout, type EdgeLabel, type GraphLabel, type NodeLabel }`), and the
  reason is recorded in a comment beside the call.

- **React Flow under server rendering: no explicit dimensions are required, but they are set
  anyway.** `@xyflow/react@12.11.6` exports `Background`, `Controls`, `MiniMap`,
  `MarkerType`, `Panel`, `Position`, `Handle`, `NodeProps`, `NodeTypes` and `ReactFlow` from
  the package root (`Background`/`Controls`/`MiniMap` via `export * from './additional-components'`).
  Registration is `nodeTypes={{ package: PackageNode }}`, hoisted to module scope so a new
  object each render does not remount every node. The canvas is a client component, so SSR
  never measures a node; `width`/`height` are still set on each node from the same values
  dagre used, because otherwise the first `fitView` runs before measurement and frames the
  graph wrongly. Verified visually: the graph is framed correctly on first paint.

- **The fixture the plan originally named does not exist — the amendment is correct.** T000
  ran exactly the command in § Context and produced
  `xyflow/xyflow 2026-08-31T00:00:00Z..2026-09-02T00:00:00Z: 10 packages, 6 pull requests`,
  exit 0, a 24,190-byte file with top-level keys `['metadata','packages','pullRequests']`
  and no `enrichment` — matching the lead's measurement exactly.

- **Design contradiction (page 4/11 vs the plan): edges are not labelled.** My first pass put
  `N via <package>` on each reach edge. The designs do not label edges at all — the count and
  the package it came through live on the target node's badge — and with sixteen edges over
  ten nodes the labels were unreadable. Removed; the information is now on the node badge and
  in each edge's `aria-label`. **The design wins.**

- **Design contradiction (page 4 vs this chunk's scope): the `Expand N changes →` affordance
  is not built.** Page 4 shows it beneath the focused node. Expansion is chunk 05's
  deliverable, so it is deliberately absent. Flagging it so the reviewer does not read the
  gap as an oversight, and so chunk 05 knows where the designs put it.

- **Design contradiction (page 4 vs page 11): theme.** Page 4 is dark and page 11 is the light
  theme of the same screen. The app as chunk 01 left it renders light (`:root` is light, and
  nothing ever adds `.dark`), so what I built matches **page 11** exactly. Every colour is a
  semantic token or an amber/violet pair with a `dark:` variant, so a theme toggle would light
  up page 4 without touching this code — but no toggle was added, since none of the designs
  shows one and the plan does not ask for it.

- **Design element not built: the `main` branch chip and the `Legend` / `?` header buttons**
  (page 4, top right). The branch chip has no data behind it in the snapshot schema — nothing
  records the analyzed branch — and the Legend and help buttons open a panel and the
  onboarding tour, which is page 9 and chunk 05. The legend itself is rendered permanently on
  the canvas, as page 4 shows it.

- **`pnpm lint -- --max-warnings 0` does not work.** `project.md` § Commands suggests it as
  the way to make lint mean "nothing to say". Measured: pnpm forwards `--` literally and
  ESLint reads `--max-warnings` as a file pattern — `No files matching the pattern
  "--max-warnings" were found`, exit 2. The form that works is
  `pnpm exec eslint --max-warnings 0` (exit 0, no output here). This is the mirror image of
  the `pnpm test --run` note already in that file.

- **The plan's gate-2 recipe is blind to uncommitted files.** Documented above under § Gates.
  Worth correcting in the plan so a later chunk's probe is not silently vacuous.

## project.md deltas — for the lead to apply at the wave boundary

Not edited here, as instructed. Each item below was measured in this worktree on 2026-09-20.

1. **§ Commands — new command.** Add a row:
   `| Regenerate the snapshot index | `node scripts/build-snapshot-index.mts` — reads `src/lib/snapshots/` and rewrites `src/lib/view/catalog.generated.ts`. Runs automatically as `prebuild`, so `pnpm build` regenerates it |`

2. **§ Commands — `pnpm build` now runs a prebuild step.** `package.json` gained
   `"prebuild": "node scripts/build-snapshot-index.mts"`. Measured: pnpm 9.15.4 **does** run
   `pre*` lifecycle hooks (probe: a `prebuild` of `echo PREBUILD_RAN` printed before
   `next build`).

3. **§ Commands — correct the `--max-warnings` note.** `pnpm lint -- --max-warnings 0` exits
   **2** with `No files matching the pattern "--max-warnings" were found`. The working form
   is `pnpm exec eslint --max-warnings 0`.

4. **§ Convention Map — new row for generated source:**
   `| `src/**/*.generated.ts` | `pnpm test`, `pnpm build`, `pnpm typecheck` | Written by its generator, never hand-edited; committed so `pnpm dev`/`pnpm test` work without running the generator; a co-located spec asserts the committed copy still matches its source of truth | — |`

5. **§ Conventions — new entry, snapshot discovery:** *"The committed snapshots under
   `src/lib/snapshots/` are reached through `src/lib/view/catalog.ts`, never by reading the
   directory. The index it imports is generated by `scripts/build-snapshot-index.mts` as a
   list of static `import`s, because a source directory nothing imports is not carried into
   the build output — measured 2026-09-20: `find .next -path '*snapshots*' -name '*.json'`
   returns nothing while the snapshot's merge SHA appears in
   `.next/server/chunks/ssr/*.js`. Adding a snapshot means re-running the generator;
   `src/lib/view/catalog.test.ts` fails until you do."*

6. **§ Conventions — new entry, dagre's export shape:** *"`@dagrejs/dagre@3.1.1`'s **default**
   export carries `{graphlib, version, layout, debug, util}` and **not** `Graph` — so
   `import dagre from '@dagrejs/dagre'; new dagre.Graph()` throws `TypeError:
   default.Graph is not a constructor`. Use the named exports: `import { Graph, layout } from
   '@dagrejs/dagre'`. dagre reports a node's **centre**; React Flow positions by the
   **top-left** corner."*

7. **§ Layout — `src/lib/view/`** now exists: view derivation and the snapshot catalog. Same
   rules as the rest of `src/lib/` (standalone functions, relative `.ts` specifiers,
   co-located specs). `src/components/canvas/` holds this app's presentation components.

8. **§ Stack — no new dependency.** `@xyflow/react` 12.11.6 and `@dagrejs/dagre` 3.1.1 were
   already listed and are now in use; the two-handle slider needed nothing new.

## Left alone

- **Every committed snapshot is serialized into the RSC payload**, because `GrainWorkspace`
  is a client component that receives `snapshots` for all catalog entries. At four snapshots
  of ~24KB that is fine; once chunk 03's **enriched** snapshots land it may not be, since
  enrichment adds a record per merge SHA. The fix is to lift the selection into the route
  (a segment or a search param) so the server sends one snapshot — which is naturally chunk
  06's work, since it already has to put the repository in the URL. Not done here: it would
  make this chunk dynamic and undo the static-prerender property the deployment measurement
  rests on.
- **`pnpm dev` was not exercised.** `project.md` warns that `next dev` rewrites agent files
  on every start, and I did not want to dirty `AGENTS.md`/`CLAUDE.md` in this worktree. The
  stronger measurement — `pnpm build` plus `pnpm start` over HTTP — was done instead.
- **No component-rendering test framework was added.** There is no `jsdom` environment and no
  `@testing-library/react` in this project, and adding either is a dependency decision
  outside this chunk. Gate 3 therefore asserts against the component source, and I
  corroborated it by reading computed styles from the running app rather than by claiming
  the source grep proves the render.
- **The slider's day-granular readout rounds a sub-day window up.** A one-hour selection
  reads "1 day · no activity". The designs' readout is day-granular and every design example
  is multi-day; changing it would mean a second time format for a case the designs never
  show.
- **`src/lib/ingest/github.ts` exports a `WindowBounds` type** (`{since, until, …}`) that
  looks like this chunk's `DateRange`. It is not the same concept — it parameterizes the
  GitHub listing query — so it was not reused or consolidated. Noted in § Reuse audit.

## Reuse audit

Searched three ways before writing any date-range or grouping helper, as the plan required.
All searches uncapped.

- **By name** — `grep -rniE '\b(dateRange|histogram|bucket|groupBy|inRange|between|windowOf|clamp)\b' src scripts --include='*.ts' --include='*.tsx' --include='*.mts' -c`, run before any code was written and re-run afterwards. Excluding this chunk's own files, the only non-zero counts are 1 each in `src/lib/snapshot.ts` (the `window` **field name**), `src/lib/ingest/topology.ts`, `src/lib/ingest/ingest.ts` and `src/components/ui/select.tsx` (`SelectGroup`). **New: no existing implementation found.**
- **By algorithm** (`group`, `bucket`, `range`) — the uncapped listing over `src` and `scripts` returned only Tailwind class strings (`group/badge`, `group/card`, `slider-range`), `SelectGroup` in the shadcn primitive, and prose in comments. No bucketing or grouping utility exists. **New: no existing implementation found.**
- **By problem** (`window`, `between`, `histogram`) — the only real hits are ingest-side: `WindowBounds` in `src/lib/ingest/github.ts:94` and the window checks in `ingest.ts`. **Reuse considered and rejected:** `WindowBounds` parameterizes the GitHub listing query (it exists to bound the fetch), not a view range over an already-captured snapshot; importing it would tie the view layer to the ingest layer for a two-field object. No consolidation.
- **Schema types** — `Snapshot`, `PackageNode`, `PackageEdge`, `IndirectReach`, `PullRequestRecord` are **imported from `src/lib/snapshot.ts`**, never re-declared. `derive.ts` imports `PackageEdge`, `PullRequestRecord` and `Snapshot`; `catalog.ts` imports `snapshotSchema` and `Snapshot`.
- **Attribution** — `src/lib/ingest/attribution.ts` already resolves direct-wins precedence per pull request, so `deriveWindow` reads `directPackages`/`indirectPackages` off the snapshot rather than recomputing reachability. **Reuse: the snapshot's own attribution, computed once at ingest.**
