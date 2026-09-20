import { describe, expect, it } from 'vitest';

import {
  activityOf,
  changeOf,
  deriveWindow,
  historyBounds,
  nearestActivity,
  neighbourhood,
  packageChanges,
  presetRange,
  stepChain,
  summarizeChange,
  volumeSeries,
  type DateRange,
} from '@/lib/view/derive';
import { enrichmentKey, fallbackEnrichment, isFallbackEnrichment } from '@/lib/ai/enrichment';

import {
  enrichedSnapshot,
  loadSnapshot,
  snapshotMissingEnrichmentFor,
  snapshotWithDeclaredWindow,
  snapshotWithEnrichment,
  snapshotWithExtraEdges,
  snapshotWithTitle,
  snapshotWithoutMergeCommitSha,
} from './fixture';

const snapshot = loadSnapshot();

/** The whole captured window: every pull request in the snapshot. */
const WHOLE = { from: '2026-08-31T00:00:00Z', to: '2026-09-02T00:00:00Z' };

describe('deriveWindow — the active set (T001)', () => {
  it('marks every package a pull request reached in the range as active', () => {
    const view = deriveWindow(snapshot, WHOLE);

    expect(view.changeCount).toBe(6);
    expect(view.activePackages).toEqual([
      '@xyflow/react',
      '@xyflow/svelte',
      '@xyflow/system',
      'astro-examples',
      'react-examples',
      'svelte-examples',
    ]);
    expect(view.touchedCount).toBe(6);
    expect(view.packageCount).toBe(10);
  });

  it('leaves a package with no pull request in the range inactive', () => {
    const view = deriveWindow(snapshot, WHOLE);

    // The tooling packages are depended on only through devDependencies, and nothing in
    // the window changed a file inside them.
    expect(activityOf(view, 'playwright').state).toBe('untouched');
    expect(activityOf(view, '@xyflow/tsconfig').state).toBe('untouched');
    expect(activityOf(view, 'playwright').direct).toBe(0);
    expect(activityOf(view, 'playwright').indirect).toBe(0);
  });

  it('reports every package in the snapshot, active or not', () => {
    const view = deriveWindow(snapshot, WHOLE);

    expect(view.activity.map((entry) => entry.package)).toEqual([
      '@xyflow/eslint-config',
      '@xyflow/react',
      '@xyflow/rollup-config',
      '@xyflow/svelte',
      '@xyflow/system',
      '@xyflow/tsconfig',
      'astro-examples',
      'playwright',
      'react-examples',
      'svelte-examples',
    ]);
  });

  it('narrows the active set when the range narrows', () => {
    const view = deriveWindow(snapshot, { from: '2026-09-01T00:00:00Z', to: '2026-09-02T00:00:00Z' });

    expect(view.changeCount).toBe(2);
    expect(activityOf(view, '@xyflow/react').direct).toBe(1);
    expect(activityOf(view, '@xyflow/svelte').direct).toBe(2);
  });

  it('includes a pull request merged exactly on either boundary', () => {
    // PR 5989 merged at 09:22:57Z and PR 5987 at 09:36:49Z on 2026-08-31.
    const view = deriveWindow(snapshot, { from: '2026-08-31T09:22:57Z', to: '2026-08-31T09:36:49Z' });

    expect(view.pullRequests.map((pr) => pr.number)).toEqual([5987, 5989]);
  });

  it('returns an empty active set for a range nothing landed in', () => {
    const view = deriveWindow(snapshot, { from: '2026-08-31T00:00:00Z', to: '2026-08-31T06:00:00Z' });

    expect(view.changeCount).toBe(0);
    expect(view.activePackages).toEqual([]);
    expect(view.touchedCount).toBe(0);
    expect(view.dependencyEdges).toEqual([]);
    expect(view.reachEdges).toEqual([]);
  });

  it('returns the same active set and the same counts when it runs twice', () => {
    expect(deriveWindow(snapshot, WHOLE)).toEqual(deriveWindow(snapshot, WHOLE));
  });

  it('derives a snapshot whose enrichment is absent', () => {
    expect(snapshot.enrichment).toBeUndefined();
    expect(deriveWindow(snapshot, WHOLE).activePackages.length).toBeGreaterThan(0);
  });
});

