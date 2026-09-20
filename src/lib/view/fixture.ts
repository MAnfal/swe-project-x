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
