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
