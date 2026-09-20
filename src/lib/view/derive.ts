import type { PackageEdge, PullRequestRecord, Snapshot } from '../snapshot.ts';

/**
 * What the canvas needs for one selected range, derived from a snapshot.
 *
 * Everything here is a pure function of the snapshot and the range: no React, no layout,
 * no clock. Two calls with the same inputs return the same active set and the same
 * counts, which is what makes the canvas reproducible and testable without rendering it.
 *
 * `enrichment` is never read — it is optional on a snapshot and absent from any snapshot
 * the enrichment pass has not run over.
 */

/** A half-open range is easy to get wrong at a boundary, so both ends are inclusive. */
export type DateRange = { from: string; to: string };

/** The span the snapshot covers. The slider's domain, and the histogram's extent. */
export type HistoryBounds = DateRange;

/** How many pull requests reached a package through one directly-touched neighbour. */
export type IndirectVia = { through: string; count: number };

export type PackageState = 'direct' | 'indirect' | 'untouched';

export type PackageActivity = {
  package: string;
  path: string;
  /** Pull requests in the range that changed a file inside this package. */
  direct: number;
  /** Pull requests in the range that reached it only through a dependency. */
  indirect: number;
  /** The indirect count broken down by the touched package it arrived through. */
  indirectVia: IndirectVia[];
  state: PackageState;
};

/** One histogram bar: `[from, to)` and how many pull requests merged inside it. */
export type VolumeBucket = { from: string; to: string; count: number };

/** A change that arrived in `to` through `from`. Drawn dashed; the dependency runs the other way. */
export type ReachEdge = { from: string; to: string; count: number };

export type WindowView = {
  range: DateRange;
  history: HistoryBounds;
  /** Pull requests merged inside the range, newest merge first. */
  pullRequests: PullRequestRecord[];
  /** Every package in the snapshot, sorted by name — untouched ones included. */
  activity: PackageActivity[];
  activePackages: string[];
  /** Declared dependencies whose two ends are both active. */
  dependencyEdges: PackageEdge[];
  reachEdges: ReachEdge[];
  changeCount: number;
  touchedCount: number;
  packageCount: number;
};

export type Preset = '7d' | '30d' | '90d' | 'all';

const DAY_MS = 24 * 60 * 60 * 1000;
const PRESET_DAYS: Record<Exclude<Preset, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 };

/** The default histogram resolution. Enough bars to read a cluster, few enough to see one. */
export const DEFAULT_BUCKET_COUNT = 64;

/**
 * The span the slider covers.
 *
 * The declared ingest window is the authority — it is what was asked for and what the
 * snapshot claims to cover — but a merge that landed outside it would otherwise be
 * unreachable by any range, so the bounds widen to contain every pull request present.
 */
export function historyBounds(snapshot: Snapshot): HistoryBounds {
  let from = Date.parse(snapshot.metadata.window.since);
  let to = Date.parse(snapshot.metadata.window.until);
  let fromIso = snapshot.metadata.window.since;
  let toIso = snapshot.metadata.window.until;

  for (const pullRequest of snapshot.pullRequests) {
    const merged = Date.parse(pullRequest.mergedAt);
    if (merged < from) {
      from = merged;
      fromIso = pullRequest.mergedAt;
    }
    if (merged > to) {
      to = merged;
      toIso = pullRequest.mergedAt;
    }
  }

  return { from: fromIso, to: toIso };
}

/**
 * Merged changes per bucket across the whole history.
 *
 * Every bucket is emitted, including the empty ones — a window with no activity is a zero
 * bar, not a gap, so the bars stay on a linear time axis and a quiet stretch reads as
 * quiet rather than as missing.
 */
export function volumeSeries(snapshot: Snapshot, bucketCount: number = DEFAULT_BUCKET_COUNT): VolumeBucket[] {
  if (bucketCount < 1) throw new Error(`bucketCount must be at least 1, got ${bucketCount}`);

  const history = historyBounds(snapshot);
  const start = Date.parse(history.from);
  const end = Date.parse(history.to);
  const span = Math.max(end - start, 1);

  const counts = new Array<number>(bucketCount).fill(0);
  for (const pullRequest of snapshot.pullRequests) {
    const offset = Date.parse(pullRequest.mergedAt) - start;
    // The final bucket is closed at its upper end so a merge exactly at `to` still lands.
    const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((offset / span) * bucketCount)));
    counts[index] += 1;
  }

  return counts.map((count, index) => ({
    // The first and last edges reuse the history strings so the series is visibly anchored
    // to the same instants the bounds report, rather than to a re-rounded copy of them.
    from: index === 0 ? history.from : new Date(start + (span * index) / bucketCount).toISOString(),
    to:
      index === bucketCount - 1
        ? history.to
        : new Date(start + (span * (index + 1)) / bucketCount).toISOString(),
    count,
  }));
}