describe('deriveWindow — attribution counts (T002)', () => {
  it('counts the pull requests that reached a package directly', () => {
    const view = deriveWindow(snapshot, WHOLE);

    expect(activityOf(view, '@xyflow/svelte').direct).toBe(5);
    expect(activityOf(view, '@xyflow/system').direct).toBe(4);
    expect(activityOf(view, '@xyflow/react').direct).toBe(3);
    expect(activityOf(view, 'svelte-examples').direct).toBe(1);
  });

  it('groups the indirect count by the package the change came through', () => {
    const view = deriveWindow(snapshot, WHOLE);
    const astro = activityOf(view, 'astro-examples');

    expect(astro.indirect).toBe(6);
    expect(astro.indirectVia).toEqual([
      { through: '@xyflow/react', count: 3 },
      { through: '@xyflow/svelte', count: 2 },
      { through: '@xyflow/system', count: 1 },
    ]);
  });

  it('keeps direct and indirect counts separate on a package that is both', () => {
    const view = deriveWindow(snapshot, WHOLE);
    const react = activityOf(view, '@xyflow/react');

    expect(react.direct).toBe(3);
    expect(react.indirect).toBe(2);
    expect(react.indirectVia).toEqual([{ through: '@xyflow/system', count: 2 }]);
    // Direct wins for the node's treatment even though the package was also reached
    // through a dependency.
    expect(react.state).toBe('direct');
  });

  it('marks a package reached only through a dependency as indirect', () => {
    const view = deriveWindow(snapshot, WHOLE);

    expect(activityOf(view, 'react-examples').state).toBe('indirect');
    expect(activityOf(view, 'react-examples').direct).toBe(0);
    expect(activityOf(view, 'react-examples').indirectVia).toEqual([
      { through: '@xyflow/react', count: 3 },
      { through: '@xyflow/system', count: 2 },
    ]);
  });

  it('never counts a pull request as both direct and indirect for the same package', () => {
    const view = deriveWindow(snapshot, WHOLE);

    for (const entry of view.activity) {
      expect(entry.direct + entry.indirect).toBeLessThanOrEqual(view.changeCount);
    }
    // PR 5994 touched svelte-examples directly, so it is not among its five indirect hits.
    expect(activityOf(view, 'svelte-examples').indirect).toBe(5);
  });
});

describe('deriveWindow — edges between touched packages (T002)', () => {
  it('draws a dependency edge only when both ends are active', () => {
    const view = deriveWindow(snapshot, WHOLE);

    for (const edge of view.dependencyEdges) {
      expect(view.activePackages).toContain(edge.from);
      expect(view.activePackages).toContain(edge.to);
    }
    expect(view.dependencyEdges).toContainEqual({
      from: '@xyflow/react',
      to: '@xyflow/system',
      kind: 'dependencies',
    });
    // Tooling is untouched, so the devDependency edge into it is not drawn.
    expect(view.dependencyEdges.some((edge) => edge.to === '@xyflow/tsconfig')).toBe(false);
  });

  it('draws a reach edge from the touched package into the package it reached', () => {
    const view = deriveWindow(snapshot, WHOLE);

    expect(view.reachEdges).toContainEqual({ from: '@xyflow/react', to: 'astro-examples', count: 3 });
    expect(view.reachEdges).toContainEqual({ from: '@xyflow/system', to: '@xyflow/react', count: 2 });
  });
});

describe('volumeSeries and history bounds (T003)', () => {
  it('reports the history the snapshot covers', () => {
    expect(historyBounds(snapshot)).toEqual({ from: '2026-08-31T00:00:00Z', to: '2026-09-02T00:00:00Z' });
  });

  it('covers the full history from the first bucket to the last', () => {
    const series = volumeSeries(snapshot);
    const history = historyBounds(snapshot);

    expect(series.length).toBeGreaterThan(1);
    expect(series[0].from).toBe(history.from);
    expect(series[series.length - 1].to).toBe(history.to);
  });

  it('leaves no gap between one bucket and the next', () => {
    const series = volumeSeries(snapshot);

    for (let index = 1; index < series.length; index += 1) {
      expect(series[index].from).toBe(series[index - 1].to);
    }
  });

  it('yields a zero bucket rather than a gap where nothing landed', () => {
    const series = volumeSeries(snapshot, 24);

    expect(series).toHaveLength(24);
    expect(series.some((bucket) => bucket.count === 0)).toBe(true);
    expect(series.every((bucket) => Number.isInteger(bucket.count))).toBe(true);
  });

  it('accounts for every pull request exactly once across the buckets', () => {
    const total = volumeSeries(snapshot, 24).reduce((sum, bucket) => sum + bucket.count, 0);

    expect(total).toBe(snapshot.pullRequests.length);
  });

  it('returns the same series when it runs twice', () => {
    expect(volumeSeries(snapshot, 24)).toEqual(volumeSeries(snapshot, 24));
  });
});

