import type { ChangedFile, EnrichmentEntry, PackageEdge, PullRequestRecord, Snapshot } from '../snapshot.ts';
import { enrichmentKey, fallbackEnrichment, isFallbackEnrichment } from '../ai/enrichment-record.ts';

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
 * The comparisons are strict: a merge sitting exactly on a bound leaves that bound
 * reported as declared.
 *
 * **The widening is defensive, and this repository's own ingester cannot trigger it.**
 * `fetchMergedPullRequests` (`src/lib/ingest/github.ts`) drops any pull request outside
 * `[since, until)` before it is written, and `ingestRepository` copies those same bounds
 * into `metadata.window`, so every merge in a snapshot it produced is already inside the
 * declared window. What this defends is the *schema* boundary, which admits more than the
 * ingester emits — Principle 5 says the view renders anything `snapshotSchema` validates,
 * whatever produced it. Same status as `layoutGraph`'s known-node guard.
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
 *
 * The span floor below is defensive in the same way, but for a case the schema really does
 * admit: measured on zod 4.6.5, `snapshotSchema` parses a window whose `since` equals — or
 * even follows — its `until`, because nothing cross-checks the two fields. `ingestRepository`
 * rejects such a window before it starts, so no snapshot this repository produced can carry
 * one; a snapshot from anywhere else can, and dividing by that span would silently emit
 * `NaN` bucket counts instead of bars.
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

/**
 * A range of the same width as `range` that does contain activity, or null when `range`
 * already does.
 *
 * The empty state offers to jump rather than leaving the reader to hunt for the nearest
 * merge by dragging. Same width, so the jump changes *when* they are looking and not how
 * much they are looking at, and clamped to the history so the slider can represent it.
 */
export function nearestActivity(snapshot: Snapshot, range: DateRange): DateRange | null {
  const from = Date.parse(range.from);
  const to = Date.parse(range.to);
  const width = Math.max(to - from, 0);

  let nearest: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const pullRequest of snapshot.pullRequests) {
    const merged = Date.parse(pullRequest.mergedAt);
    if (merged >= from && merged <= to) return null; // the range already has activity
    const distance = merged < from ? from - merged : merged - to;
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = merged;
    }
  }
  if (nearest === null) return null;

  const history = historyBounds(snapshot);
  const historyStart = Date.parse(history.from);
  const historyEnd = Date.parse(history.to);

  // Centre the same-width window on the nearest merge, then slide it back inside the
  // history rather than clipping it, so the offered range keeps its width.
  let start = nearest - width / 2;
  if (start + width > historyEnd) start = historyEnd - width;
  if (start < historyStart) start = historyStart;

  return { from: new Date(start).toISOString(), to: new Date(Math.min(start + width, historyEnd)).toISOString() };
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

// ---------------------------------------------------------------------------------------
// Level 2 — the changes that reached one package, and Level 3 — how one of them was built.
// ---------------------------------------------------------------------------------------

/** Why a change appears under a package: it changed a file there, or it arrived through one. */
export type ChangeInclusion =
  | { kind: 'direct' }
  | { kind: 'indirect'; through: string; path: string[] };

/** One change card on Level 2. Everything the card renders, already resolved. */
export type ChangeSummary = {
  /** The enrichment key — the merge SHA, or the number when GitHub reported no merge commit. */
  key: string;
  number: number;
  /** The pull request's own title, always present. */
  title: string;
  /** The enrichment label, or the title when there is no real enrichment record. */
  label: string;
  /** The approach note, or null when enrichment is absent or degraded. Never truncated. */
  approach: string | null;
  /** True when `label` is the pull request's own title rather than a model result. */
  fallback: boolean;
  author: string | null;
  mergedAt: string;
  url: string;
  inclusion: ChangeInclusion;
  /** The packages the change spanned, the expanded one first when it was touched directly. */
  packages: string[];
  /** How many steps the chain has. Zero when there is no real enrichment record. */
  stepCount: number;
  additions: number;
  deletions: number;
};