/**
 * A rolling preset, anchored to the end of the history rather than to the wall clock.
 *
 * A snapshot is a recording; "the last 7 days" of a recording means the last seven days
 * it contains. Anchoring to `Date.now()` would make the same snapshot derive differently
 * on different days, which is exactly what the reproducibility metric forbids.
 */
export function presetRange(history: HistoryBounds, preset: Preset): DateRange {
  if (preset === 'all') return { ...history };

  const start = Date.parse(history.from);
  const candidate = Date.parse(history.to) - PRESET_DAYS[preset] * DAY_MS;
  return {
    from: candidate <= start ? history.from : new Date(candidate).toISOString(),
    to: history.to,
  };
}

/** Everything the canvas draws for one range. */
export function deriveWindow(snapshot: Snapshot, range: DateRange): WindowView {
  const from = Date.parse(range.from);
  const to = Date.parse(range.to);

  const pullRequests = snapshot.pullRequests
    .filter((pullRequest) => {
      const merged = Date.parse(pullRequest.mergedAt);
      return merged >= from && merged <= to;
    })
    .sort((a, b) => b.mergedAt.localeCompare(a.mergedAt) || a.number - b.number);

  const direct = new Map<string, number>();
  // package -> through -> count. A plain Map, never an object literal: these keys are
  // repository-derived and `buildRecord` is for the records that leave this module.
  const indirect = new Map<string, Map<string, number>>();

  for (const pullRequest of pullRequests) {
    for (const name of pullRequest.directPackages) {
      direct.set(name, (direct.get(name) ?? 0) + 1);
    }
    for (const reach of pullRequest.indirectPackages) {
      // The ingester already resolved direct-wins per pull request, so a package listed
      // here was not also touched directly by this one.
      const via = indirect.get(reach.package) ?? new Map<string, number>();
      via.set(reach.through, (via.get(reach.through) ?? 0) + 1);
      indirect.set(reach.package, via);
    }
  }

  const activity: PackageActivity[] = [...snapshot.packages.nodes]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((node) => {
      const directCount = direct.get(node.name) ?? 0;
      const via = [...(indirect.get(node.name) ?? new Map<string, number>()).entries()]
        .map(([through, count]) => ({ through, count }))
        .sort((a, b) => b.count - a.count || a.through.localeCompare(b.through));
      const indirectCount = via.reduce((sum, entry) => sum + entry.count, 0);

      return {
        package: node.name,
        path: node.path,
        direct: directCount,
        indirect: indirectCount,
        indirectVia: via,
        state: directCount > 0 ? 'direct' : indirectCount > 0 ? 'indirect' : 'untouched',
      } satisfies PackageActivity;
    });

  const activePackages = activity.filter((entry) => entry.state !== 'untouched').map((entry) => entry.package);
  const active = new Set(activePackages);

  return {
    range: { ...range },
    history: historyBounds(snapshot),
    pullRequests,
    activity,
    activePackages,
    // Untouched packages carry no edges, so only the active subgraph is drawn.
    dependencyEdges: snapshot.packages.edges.filter((edge) => active.has(edge.from) && active.has(edge.to)),
    reachEdges: activity
      .flatMap((entry) => entry.indirectVia.map((via) => ({ from: via.through, to: entry.package, count: via.count })))
      .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
    changeCount: pullRequests.length,
    touchedCount: activePackages.length,
    packageCount: snapshot.packages.nodes.length,
  };
}

/** The activity for one package. Throws rather than returning a zeroed stand-in for a typo. */
export function activityOf(view: WindowView, name: string): PackageActivity {
  const entry = view.activity.find((candidate) => candidate.package === name);
  if (entry === undefined) throw new Error(`no package named "${name}" in this snapshot`);
  return entry;
}

/**
 * The focused package plus everything one drawn edge away from it, in either direction —
 * its dependencies, its dependents, and the packages a change reached through it.
 */
export function neighbourhood(view: WindowView, name: string): Set<string> {
  const near = new Set<string>([name]);
  for (const edge of view.dependencyEdges) {
    if (edge.from === name) near.add(edge.to);
    if (edge.to === name) near.add(edge.from);
  }
  for (const edge of view.reachEdges) {
    if (edge.from === name) near.add(edge.to);
    if (edge.to === name) near.add(edge.from);
  }
  return near;
}
