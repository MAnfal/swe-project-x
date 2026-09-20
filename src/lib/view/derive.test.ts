import { describe, expect, it } from 'vitest';

import {
  activityOf,
  deriveWindow,
  historyBounds,
  nearestActivity,
  neighbourhood,
  presetRange,
  volumeSeries,
  type DateRange,
} from '@/lib/view/derive';

import { loadSnapshot, snapshotWithDeclaredWindow } from './fixture';

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
