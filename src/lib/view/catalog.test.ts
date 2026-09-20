import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { deriveWindow, historyBounds } from '@/lib/view/derive';
import { getSnapshot, listSnapshots } from '@/lib/view/catalog';

/** The committed snapshot directory, read here — under the test runner — and nowhere else. */
function filesOnDisk(): string[] {
  return readdirSync(join(import.meta.dirname, '..', 'snapshots'))
    .filter((name) => name.endsWith('.json'))
    .sort();
}

describe('the snapshot catalog', () => {
  it('lists every snapshot committed to the directory, and nothing else', () => {
    // The index is generated from the directory at build time. If it drifts — a snapshot
    // baked by another chunk, or one removed — this is what says so.
    expect(listSnapshots().map((entry) => entry.file).sort()).toEqual(filesOnDisk());
  });

  it('describes a snapshot from what the snapshot says, not from a hardcoded row', () => {
    const entry = listSnapshots().find((candidate) => candidate.id === 'xyflow-xyflow-2026-08-31');

    expect(entry).toBeDefined();
    expect(entry?.repository).toBe(['xyflow', 'xyflow'].join('/'));
    expect(entry?.packageCount).toBe(10);
    expect(entry?.pullRequestCount).toBe(6);
    expect(entry?.window).toEqual({ since: '2026-08-31T00:00:00Z', until: '2026-09-02T00:00:00Z' });
  });

  it('reports a snapshot the enrichment pass has not run over as un-enriched', () => {
    const entry = listSnapshots().find((candidate) => candidate.id === 'xyflow-xyflow-2026-08-31');

    expect(entry?.enriched).toBe(false);
    expect(getSnapshot('xyflow-xyflow-2026-08-31').enrichment).toBeUndefined();
  });

  it('returns a schema-valid snapshot the canvas can derive from', () => {
    const snapshot = getSnapshot('xyflow-xyflow-2026-08-31');
    const view = deriveWindow(snapshot, historyBounds(snapshot));

    expect(view.changeCount).toBe(6);
    expect(view.touchedCount).toBe(6);
  });

  it('refuses an id it does not have rather than returning an empty snapshot', () => {
    expect(() => getSnapshot('not-a-snapshot')).toThrow(/not-a-snapshot/);
  });
});