describe('historyBounds — a merge outside the declared window (T003)', () => {
  // The declared window is the authority, but a merge that landed outside it would be
  // unreachable by any range the slider can express, so the bounds widen to contain it.
  // The captured window contains all six of its merges, so the case is made by moving the
  // *declared* window over the same real pull requests.

  it('widens the upper bound to the newest merge when the declared window ends before it', () => {
    // PRs 5997 (11:53:10Z) and 5992 (12:02:55Z) both merged after this `until`.
    const snapshot = snapshotWithDeclaredWindow({
      since: '2026-08-31T00:00:00Z',
      until: '2026-09-01T00:00:00Z',
    });

    expect(historyBounds(snapshot).to).toBe('2026-09-01T12:02:55Z');
  });

  it('widens the lower bound to the oldest merge when the declared window starts after it', () => {
    // PRs 5989 (09:22:57Z) and 5987 (09:36:49Z) both merged before this `since`.
    const snapshot = snapshotWithDeclaredWindow({
      since: '2026-08-31T12:00:00Z',
      until: '2026-09-02T00:00:00Z',
    });

    expect(historyBounds(snapshot).from).toBe('2026-08-31T09:22:57Z');
  });

  it('leaves a pull request outside the declared window reachable by the full-history range', () => {
    // This is what the widening is for: the all-time range must still reach every change.
    const snapshot = snapshotWithDeclaredWindow({
      since: '2026-08-31T12:00:00Z',
      until: '2026-09-01T00:00:00Z',
    });

    const view = deriveWindow(snapshot, historyBounds(snapshot));

    expect(view.changeCount).toBe(6);
    expect(view.pullRequests.map((pr) => pr.number)).toEqual([5992, 5997, 5994, 5977, 5987, 5989]);
  });

  it('does not widen when every merge is already inside the declared window', () => {
    expect(historyBounds(loadSnapshot())).toEqual({
      from: '2026-08-31T00:00:00Z',
      to: '2026-09-02T00:00:00Z',
    });
  });
});

describe('historyBounds — a merge sitting exactly on a declared bound (T003)', () => {
  // The widening loop compares strictly: it widens only for a merge *outside* the declared
  // window. A merge exactly on a bound leaves the declared bound reported verbatim, which
  // is what `volumeSeries` anchors its first and last bucket edges to. Both cases below
  // are decided at equality, so `<` vs `<=` and `>` vs `>=` produce different output.

  it('keeps the declared lower bound when the oldest merge sits exactly on it', () => {
    // PR 5989 merged at 2026-08-31T09:22:57Z — the same instant, spelled with milliseconds.
    const declared = { since: '2026-08-31T09:22:57.000Z', until: '2026-09-02T00:00:00Z' };
    const snapshot = snapshotWithDeclaredWindow(declared);

    expect(historyBounds(snapshot)).toEqual({ from: declared.since, to: declared.until });
    // And the merge on the bound is still reachable, which is why not widening is safe.
    expect(deriveWindow(snapshot, historyBounds(snapshot)).changeCount).toBe(6);
  });

  it('keeps the declared upper bound when the newest merge sits exactly on it', () => {
    // PR 5992 merged at 2026-09-01T12:02:55Z — again the same instant, spelled differently.
    const declared = { since: '2026-08-31T00:00:00Z', until: '2026-09-01T12:02:55.000Z' };
    const snapshot = snapshotWithDeclaredWindow(declared);

    expect(historyBounds(snapshot)).toEqual({ from: declared.since, to: declared.until });
    expect(deriveWindow(snapshot, historyBounds(snapshot)).changeCount).toBe(6);
  });
});

