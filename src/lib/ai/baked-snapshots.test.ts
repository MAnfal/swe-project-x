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

/** The repositories the plan curates. A snapshot of each is baked and enriched. */
const CURATED_REPOSITORIES = ['xyflow-xyflow-', 'shadcn-ui-ui-', 'trpc-trpc-'] as const;

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
      expect.arrayContaining(CURATED_REPOSITORIES.map((prefix) => expect.stringContaining(prefix))),
    );
  });

  it.each(snapshots)('$file is either fully enriched or has no enrichment at all', ({ snapshot }) => {
    expect(snapshot.pullRequests.length).toBeGreaterThan(0);

    // A snapshot with no `enrichment` key is an un-enriched view fixture: the canvas must
    // render one, and `snapshot.ts` declares the field optional for exactly that reason.
    // Nothing to check about enrichment it never claimed to have.
    if (snapshot.enrichment === undefined) {
      expect(snapshot.packages.nodes.length).toBeGreaterThan(0);
      return;
    }

    // Once a snapshot claims enrichment, every pull request must have it. *Partial*
    // enrichment is the real defect — a bake that half-finished, or a producer that
    // silently dropped entries — and this catches it on any snapshot, including one for a
    // repository nobody has curated yet.
    for (const pullRequest of snapshot.pullRequests) {
      const entry = snapshot.enrichment[enrichmentKey(pullRequest)];
      expect(entry, `pull request #${pullRequest.number} has no enrichment`).toBeDefined();
      expect(entry?.label.length).toBeGreaterThan(0);
      expect(entry?.approach.length).toBeGreaterThan(0);
      expect(entry?.steps.length).toBeGreaterThan(0);
    }
  });

  // "Fully enriched or not at all" alone would be satisfied by a curated bake that
  // produced nothing. This is the other half: for each curated repository, at least one
  // committed snapshot must actually carry complete enrichment. Matching by prefix rather
  // than by filename keeps it true across re-bakes at different windows, and lets a
  // repository also carry an un-enriched view fixture without weakening the check.
  it.each(CURATED_REPOSITORIES)('%s has at least one fully enriched committed snapshot', (prefix) => {
    const candidates = snapshots.filter((entry) => entry.file.startsWith(prefix));
    expect(candidates.length, `no committed snapshot for ${prefix}`).toBeGreaterThan(0);

    const complete = candidates.filter(
      ({ snapshot }) =>
        snapshot.enrichment !== undefined &&
        snapshot.pullRequests.length > 0 &&
        snapshot.pullRequests.every((pullRequest) => {
          const entry = snapshot.enrichment?.[enrichmentKey(pullRequest)];
          return entry !== undefined && entry.label.length > 0 && entry.approach.length > 0 && entry.steps.length > 0;
        }),
    );

    expect(complete.length, `${prefix}: no committed snapshot carries complete enrichment`).toBeGreaterThan(0);
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
    if (snapshot.enrichment === undefined) return; // no enrichment claimed, nothing to grade

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
