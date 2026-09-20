import { snapshotSchema, type Snapshot } from '../snapshot.ts';
import { SNAPSHOT_SOURCES } from './catalog.generated.ts';

/**
 * The committed snapshots, discovered rather than listed by hand.
 *
 * `catalog.generated.ts` is written from the contents of `src/lib/snapshots/` by
 * `scripts/build-snapshot-index.mts`, so adding a snapshot to that directory adds it to
 * the picker. Nothing here reads the filesystem: the generated module imports each JSON
 * file, which is what puts it in the bundle the deploy target serves.
 *
 * Every snapshot goes through the one schema, whatever produced it (Principle 5).
 */

export type SnapshotEntry = {
  /** The filename stem, e.g. `xyflow-xyflow-2026-08-31`. Stable across rebuilds. */
  id: string;
  file: string;
  /** `owner/name`, read off the snapshot rather than off the filename. */
  repository: string;
  packageCount: number;
  pullRequestCount: number;
  window: { since: string; until: string };
  /** Whether the enrichment pass has run over it. A snapshot without it still renders. */
  enriched: boolean;
};

const snapshots: ReadonlyMap<string, Snapshot> = new Map(
  SNAPSHOT_SOURCES.map((entry) => [entry.id, snapshotSchema.parse(entry.source)] as const),
);

const entries: readonly SnapshotEntry[] = SNAPSHOT_SOURCES.map((entry) => {
  const snapshot = snapshots.get(entry.id) as Snapshot;
  return {
    id: entry.id,
    file: entry.file,
    repository: `${snapshot.metadata.repository.owner}/${snapshot.metadata.repository.name}`,
    packageCount: snapshot.metadata.packageCount,
    pullRequestCount: snapshot.metadata.pullRequestCount,
    window: { ...snapshot.metadata.window },
    enriched: snapshot.enrichment !== undefined,
  };
}).sort((a, b) => a.repository.localeCompare(b.repository) || a.id.localeCompare(b.id));

/** Every committed snapshot, sorted by repository. */
export function listSnapshots(): SnapshotEntry[] {
  return entries.map((entry) => ({ ...entry, window: { ...entry.window } }));
}

/** The snapshot for an id, already validated. Throws for an id the catalog does not have. */
export function getSnapshot(id: string): Snapshot {
  const snapshot = snapshots.get(id);
  if (snapshot === undefined) {
    throw new Error(`no committed snapshot with id "${id}" — have ${entries.map((e) => e.id).join(', ')}`);
  }
  return snapshot;
}