describe('volumeSeries — a history with no width (T003)', () => {
  // `snapshotSchema` accepts a window whose `since` equals its `until` — measured, it
  // parses clean — so a history can collapse to a single instant. Dividing by that span
  // is what the guard exists to stop.
  const snapshot = snapshotWithDeclaredWindow(
    { since: '2026-09-01T12:02:55Z', until: '2026-09-01T12:02:55Z' },
    { keepPullRequests: [5992] },
  );

  it('collapses the history to one instant', () => {
    expect(historyBounds(snapshot)).toEqual({
      from: '2026-09-01T12:02:55Z',
      to: '2026-09-01T12:02:55Z',
    });
  });

  it('still emits the requested buckets rather than dividing by a zero span', () => {
    const series = volumeSeries(snapshot, 8);

    expect(series).toHaveLength(8);
    expect(series.every((bucket) => Number.isInteger(bucket.count))).toBe(true);
  });

  it('still counts the merge that sits on that instant', () => {
    const series = volumeSeries(snapshot, 8);

    expect(series.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(1);
    expect(series[0].count).toBe(1);
  });
});

describe('volumeSeries — a merge landing exactly on the upper bound (T003)', () => {
  // `until` is PR 5992's own merge timestamp, so the history ends exactly on a merge and
  // that merge's offset is the full span. Without the final-bucket clamp its bucket index
  // is `bucketCount`, one past the end of the array.
  const snapshot = snapshotWithDeclaredWindow({
    since: '2026-08-31T00:00:00Z',
    until: '2026-09-01T12:02:55Z',
  });

  it('puts the history bound exactly on that merge', () => {
    expect(historyBounds(snapshot).to).toBe('2026-09-01T12:02:55Z');
  });

  it('emits exactly the requested number of buckets', () => {
    expect(volumeSeries(snapshot, 8)).toHaveLength(8);
  });

  it('counts that merge in the final bucket rather than off the end of the series', () => {
    const series = volumeSeries(snapshot, 8);

    expect(series[series.length - 1].count).toBeGreaterThanOrEqual(1);
    expect(series[series.length - 1].to).toBe('2026-09-01T12:02:55Z');
  });

  it('still accounts for every pull request exactly once', () => {
    const series = volumeSeries(snapshot, 8);

    expect(series.every((bucket) => Number.isInteger(bucket.count))).toBe(true);
    expect(series.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(snapshot.pullRequests.length);
  });
});

describe('presetRange', () => {
  const history = historyBounds(snapshot);

  it('anchors a rolling preset to the end of the history, not the wall clock', () => {
    // A pure function of two bounds, so a wider history than the two-day capture shows
    // the arithmetic the captured window is too short to distinguish.
    const wide = { from: '2023-01-01T00:00:00Z', to: '2026-09-02T00:00:00Z' };

    expect(presetRange(wide, '7d')).toEqual({ from: '2026-08-26T00:00:00.000Z', to: wide.to });
    expect(presetRange(wide, '30d')).toEqual({ from: '2026-08-03T00:00:00.000Z', to: wide.to });
    expect(presetRange(wide, '90d')).toEqual({ from: '2026-06-04T00:00:00.000Z', to: wide.to });
  });

  it('returns the whole history for the all-time preset', () => {
    expect(presetRange(history, 'all')).toEqual(history);
  });

  it('never starts a preset before the history begins', () => {
    // Every rolling preset is wider than the two-day capture, so each clamps to its start.
    expect(presetRange(history, '7d')).toEqual(history);
    expect(presetRange(history, '90d')).toEqual(history);
  });
});

describe('neighbourhood', () => {
  it('returns the focused package and the active packages adjacent to it', () => {
    const view = deriveWindow(snapshot, WHOLE);

    expect([...neighbourhood(view, '@xyflow/svelte')].sort()).toEqual([
      '@xyflow/svelte',
      '@xyflow/system',
      'astro-examples',
      'svelte-examples',
    ]);
  });

  it('returns just the package itself when nothing is adjacent to it', () => {
    const view = deriveWindow(snapshot, WHOLE);

    expect([...neighbourhood(view, 'playwright')]).toEqual(['playwright']);
  });
});

describe('nearestActivity', () => {
  it('offers a range of the same width containing the closest merge', () => {
    // Nothing landed before 09:22:57Z on 2026-08-31; the six-hour window is empty.
    const empty = { from: '2026-08-31T00:00:00Z', to: '2026-08-31T06:00:00Z' };
    const nearest = nearestActivity(snapshot, empty);

    expect(nearest).not.toBeNull();
    expect(deriveWindow(snapshot, nearest as DateRange).changeCount).toBeGreaterThan(0);
    expect(Date.parse((nearest as DateRange).to) - Date.parse((nearest as DateRange).from)).toBe(
      Date.parse(empty.to) - Date.parse(empty.from),
    );
  });

  it('stays inside the history it was given', () => {
    const history = historyBounds(snapshot);
    const nearest = nearestActivity(snapshot, { from: '2026-08-31T00:00:00Z', to: '2026-08-31T06:00:00Z' });

    expect(Date.parse((nearest as DateRange).from)).toBeGreaterThanOrEqual(Date.parse(history.from));
    expect(Date.parse((nearest as DateRange).to)).toBeLessThanOrEqual(Date.parse(history.to));
  });

  it('returns null when the range already has activity', () => {
    expect(nearestActivity(snapshot, historyBounds(snapshot))).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------
// Chunk 05 — Level 2 (the changes that reached a package) and Level 3 (how one was built).
// ---------------------------------------------------------------------------------------

const enriched = enrichedSnapshot();
const ENRICHED_WHOLE = { from: '2026-06-22T00:00:00Z', to: '2026-09-20T00:00:00Z' };
const enrichedView = deriveWindow(enriched, ENRICHED_WHOLE);

/** The un-enriched capture: chunk 04's fixture, which has no `enrichment` key at all. */
const bareView = deriveWindow(snapshot, WHOLE);

describe('packageChanges — the changes that reached a package (T001)', () => {
  it('returns one entry per pull request that reached the package in the range', () => {
    const changes = packageChanges(enriched, enrichedView, '@xyflow/react');
    const activity = activityOf(enrichedView, '@xyflow/react');

    expect(changes).toHaveLength(activity.direct + activity.indirect);
    expect(changes).toHaveLength(36);
    expect(new Set(changes.map((change) => change.number)).size).toBe(changes.length);
  });

  it('orders the changes by merge date, oldest first', () => {
    const changes = packageChanges(enriched, enrichedView, '@xyflow/react');
    const merged = changes.map((change) => Date.parse(change.mergedAt));

    expect(merged).toEqual([...merged].sort((a, b) => a - b));
    expect(changes[0].mergedAt < changes[changes.length - 1].mergedAt).toBe(true);
  });

  it('says why each change was included — directly, or through a named package', () => {
    const changes = packageChanges(enriched, enrichedView, 'react-examples');
    const direct = changes.find((change) => change.number === 5978);
    const indirect = changes.find((change) => change.number === 5992);

    expect(direct?.inclusion).toEqual({ kind: 'direct' });
    expect(indirect?.inclusion).toEqual({
      kind: 'indirect',
      through: '@xyflow/react',
      path: ['react-examples', '@xyflow/react'],
    });
  });

  it('carries the enrichment label and the approach note in full', () => {
    const change = packageChanges(enriched, enrichedView, '@xyflow/react').find((c) => c.number === 5994);

    expect(change?.label).toBe('Reset store functions on flow unmount');
    expect(change?.approach).toBe(
      'Extended the store reset logic to properly clear all properties including edge options when the ' +
        'flow component unmounts, ensuring clean state for remounting.',
    );
    expect(change?.fallback).toBe(false);
    expect(change?.author).toBe('moklick');
    expect(change?.url).toBe('https://github.com/xyflow/xyflow/pull/5994');
    expect(change?.stepCount).toBe(3);
  });

  it('lists the packages the change spanned, with the expanded one first when it was touched directly', () => {
    const change = packageChanges(enriched, enrichedView, '@xyflow/react').find((c) => c.number === 5994);

    expect(change?.packages).toEqual(['@xyflow/react', '@xyflow/svelte', 'svelte-examples']);
  });

  it('puts the expanded package last when the change only reached it through a dependency', () => {
    const change = packageChanges(enriched, enrichedView, 'react-examples').find((c) => c.number === 5992);

    expect(change?.packages).toEqual(['@xyflow/react', '@xyflow/svelte', '@xyflow/system', 'react-examples']);
  });

  it('totals the lines the change added and removed', () => {
    const change = packageChanges(enriched, enrichedView, '@xyflow/react').find((c) => c.number === 5994);
    const pullRequest = changeOf(enrichedView, 5994);

    expect(change?.additions).toBe(pullRequest.files.reduce((sum, file) => sum + file.additions, 0));
    expect(change?.deletions).toBe(pullRequest.files.reduce((sum, file) => sum + file.deletions, 0));
  });

  it('returns nothing for a package no change reached in the range', () => {
    expect(packageChanges(enriched, enrichedView, '@xyflow/tsconfig')).toEqual([]);
  });

  it('throws for a package the snapshot does not contain', () => {
    expect(() => packageChanges(enriched, enrichedView, 'not-a-package')).toThrow(/no package named/);
  });

  it('throws when asked to summarize a change that never reached the package', () => {
    // playwright is a real package, and pull request 5994 never reached it — directly or
    // through a dependency — so there is no inclusion reason to report.
    expect(() => summarizeChange(enriched, changeOf(enrichedView, 5994), 'playwright')).toThrow(
      /never reached "playwright"/,
    );
  });

  it('returns the same list when it runs twice', () => {
    expect(packageChanges(enriched, enrichedView, '@xyflow/react')).toEqual(
      packageChanges(enriched, enrichedView, '@xyflow/react'),
    );
  });
});

describe('packageChanges — the fallback path (T002)', () => {
  it('falls back to the pull request title for a snapshot with no enrichment at all', () => {
    const changes = packageChanges(snapshot, bareView, '@xyflow/react');

    expect(snapshot.enrichment).toBeUndefined();
    expect(changes.length).toBeGreaterThan(0);
    for (const change of changes) {
      expect(change.fallback).toBe(true);
      expect(change.approach).toBeNull();
      expect(change.label).toBe(change.title);
      expect(change.label.length).toBeGreaterThan(0);
    }
  });

  it('falls back for one pull request when the snapshot has enrichment for the others', () => {
    // Constructed: the committed snapshots are "absent, or complete — never partial", so
    // no captured fixture carries this shape. `snapshotSchema` admits it, and Principle 5
    // says the view renders anything the schema validates.
    const partial = snapshotMissingEnrichmentFor([5994]);
    const view = deriveWindow(partial, ENRICHED_WHOLE);
    const changes = packageChanges(partial, view, '@xyflow/react');
    const missing = changes.find((change) => change.number === 5994);
    const present = changes.find((change) => change.number === 5972);

    expect(missing?.fallback).toBe(true);
    expect(missing?.approach).toBeNull();
    expect(missing?.label).toBe('fix(store): reset functions');
    expect(present?.fallback).toBe(false);
    expect(present?.approach).not.toBeNull();
  });

  it('treats a degraded enrichment record as a fallback rather than as a real label', () => {
    const pullRequest = changeOf(enrichedView, 5994);
    const degraded = snapshotWithEnrichment({
      [pullRequest.mergeCommitSha as string]: fallbackEnrichment(pullRequest),
    });
    const view = deriveWindow(degraded, ENRICHED_WHOLE);
    const change = packageChanges(degraded, view, '@xyflow/react').find((c) => c.number === 5994);

    expect(change?.fallback).toBe(true);
    expect(change?.approach).toBeNull();
    expect(change?.label).toBe('fix(store): reset functions');
  });

  it('recognises the degraded record the real bake actually wrote', () => {
    // trpc/trpc#7592 has no commits, so no step chain could be derived and the bake stored
    // a fallback. It reached no package, so it never appears on a Level 2 card list — but
    // it is the one captured receipt that the predicate the derivation branches on is the
    // same one the bake writes, which is what keeps the constructed tests above honest.
    const trpc = loadSnapshot('trpc-trpc-2026-06-22.json');
    const degraded = Object.entries(trpc.enrichment ?? {}).filter(([, entry]) =>
      isFallbackEnrichment(entry),
    );

    expect(degraded).toHaveLength(1);
    const [key] = degraded[0];
    const pullRequest = trpc.pullRequests.find((candidate) => enrichmentKey(candidate) === key);
    expect(pullRequest?.number).toBe(7592);
    expect(pullRequest?.commits).toEqual([]);

  });

  it('never yields an empty label, even when the pull request has no title', () => {
    // Constructed: every captured pull request has a non-empty title, so the fixture alone
    // cannot reach the branch that names the change by its number.
    const untitled = snapshotMissingEnrichmentFor([5994]);
    const blanked = snapshotWithTitle(5994, '   ');
    const merged = { ...blanked, enrichment: untitled.enrichment };
    const view = deriveWindow(merged, ENRICHED_WHOLE);
    const change = packageChanges(merged, view, '@xyflow/react').find((c) => c.number === 5994);

    expect(change?.label).toBe('Pull request #5994');
    expect(change?.fallback).toBe(true);
  });

  it('keys enrichment by pull request number when GitHub reported no merge commit', () => {
    // Constructed: no captured pull request has a null `mergeCommitSha`, and the schema
    // declares the field nullable.
    const keyed = snapshotWithoutMergeCommitSha([5994]);
    const view = deriveWindow(keyed, ENRICHED_WHOLE);
    const change = packageChanges(keyed, view, '@xyflow/react').find((c) => c.number === 5994);

    expect(change?.key).toBe('5994');
    expect(change?.fallback).toBe(false);
    expect(change?.label).toBe('Reset store functions on flow unmount');
  });
});

describe('stepChain — how one change was built (T003)', () => {
  it('returns the enrichment steps in order, numbered from one', () => {
    const chain = stepChain(enriched, changeOf(enrichedView, 5994), '@xyflow/react');

    expect(chain.steps.map((step) => step.position)).toEqual([1, 2, 3]);
    expect(chain.steps.map((step) => step.summary)).toEqual([
      'Reset all properties in Svelte Flow store when unmounting',
      'Reset defaultEdgeOptions in React store',
      'Reset functions in React store',
    ]);
    expect(chain.steps.map((step) => step.shortSha)).toEqual(['17d3792', '19f9c2a', '2acefb5']);
  });

  it('links each step to its own commit on the pull request', () => {
    const chain = stepChain(enriched, changeOf(enrichedView, 5994), '@xyflow/react');

    expect(chain.steps[0].url).toBe(
      'https://github.com/xyflow/xyflow/pull/5994/commits/17d3792673d0e6b3df26b4739c287329fd74df16',
    );
  });

  it('accounts for every changed file exactly once across the chain', () => {
    const pullRequest = changeOf(enrichedView, 5994);
    const chain = stepChain(enriched, pullRequest, '@xyflow/react');
    const covered = chain.steps.flatMap((step) => step.files).map((file) => file.path);

    expect([...covered].sort()).toEqual(pullRequest.files.map((file) => file.path).sort());
    expect(chain.additions).toBe(pullRequest.files.reduce((sum, file) => sum + file.additions, 0));
    expect(chain.deletions).toBe(pullRequest.files.reduce((sum, file) => sum + file.deletions, 0));
    expect(chain.steps.reduce((sum, step) => sum + step.additions, 0)).toBe(chain.additions);
    expect(chain.steps.reduce((sum, step) => sum + step.deletions, 0)).toBe(chain.deletions);
  });

  it('marks the first step whose files the expanded package owns as the entry point', () => {
    const chain = stepChain(enriched, changeOf(enrichedView, 5994), '@xyflow/react');
    const owned = chain.steps.filter((step) =>
      step.files.some((file) => file.package === '@xyflow/react'),
    );

    expect(owned.length).toBeGreaterThan(0);
    expect(chain.entryStep).toBe(owned[0].position);
    expect(chain.steps.filter((step) => step.entryPoint).map((step) => step.position)).toEqual([
      owned[0].position,
    ]);
  });

  it('never marks more than one step as the entry point, for any change in the capture', () => {
    // The invariant that makes "the first step whose files that package owns" unambiguous:
    // a package's files are one group and a group goes to one step. Swept over every
    // touched package and every change it carries, not over one hand-picked pair.
    let checked = 0;
    for (const activity of enrichedView.activity.filter((entry) => entry.state !== 'untouched')) {
      for (const change of packageChanges(enriched, enrichedView, activity.package)) {
        const chain = stepChain(enriched, changeOf(enrichedView, change.number), activity.package);
        const marked = chain.steps.filter((step) => step.entryPoint);

        expect(marked.length).toBeLessThanOrEqual(1);
        expect(chain.entryStep).toBe(marked[0]?.position ?? null);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('reports no entry point when the change never named the expanded package', () => {
    const pullRequest = changeOf(enrichedView, 5992);
    const chain = stepChain(enriched, pullRequest, 'react-examples');

    expect(pullRequest.files.some((file) => file.package === 'react-examples')).toBe(false);
    expect(chain.entryStep).toBeNull();
    expect(chain.steps.every((step) => step.entryPoint === false)).toBe(true);
  });

  it('orders the file groups dependency-first, so the chain runs from dependency to dependent', () => {
    const chain = stepChain(enriched, changeOf(enrichedView, 5994), '@xyflow/react');
    const order = chain.steps.flatMap((step) => step.packages);

    // svelte-examples declares a dependency on @xyflow/svelte, so it follows it; the files
    // owned by no package come last.
    expect(order).toEqual(['@xyflow/react', '@xyflow/svelte', 'svelte-examples', null]);
  });

  it('yields an empty chain rather than throwing when the change has no enrichment', () => {
    const pullRequest = bareView.pullRequests[0];
    const chain = stepChain(snapshot, pullRequest, '@xyflow/react');

    expect(chain.steps).toEqual([]);
    expect(chain.entryStep).toBeNull();
    expect(chain.change.fallback).toBe(true);
    // The change's own files are still reported, so Level 3 is not a blank screen.
    expect(chain.files.map((file) => file.path).sort()).toEqual(
      pullRequest.files.map((file) => file.path).sort(),
    );
  });

  it('yields an empty chain for a degraded enrichment record', () => {
    const pullRequest = changeOf(enrichedView, 5994);
    const degraded = snapshotWithEnrichment({
      [pullRequest.mergeCommitSha as string]: fallbackEnrichment(pullRequest),
    });

    expect(stepChain(degraded, pullRequest, '@xyflow/react').steps).toEqual([]);
  });

  it('leaves the leading steps without files when the chain is longer than the file groups', () => {
    // Constructed: a six-step chain over a pull request whose files belong to two packages
    // plus the repository root. No captured record pairs those two numbers.
    const pullRequest = changeOf(enrichedView, 5994);
    const long = snapshotWithEnrichment({
      [pullRequest.mergeCommitSha as string]: {
        label: 'Reset store functions on flow unmount',
        approach: 'Extended the store reset logic.',
        steps: pullRequest.commits
          .concat(pullRequest.commits)
          .slice(0, 6)
          .map((commit, index) => ({ commitSha: commit.sha, summary: `Step ${index + 1}` })),
      },
    });
    const chain = stepChain(long, pullRequest, '@xyflow/react');

    expect(chain.steps).toHaveLength(6);
    expect(chain.steps.slice(0, 2).every((step) => step.files.length === 0)).toBe(true);
    // Right-aligned: the chain still ends on the last file group, and nothing is lost.
    expect(chain.steps.flatMap((step) => step.files)).toHaveLength(pullRequest.files.length);
  });

  it('falls back to the pull request link for a step naming a commit it does not contain', () => {
    // Constructed: `resolveSteps` rejects such a record at bake time, so no captured
    // snapshot carries one. The schema does not cross-check the two fields.
    const pullRequest = changeOf(enrichedView, 5994);
    const stray = snapshotWithEnrichment({
      [pullRequest.mergeCommitSha as string]: {
        label: 'Reset store functions on flow unmount',
        approach: 'Extended the store reset logic.',
        steps: [{ commitSha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', summary: 'A commit that is not here' }],
      },
    });
    const chain = stepChain(stray, pullRequest, '@xyflow/react');

    expect(chain.steps[0].url).toBe('https://github.com/xyflow/xyflow/pull/5994');
  });

  it('still covers every file when the declared dependencies form a cycle', () => {
    // Constructed: the captured manifests declare an acyclic graph, so the topological
    // ordering's cycle branch is unreachable from any fixture.
    const pullRequest = changeOf(enrichedView, 5994);
    const cyclic = snapshotWithExtraEdges([
      { from: '@xyflow/svelte', to: 'svelte-examples', kind: 'dependencies' },
    ]);
    const chain = stepChain(cyclic, pullRequest, '@xyflow/react');

    expect(chain.steps.flatMap((step) => step.files).map((file) => file.path).sort()).toEqual(
      pullRequest.files.map((file) => file.path).sort(),
    );
    expect(chain.steps.flatMap((step) => step.packages)).toContain('svelte-examples');
  });

  it('returns the same chain when it runs twice', () => {
    const pullRequest = changeOf(enrichedView, 5994);

    expect(stepChain(enriched, pullRequest, '@xyflow/react')).toEqual(
      stepChain(enriched, pullRequest, '@xyflow/react'),
    );
  });
});

describe('changeOf', () => {
  it('returns the pull request the view carries for a number', () => {
    expect(changeOf(enrichedView, 5994).title).toBe('fix(store): reset functions');
  });

  it('throws rather than returning undefined for a number outside the range', () => {
    expect(() => changeOf(bareView, 1)).toThrow(/no change numbered/);
  });
});
