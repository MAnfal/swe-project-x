import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { enrichmentKey, isFallbackEnrichment } from '@/lib/ai/enrichment';
import { snapshotSchema, type Snapshot } from '@/lib/snapshot';

/**
 * The committed snapshots are captured output of the bake command, never hand-edited
 * (Principle 4) — so this spec asserts the properties the pipeline guarantees rather than
 * any particular value. It lives beside the enrichment module that produced them because
 * `src/lib/snapshots/` holds data files only.
 *
 * Re-bake with:
 *   node scripts/ingest.mts --repo <owner/repo> --since <iso> --until <iso> \
 *     --out src/lib/snapshots/<owner>-<repo>-<since-date>.json --enrich
 */

const SNAPSHOT_DIR = join(import.meta.dirname, '..', 'snapshots');

function bakedSnapshots(): { file: string; snapshot: Snapshot }[] {
  return readdirSync(SNAPSHOT_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({
      file,
      snapshot: snapshotSchema.parse(JSON.parse(readFileSync(join(SNAPSHOT_DIR, file), 'utf8'))),
    }));
}

describe('committed snapshots', () => {
  const snapshots = bakedSnapshots();

  it('are present for the curated repositories', () => {
    expect(snapshots.map((entry) => entry.file)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('xyflow-xyflow-'),
        expect.stringContaining('shadcn-ui-ui-'),
        expect.stringContaining('trpc-trpc-'),
      ]),
    );
  });

  it.each(snapshots)('$file carries enrichment for every pull request', ({ snapshot }) => {
    expect(snapshot.pullRequests.length).toBeGreaterThan(0);

    for (const pullRequest of snapshot.pullRequests) {
      const entry = snapshot.enrichment?.[enrichmentKey(pullRequest)];
      expect(entry, `pull request #${pullRequest.number} has no enrichment`).toBeDefined();
      expect(entry?.label.length).toBeGreaterThan(0);
      expect(entry?.approach.length).toBeGreaterThan(0);
      expect(entry?.steps.length).toBeGreaterThan(0);
    }
  });

  it.each(snapshots)('$file names only commits its pull requests really contain', ({ snapshot }) => {
    for (const pullRequest of snapshot.pullRequests) {
      const entry = snapshot.enrichment?.[enrichmentKey(pullRequest)];
      if (!entry || isFallbackEnrichment(entry)) continue;

      const shas = new Set(pullRequest.commits.map((commit) => commit.sha));
      for (const step of entry.steps) {
        expect(shas.has(step.commitSha), `#${pullRequest.number} step names unknown commit ${step.commitSha}`).toBe(
          true,
        );
      }
    }
  });

  it.each(snapshots)('$file is mostly real model output, not a directory of fallbacks', ({ snapshot }) => {
    const entries = snapshot.pullRequests.map((pullRequest) => snapshot.enrichment?.[enrichmentKey(pullRequest)]);
    const real = entries.filter((entry) => entry && !isFallbackEnrichment(entry));

    expect(real.length).toBeGreaterThan(entries.length / 2);
  });

  it.each(snapshots)('$file carries no credential', ({ file }) => {
    const raw = readFileSync(join(SNAPSHOT_DIR, file), 'utf8');

    expect(raw).not.toMatch(/gh[pousr]_[A-Za-z0-9]{16,}/);
    expect(raw).not.toMatch(/sk-ant-[A-Za-z0-9-]{16,}/);
    expect(raw).not.toMatch(/access_token=/);
    expect(raw).not.toContain('ANTHROPIC_API_KEY');
  });
});