/** One step card on Level 3. */
export type StepDetail = {
  /** 1-based, so it can be read aloud as "step 3". */
  position: number;
  commitSha: string;
  /** Git's own canonical short form, which is what the card shows. */
  shortSha: string;
  summary: string;
  /** The commit on GitHub, or the pull request when the commit cannot be resolved. */
  url: string;
  files: ChangedFile[];
  /** The owners of `files`, in order. `null` is the repository root. */
  packages: (string | null)[];
  additions: number;
  deletions: number;
  /** True on the first step whose files the expanded package owns — where it entered. */
  entryPoint: boolean;
};

export type StepChain = {
  change: ChangeSummary;
  /** Empty when the change has no real enrichment record, rather than a synthetic step. */
  steps: StepDetail[];
  /** Every file the change touched, whatever the chain attributes where. */
  files: ChangedFile[];
  /** The position of the entry-point step, or null when no step's files that package owns. */
  entryStep: number | null;
  additions: number;
  deletions: number;
};

/** Git's canonical abbreviation length, so a step's SHA reads the way `git log` prints it. */
const SHORT_SHA_CHARS = 7;

/**
 * The enrichment record for a change, or undefined when there is nothing real to show.
 *
 * Three ways there is nothing: the snapshot has no `enrichment` key at all (an un-enriched
 * capture), it has one but not for this change, or it has a *degraded* record — a failure
 * receipt written by the bake, which `isFallbackEnrichment` identifies. All three collapse
 * to the same thing for a renderer, which is why they collapse here rather than at three
 * call sites.
 *
 * `hasOwnProperty` rather than a bare lookup: `enrichment` is a record keyed by
 * repository-derived strings, so an inherited `Object.prototype` key must not answer.
 */
function realEnrichment(snapshot: Snapshot, pullRequest: PullRequestRecord): EnrichmentEntry | undefined {
  const stored = snapshot.enrichment;
  if (stored === undefined) return undefined;

  const key = enrichmentKey(pullRequest);
  if (!Object.prototype.hasOwnProperty.call(stored, key)) return undefined;

  const entry = stored[key];
  return isFallbackEnrichment(entry) ? undefined : entry;
}

function sumAdditions(files: readonly ChangedFile[]): number {
  return files.reduce((total, file) => total + file.additions, 0);
}

function sumDeletions(files: readonly ChangedFile[]): number {
  return files.reduce((total, file) => total + file.deletions, 0);
}

function reachedBy(pullRequest: PullRequestRecord, name: string): ChangeInclusion | null {
  if (pullRequest.directPackages.includes(name)) return { kind: 'direct' };

  const reach = pullRequest.indirectPackages.find((candidate) => candidate.package === name);
  return reach === undefined ? null : { kind: 'indirect', through: reach.through, path: [...reach.path] };
}

/**
 * One change, resolved against the package it is being read under.
 *
 * The label falls back to `fallbackEnrichment`'s rather than re-deriving the rule here —
 * a change with no enrichment and a change whose enrichment failed must read identically,
 * and two copies of "use the title, or the number when there is no title" drift.
 */
export function summarizeChange(
  snapshot: Snapshot,
  pullRequest: PullRequestRecord,
  packageName: string,
): ChangeSummary {
  const inclusion = reachedBy(pullRequest, packageName);
  if (inclusion === null) {
    throw new Error(`pull request #${pullRequest.number} never reached "${packageName}"`);
  }

  const entry = realEnrichment(snapshot, pullRequest);
  const others = [...pullRequest.directPackages].sort((a, b) => a.localeCompare(b));

  return {
    key: enrichmentKey(pullRequest),
    number: pullRequest.number,
    title: pullRequest.title,
    label: entry?.label ?? fallbackEnrichment(pullRequest).label,
    approach: entry?.approach ?? null,
    fallback: entry === undefined,
    author: pullRequest.author,
    mergedAt: pullRequest.mergedAt,
    url: pullRequest.url,
    inclusion,
    // Directly touched: the expanded package leads, because that is what the reader came
    // for. Reached through a dependency: it trails the packages the change actually named,
    // so the chips read in the direction the change travelled.
    packages:
      inclusion.kind === 'direct'
        ? [packageName, ...others.filter((name) => name !== packageName)]
        : [...others, packageName],
    stepCount: entry?.steps.length ?? 0,
    additions: sumAdditions(pullRequest.files),
    deletions: sumDeletions(pullRequest.files),
  };
}

