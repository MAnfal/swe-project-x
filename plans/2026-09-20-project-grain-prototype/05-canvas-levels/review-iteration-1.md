# Chunk 05 — Review iteration 1

**Verdict: FAIL**

## Verification performed

- Confirmed location: `pwd -P` → `.../swe-take-home/.worktrees/05-canvas-levels`,
  `git rev-parse --abbrev-ref HEAD` → `feat/project-grain-prototype--canvas-levels`,
  `git rev-parse HEAD` → `597c8b3`.
- Read rubric.md, plan.md, completion-report.md, project.md, design/README.md, and mid-fi
  pages 5, 6, 9.
- Read `src/lib/view/derive.ts`, `derive.test.ts`, `enrichment-record.ts`, and every new
  component (`change-card.tsx`, `step-card.tsx`, `changes-level.tsx`, `steps-level.tsx`,
  `level-breadcrumb.tsx`, `onboarding-tour.tsx`, `grain-workspace.tsx`, `topology-canvas.tsx`
  diff).
- Independently re-ran mutants M14 (deleted guard) and M14b (reverse-scan) reported as
  equivalent — confirmed `234 passed (234)` on both, and confirmed from the code itself
  (not just the fixtures) that the equivalence is structural: `fileGroups` puts each
  package's files into exactly one `FileGroup` (a `Map` keyed by package name), and
  `assignGroups` never splits a single group across two step slots — in either the
  right-align branch or the base/extra branch, a whole group is pushed into one slot. So
  "first owning step" and "last owning step" are provably the same step for **any** input,
  not only the committed snapshot. M14b's equivalence claim holds.
- Found and confirmed a new mutant not in the implementer's table (below) — this is what
  fails the review.
- Ran `git grep` for `ai`/`@ai-sdk` imports and `process.env` reads under
  `src/components`, `src/app`, `src/lib/view` — both exit 1 (no matches), confirming
  Principle 1 and Principle 2 independently.
- Confirmed no `@/` import inside the touched `src/lib/` files, and that repository-derived
  keys in the new code are grouped through `Map`, never a plain object — sidesteps the
  reserved-key hazard `assertSafeKey`/`buildRecord` guards against rather than needing it.
- Confirmed `plan.md`'s diff is checkbox ticks only, `completion-report.md` is committed,
  and the diff touches no file outside the chunk's stated scope (16 files, all listed in
  the completion report's table). No secrets in the diff.

## Issues (blocking)

1. **`assignGroups`'s remainder-distribution comparison is untested, reachable, and wrong
   under mutation — `src/lib/view/derive.ts:571`.**

   ```
   const size = base + (index < extra ? 1 : 0);
   ```

   This decides which steps absorb the "extra" file groups when a change's files span more
   packages than it has steps (a case the committed enriched snapshot already reaches:
   PR #5994 has 4 file groups over 3 steps, exercised by the `orders the file groups
   dependency-first` test). I flipped it to hand the remainder to the trailing steps
   instead of the leading ones:

   ```diff
   - const size = base + (index < extra ? 1 : 0);
   + const size = base + (index >= stepCount - extra ? 1 : 0);
   ```

   Ran `pnpm test`: `Test Files 12 passed (12)` / `Tests 234 passed (234)` — no test named
   anything failed. Restored from a copy in the scratchpad
   (`.../scratchpad/mutants/derive.ts.orig`), verified with `diff -q` (byte-identical), and
   re-ran `pnpm test` to confirm `234 passed (234)` returned — the same numbers as before
   the mutation, so nothing else was disturbed.

   This is not equivalent: for PR #5994 the real code produces step slots
   `[[react, svelte], [svelte-examples], [null]]`; the mutant produces
   `[[react], [svelte], [svelte-examples, null]]` — a visibly different set of files under
   each step number, which is exactly what `steps-level.tsx` and `step-card.tsx` render.
   A viewer would see different files attached to "Step 1" / "Step 2" / "Step 3" depending
   on which side of this comparison shipped, and no test says which is correct.

   The rubric's Test Coverage Checks require, for every boundary comparison added to the
   derivation module, "a test whose input is constructed... Grade by attempting to delete
   each guard and confirming a named test fails." This one wasn't a hard case needing a
   constructed input — the committed enriched snapshot already has a pull request that
   reaches the more-groups-than-steps branch with a non-trivial remainder (`extra > 0`),
   and no existing test pins which end of the chain gets it. The existing tests
   (`accounts for every changed file exactly once`, `orders the file groups
   dependency-first`) both check aggregate/ordering properties that survive this mutation
   because the group *order* is untouched — only the step *boundaries* move — so neither
   test is a substitute for one that asserts `chain.steps[i].files` or
   `chain.steps[i].packages` directly.

   Fix: add a test (using the already-usable PR #5994 / `@xyflow/react` chain, no new
   fixture needed) asserting the per-step group assignment, e.g.
   `chain.steps.map(s => s.packages)` equals `[['@xyflow/react', '@xyflow/svelte'],
   ['svelte-examples'], [null]]`, or an assertion on `chain.steps[0].files.length` versus
   `chain.steps[2].files.length` that only holds under the "extra goes to the earlier
   steps" rule.

## Warnings (non-blocking)

1. **`src/lib/ai/enrichment-record.ts` has no co-located spec**, and the Convention Map row
   for `src/lib/**/*.ts` asks for one on every module. The six symbols it exports are all
   still exercised — through the `enrichment.ts` re-export — by `src/lib/ai/enrichment.test.ts`
   (`enrichmentKey`, `isFallbackEnrichment`, `FALLBACK_APPROACH`, `MAX_LABEL_CHARS`,
   `fallbackEnrichment` all appear there; `FALLBACK_STEP_SUMMARY` is exercised indirectly
   through `fallbackEnrichment`'s synthetic step). This is a pure, byte-identical relocation
   of already-tested logic behind an unchanged public surface, not new or re-derived logic,
   so I'm not blocking on it — but the letter of the convention is violated, and the next
   iteration should either add `src/lib/ai/enrichment-record.test.ts` importing directly
   from the new module, or record in `project.md`'s deltas that a re-exported extraction is
   allowed to inherit its origin module's spec. Right now neither has happened.

2. **`step-card.tsx:62-65`** distinguishes a file owned by the expanded package from one
   owned elsewhere by `text-foreground` vs. `text-muted-foreground` alone — no icon, label,
   or weight change accompanies it, unlike every other state distinction in this chunk
   (fallback, direct/indirect, entry point all pair colour with text or an icon). The
   rubric's colour-alone item names three specific distinctions (fallback label, indirect
   attribution, focused card) and this isn't one of them, so I'm not failing the item over
   it, but it's the same hazard the rest of the chunk was careful about and is worth a label
   or icon in the next pass.

## Guidance

Fix Issue 1 first: add the per-step assignment test against PR #5994 (no new fixture
needed), watch it fail under the `index >= stepCount - extra` mutation, then confirm it's
green against the real code. That's the only thing standing between this chunk and a pass —
everything else I checked (derivation correctness elsewhere, the fallback treatment, the
entry-point invariant and its equivalent-mutant proof, Principle 1/2/5 compliance, the
step-attribution deviation's honesty, scope, and the deliverables) held up under independent
verification.
