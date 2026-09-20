import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { snapshotSchema, type Snapshot } from '../snapshot.ts';

/**
 * Test support: the committed snapshot, read from disk and parsed through the schema so
 * every spec asserts against the value a consumer receives rather than a literal.
 *
 * The file is captured output of the real ingester — produced by replaying the committed
 * HTTP transcript through `scripts/ingest.mts` — so it carries the incidental fields a
 * hand-written approximation would not bother with.
 */
export const XYFLOW_SNAPSHOT_FILE = 'xyflow-xyflow-2026-08-31.json';

export function loadSnapshot(name: string = XYFLOW_SNAPSHOT_FILE): Snapshot {
  const raw = readFileSync(join(import.meta.dirname, '..', 'snapshots', name), 'utf8');
  return snapshotSchema.parse(JSON.parse(raw));
}

/**
 * The committed snapshot with a different *declared* window, re-parsed through the schema.
 *
 * The captured window happens to contain every pull request it captured, so the fixture
 * alone cannot exercise a merge that lands outside the declared window, or one that lands
 * exactly on the history's upper bound. Moving the declared window creates both cases
 * without touching the file: every pull request stays the real captured object — real
 * merge timestamps, real files, real attribution — and only the one field under test
 * moves.
 *
 * Same technique as `transcriptWithReversedListing` in `src/lib/ingest/fixtures/replay.ts`:
 * vary one property of the producer's real output rather than hand-rolling an
 * approximation of it. The snapshot file itself is never edited — Principle 4.
 *
 * `keepPullRequests` narrows the result to the named pull requests, which is how a
 * single-instant history is built: one real pull request, with the declared window set to
 * its own merge time. `metadata.pullRequestCount` follows, so the snapshot stays
 * internally consistent rather than claiming a count it no longer carries.
 */
export function snapshotWithDeclaredWindow(
  window: { since: string; until: string },
  options: { keepPullRequests?: readonly number[] } = {},
): Snapshot {
  const snapshot = loadSnapshot();
  const keep = options.keepPullRequests;
  const pullRequests =
    keep === undefined
      ? snapshot.pullRequests
      : snapshot.pullRequests.filter((pullRequest) => keep.includes(pullRequest.number));

  return snapshotSchema.parse({
    ...snapshot,
    metadata: { ...snapshot.metadata, window, pullRequestCount: pullRequests.length },
    pullRequests,
  });
}

/**
 * The committed snapshot the enrichment pass has run over — 100 pull requests, every one
 * with an enrichment record. Captured output of `scripts/ingest.mts --enrich`, so the
 * level-2 and level-3 derivations are exercised against what the real producer wrote.
 */
export const ENRICHED_SNAPSHOT_FILE = 'xyflow-xyflow-2026-06-22.json';

/**
 * The real enriched snapshot with one property varied, re-parsed through the schema.
 *
 * The committed snapshots are "absent, or complete — never partial"
 * (`src/lib/ai/baked-snapshots.test.ts`), so no captured file contains a pull request the
 * enrichment record is missing for, or a merge GitHub reported no SHA for. Both shapes
 * are admitted by `snapshotSchema`, and Principle 5 says the view renders anything the
 * schema validates — so the guards for them need inputs built here rather than drawn from
 * a fixture that cannot contain them.
 *
 * Same technique as `snapshotWithDeclaredWindow`: every pull request stays the real
 * captured object and only the field under test moves. The snapshot file is never edited.
 */
export function enrichedSnapshot(): Snapshot {
  return loadSnapshot(ENRICHED_SNAPSHOT_FILE);
}

/** The enriched snapshot with the named pull requests' enrichment records deleted. */
export function snapshotMissingEnrichmentFor(numbers: readonly number[]): Snapshot {
  const snapshot = enrichedSnapshot();
  const drop = new Set(
    snapshot.pullRequests
      .filter((pullRequest) => numbers.includes(pullRequest.number))
      .map((pullRequest) => pullRequest.mergeCommitSha ?? String(pullRequest.number)),
  );
  const enrichment = Object.fromEntries(
    Object.entries(snapshot.enrichment ?? {}).filter(([key]) => !drop.has(key)),
  );
  return snapshotSchema.parse({ ...snapshot, enrichment });
}

/** The enriched snapshot with the named pull requests' records replaced by `patch`. */
export function snapshotWithEnrichment(
  patch: Record<string, { label: string; approach: string; steps: { commitSha: string; summary: string }[] }>,
): Snapshot {
  const snapshot = enrichedSnapshot();
  return snapshotSchema.parse({ ...snapshot, enrichment: { ...(snapshot.enrichment ?? {}), ...patch } });
}

/**
 * The enriched snapshot narrowed to the named pull requests, with `mergeCommitSha` cleared
 * and the enrichment re-keyed by pull request number — what `enrichmentKey` falls back to
 * when GitHub reports no merge commit.
 */
export function snapshotWithoutMergeCommitSha(numbers: readonly number[]): Snapshot {
  const snapshot = enrichedSnapshot();
  const stored = snapshot.enrichment ?? {};
  const pullRequests = snapshot.pullRequests.filter((pullRequest) => numbers.includes(pullRequest.number));
  const enrichment = Object.fromEntries(
    pullRequests.map((pullRequest) => [
      String(pullRequest.number),
      stored[pullRequest.mergeCommitSha ?? String(pullRequest.number)],
    ]),
  );

  return snapshotSchema.parse({
    ...snapshot,
    metadata: { ...snapshot.metadata, pullRequestCount: pullRequests.length },
    pullRequests: pullRequests.map((pullRequest) => ({ ...pullRequest, mergeCommitSha: null })),
    enrichment,
  });
}

/** The enriched snapshot with extra declared dependency edges — used to build a cycle. */
export function snapshotWithExtraEdges(
  extra: readonly { from: string; to: string; kind: 'dependencies' }[],
): Snapshot {
  const snapshot = enrichedSnapshot();
  return snapshotSchema.parse({
    ...snapshot,
    packages: { ...snapshot.packages, edges: [...snapshot.packages.edges, ...extra] },
  });
}

/** The enriched snapshot with the named pull request's title replaced. */
export function snapshotWithTitle(number: number, title: string): Snapshot {
  const snapshot = enrichedSnapshot();
  return snapshotSchema.parse({
    ...snapshot,
    pullRequests: snapshot.pullRequests.map((pullRequest) =>
      pullRequest.number === number ? { ...pullRequest, title } : pullRequest,
    ),
  });
}