/**
 * Every change that reached a package in the selected range, oldest merge first.
 *
 * Ordered by merge date ascending rather than by the newest-first order `deriveWindow`
 * reports: Level 2 is read as a narrative of what happened while the owner was away, and
 * design page 5 lists its cards oldest first. Ties break on the pull request number, so
 * two merges recorded at the same second still have one order.
 *
 * `activityOf` is called for its throw: a package name that is not in the snapshot is a
 * typo, and an empty list would hide it.
 */
export function packageChanges(snapshot: Snapshot, view: WindowView, packageName: string): ChangeSummary[] {
  activityOf(view, packageName);

  return view.pullRequests
    .filter((pullRequest) => reachedBy(pullRequest, packageName) !== null)
    .sort((a, b) => Date.parse(a.mergedAt) - Date.parse(b.mergedAt) || a.number - b.number)
    .map((pullRequest) => summarizeChange(snapshot, pullRequest, packageName));
}

/** The pull request a number names, inside the selected range. Throws rather than returning undefined. */
export function changeOf(view: WindowView, number: number): PullRequestRecord {
  const found = view.pullRequests.find((pullRequest) => pullRequest.number === number);
  if (found === undefined) throw new Error(`no change numbered ${number} in this range`);
  return found;
}

type FileGroup = { package: string | null; files: ChangedFile[] };

/**
 * The packages ordered so that a dependency precedes anything in the set that declares it.
 *
 * This is what makes the step chain read outward — from the package the work started in
 * to the one the reader owns — and it is what gives the entry-point marker its meaning.
 *
 * A declared cycle leaves no package ready, which would spin forever and, worse, drop the
 * files those packages own. `pnpm` tolerates cycles through `devDependencies` and the
 * schema does not reject one, so the branch below emits whatever is left in name order and
 * moves on. No captured manifest set in this repository declares a cycle, so nothing in a
 * committed snapshot reaches it.
 */
function dependencyFirst(edges: readonly PackageEdge[], names: readonly string[]): string[] {
  const inSet = new Set(names);
  const dependsOn = new Map<string, Set<string>>(names.map((name) => [name, new Set<string>()]));
  for (const edge of edges) {
    if (inSet.has(edge.from) && inSet.has(edge.to)) dependsOn.get(edge.from)?.add(edge.to);
  }

  const byName = (a: string, b: string) => a.localeCompare(b);
  const remaining = new Set(names);
  const ordered: string[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((name) => [...(dependsOn.get(name) ?? [])].every((dependency) => !remaining.has(dependency)))
      .sort(byName);

    if (ready.length === 0) {
      // A cycle — nothing is ready and nothing ever will be. Emit the rest in name order
      // rather than spinning, and rather than dropping the files those packages own.
      ordered.push(...[...remaining].sort(byName));
      break;
    }

    for (const name of ready) {
      ordered.push(name);
      remaining.delete(name);
    }
  }
  return ordered;
}

/** The change's files grouped by the package that owns them, dependency-first, root last. */
function fileGroups(snapshot: Snapshot, pullRequest: PullRequestRecord): FileGroup[] {
  const byPackage = new Map<string | null, ChangedFile[]>();
  for (const file of pullRequest.files) {
    const existing = byPackage.get(file.package);
    if (existing === undefined) byPackage.set(file.package, [file]);
    else existing.push(file);
  }

  const named = [...byPackage.keys()].filter((name): name is string => name !== null);
  const groups: FileGroup[] = dependencyFirst(snapshot.packages.edges, named).map((name) => ({
    package: name,
    files: byPackage.get(name) ?? [],
  }));

  // Files owned by no package — changesets, CI config, root manifests — are supporting
  // work, so they trail the packages rather than leading the narrative.
  const root = byPackage.get(null);
  if (root !== undefined) groups.push({ package: null, files: root });

  return groups;
}

/**
 * Spreads the file groups across the ordered steps.
 *
 * **The snapshot attributes files to a pull request, not to a commit** — `commitSchema` is
 * `{sha, message}` and nothing in the ingest carries a per-commit file list, so which files
 * a given step touched is not recorded anywhere. Rather than invent that attribution, the
 * groups are handed out by package, which is a real structure the snapshot does carry, and
 * the step cards say so.
 *
 * With more groups than steps each step takes a contiguous run of them, the earlier steps
 * taking the remainder. With fewer, the groups are **right-aligned**: the chain still ends
 * on the package the change landed in, and the leading steps carry no files rather than
 * being handed someone else's.
 *
 * `stepCount` is at least one — `stepChain` does not call this for an empty chain.
 */
function assignGroups(groups: readonly FileGroup[], stepCount: number): FileGroup[][] {
  const slots: FileGroup[][] = Array.from({ length: stepCount }, () => []);

  if (groups.length < stepCount) {
    const offset = stepCount - groups.length;
    groups.forEach((group, index) => slots[offset + index].push(group));
    return slots;
  }

  const base = Math.floor(groups.length / stepCount);
  const extra = groups.length % stepCount;
  let cursor = 0;
  for (let index = 0; index < stepCount; index += 1) {
    const size = base + (index < extra ? 1 : 0);
    for (let taken = 0; taken < size; taken += 1) {
      slots[index].push(groups[cursor]);
      cursor += 1;
    }
  }
  return slots;
}

/**
 * Level 3: the ordered chain that produced one change, read under one package.
 *
 * A change with no real enrichment gets an **empty** chain rather than the degraded
 * record's synthetic single step — that step names no commit the pull request contains and
 * says nothing. `files` still carries everything the change touched, so the level renders
 * the change rather than a blank screen.
 */
export function stepChain(
  snapshot: Snapshot,
  pullRequest: PullRequestRecord,
  packageName: string,
): StepChain {
  const change = summarizeChange(snapshot, pullRequest, packageName);
  const entry = realEnrichment(snapshot, pullRequest);
  const declared = entry?.steps ?? [];
  const slots = declared.length > 0 ? assignGroups(fileGroups(snapshot, pullRequest), declared.length) : [];
  const shas = new Set(pullRequest.commits.map((commit) => commit.sha));

  const steps = declared.map((step, index) => {
    const groups = slots[index];
    const files = groups.flatMap((group) => group.files);

    return {
      position: index + 1,
      commitSha: step.commitSha,
      shortSha: step.commitSha.slice(0, SHORT_SHA_CHARS),
      summary: step.summary,
      // `resolveSteps` binds every step to a commit at bake time, so an unresolvable SHA
      // means the record came from somewhere else. Link the change rather than a 404.
      url: shas.has(step.commitSha) ? `${pullRequest.url}/commits/${step.commitSha}` : pullRequest.url,
      files,
      packages: groups.map((group) => group.package),
      additions: sumAdditions(files),
      deletions: sumDeletions(files),
      // Every file a package owns lands in that package's one group, and a group goes to
      // exactly one step — so at most one step can be the entry point, and "the first
      // step whose files that package owns" needs no tie-break.
      entryPoint: files.some((file) => file.package === packageName),
    } satisfies StepDetail;
  });

  return {
    change,
    steps,
    files: [...pullRequest.files],
    entryStep: steps.find((step) => step.entryPoint)?.position ?? null,
    additions: sumAdditions(pullRequest.files),
    deletions: sumDeletions(pullRequest.files),
  };
}
