import { describe, expect, it } from 'vitest';

import { DEFAULT_MAX_PULL_REQUESTS, serializeSnapshot, snapshotSchema } from '@/lib/snapshot';
import { analyzeRepository, ingestRepository } from '@/lib/ingest/ingest';
import type { AnalysisProgress } from '@/lib/live/protocol';

import {
  clientFor,
  ingestFromFixture,
  replayClient,
  transcriptWithReversedListing,
  XYFLOW,
} from './fixtures/replay';

/** Everything except the declared `metadata` block, which is the one exempt region. */
function withoutMetadata(snapshot: unknown) {
  const rest = { ...(snapshot as Record<string, unknown>) };
  delete rest.metadata;
  return rest;
}

describe('ingestRepository over captured xyflow/xyflow responses', () => {
  it('returns an object the snapshot schema validates', async () => {
    const snapshot = await ingestFromFixture();
    expect(snapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('is byte-identical across two runs once metadata is excluded', async () => {
    const first = await ingestFromFixture({ analyzedAt: '2020-01-01T00:00:00.000Z' });
    const second = await ingestFromFixture({ analyzedAt: '2031-12-31T23:59:59.000Z' });

    expect(first.metadata.analyzedAt).not.toBe(second.metadata.analyzedAt);
    expect(JSON.stringify(withoutMetadata(first))).toBe(JSON.stringify(withoutMetadata(second)));
    expect(serializeSnapshot({ ...first, metadata: second.metadata })).toBe(serializeSnapshot(second));
  });

  it('is byte-identical including metadata when the analysis clock is the same', async () => {
    const first = await ingestFromFixture({ analyzedAt: '2026-09-20T00:00:00.000Z' });
    const second = await ingestFromFixture({ analyzedAt: '2026-09-20T00:00:00.000Z' });
    expect(serializeSnapshot(first)).toBe(serializeSnapshot(second));
  });

  it('puts the analysis timestamp nowhere but metadata', async () => {
    const analyzedAt = '2026-09-20T12:34:56.789Z';
    const snapshot = await ingestFromFixture({ analyzedAt });
    expect(snapshot.metadata.analyzedAt).toBe(analyzedAt);
    expect(JSON.stringify(withoutMetadata(snapshot))).not.toContain(analyzedAt);
  });

  it('orders pull requests newest merge first', async () => {
    const snapshot = await ingestFromFixture();
    const mergedAt = snapshot.pullRequests.map((p) => p.mergedAt);
    expect(mergedAt).toEqual([...mergedAt].sort().reverse());
  });

  it('orders by merge date even when the listing arrives in another order', async () => {
    // The captured listing happens to arrive newest-merge-first, so the test above
    // passes with no sort at all. This one reverses the listing pages first.
    const reversed = await ingestRepository(clientFor(transcriptWithReversedListing()), {
      repository: XYFLOW.ref,
      since: XYFLOW.since,
      until: XYFLOW.until,
      branch: XYFLOW.branch,
      analyzedAt: '2026-09-20T00:00:00.000Z',
    });
    expect(reversed.pullRequests.map((p) => p.number)).toEqual([5992, 5997, 5994, 5977, 5987, 5989]);

    // …and the snapshot is identical to the one built from the unreversed listing,
    // which is the determinism claim: listing order must not reach the output.
    const normal = await ingestFromFixture({ analyzedAt: '2026-09-20T00:00:00.000Z' });
    expect(serializeSnapshot(reversed)).toBe(serializeSnapshot(normal));
  });

  it('keeps only pull requests merged inside the requested window', async () => {
    const snapshot = await ingestFromFixture();
    expect(snapshot.pullRequests.length).toBeGreaterThan(0);
    for (const pr of snapshot.pullRequests) {
      expect(pr.mergedAt >= XYFLOW.since).toBe(true);
      expect(pr.mergedAt < XYFLOW.until).toBe(true);
    }
  });

  it('reports counts in metadata that match the body it returned', async () => {
    const snapshot = await ingestFromFixture();
    expect(snapshot.metadata.packageCount).toBe(snapshot.packages.nodes.length);
    expect(snapshot.metadata.pullRequestCount).toBe(snapshot.pullRequests.length);
    expect(snapshot.metadata.repository).toEqual({ owner: 'xyflow', name: 'xyflow' });
  });

  it('attaches ordered commits to every pull request in the window', async () => {
    const snapshot = await ingestFromFixture();
    for (const pr of snapshot.pullRequests) {
      expect(pr.commits.length).toBeGreaterThan(0);
      expect(pr.commits.every((c) => typeof c.sha === 'string' && c.sha.length > 0)).toBe(true);
    }
  });

  it('leaves enrichment absent, so a consumer must tolerate it missing', async () => {
    const snapshot = await ingestFromFixture();
    expect(snapshot.enrichment).toBeUndefined();
  });

  it('honours an explicit pull-request ceiling', async () => {
    const snapshot = await ingestRepository(replayClient(), {
      repository: XYFLOW.ref,
      since: XYFLOW.since,
      until: XYFLOW.until,
      analyzedAt: '2026-09-20T00:00:00.000Z',
      maxPullRequests: 2,
    });
    expect(snapshot.pullRequests).toHaveLength(2);
    // The ceiling keeps the newest merges, not an arbitrary two — asserted by number so
    // it fails if the cap is applied before the sort.
    expect(snapshot.pullRequests.map((p) => p.number)).toEqual([5992, 5997]);
  });

  it('refuses a ceiling above the schema cap rather than silently truncating', async () => {
    await expect(
      ingestRepository(replayClient(), {
        repository: XYFLOW.ref,
        since: XYFLOW.since,
        until: XYFLOW.until,
        analyzedAt: '2026-09-20T00:00:00.000Z',
        maxPullRequests: 100_000,
      }),
    ).rejects.toThrow(/\b500\b/);
  });

  it('defaults the ceiling rather than fetching everything', () => {
    expect(DEFAULT_MAX_PULL_REQUESTS).toBe(100);
  });
});

/**
 * The bounded entry point a route handler calls. Same pipeline as `ingestRepository` — it
 * is what `ingestRepository` now delegates to — plus the two things a request needs that a
 * CLI does not: what the ceiling did, and progress while it runs.
 *
 * The captured window holds six merged pull requests, so a ceiling of three is a real
 * truncation against real captured output rather than a constructed one.
 */
describe('analyzeRepository', () => {
  const base = {
    repository: XYFLOW.ref,
    since: XYFLOW.since,
    until: XYFLOW.until,
    branch: XYFLOW.branch,
    analyzedAt: '2026-09-20T00:00:00.000Z',
  };

  it('reports the ceiling as untruncated when the window fits inside it', async () => {
    const { snapshot, bound } = await analyzeRepository(replayClient(), { ...base, maxPullRequests: 100 });
    expect(bound).toEqual({ maxPullRequests: 100, matched: 6, kept: 6, truncated: false });
    expect(snapshot.pullRequests).toHaveLength(6);
  });

  it('stops at the ceiling and says the window held more', async () => {
    const { snapshot, bound } = await analyzeRepository(replayClient(), { ...base, maxPullRequests: 3 });
    expect(bound).toEqual({ maxPullRequests: 3, matched: 6, kept: 3, truncated: true });
    expect(snapshot.pullRequests.map((pr) => pr.number)).toEqual([5992, 5997, 5994]);
    expect(snapshot.metadata.pullRequestCount).toBe(3);
  });

  it('produces exactly the snapshot ingestRepository does, so there is one ingest path', async () => {
    const { snapshot } = await analyzeRepository(replayClient(), base);
    const viaIngest = await ingestRepository(replayClient(), base);
    expect(serializeSnapshot(snapshot)).toBe(serializeSnapshot(viaIngest));
  });

  it('reports progress for every step, at least once per pull request read', async () => {
    const seen: AnalysisProgress[] = [];
    const { bound } = await analyzeRepository(replayClient(), {
      ...base,
      onProgress: (progress) => seen.push(progress),
    });

    expect(seen.map((p) => p.step).filter((step, index, all) => all.indexOf(step) === index)).toEqual([
      'resolve',
      'topology',
      'pull-requests',
      'details',
      'attribute',
    ]);

    const details = seen.filter((progress) => progress.step === 'details');
    expect(details).toHaveLength(bound.kept);
    expect(details.map((progress) => progress.done)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(details.every((progress) => progress.total === bound.kept)).toBe(true);

    // Each one names the pull request it just read and the packages it reached, which is
    // what the progress view's "just read" list shows.
    const read = details.flatMap((progress) => (progress.read ? [progress.read] : []));
    expect(read.map((entry) => entry.number).sort((a, b) => a - b)).toEqual([5977, 5987, 5989, 5992, 5994, 5997]);
    expect(read.every((entry) => entry.title.length > 0)).toBe(true);
    expect(read.some((entry) => entry.packages.length > 0)).toBe(true);
  });

  it('reports the truncation on the pull-request step, before any detail is fetched', async () => {
    const seen: AnalysisProgress[] = [];
    await analyzeRepository(replayClient(), {
      ...base,
      maxPullRequests: 3,
      onProgress: (progress) => seen.push(progress),
    });

    const listing = seen.find((progress) => progress.step === 'pull-requests');
    expect(listing).toMatchObject({ done: 3, total: 3, matched: 6, truncated: true });

    // The bound is applied before the volumetric per-pull-request work starts: three
    // details, not six with three thrown away.
    expect(seen.filter((progress) => progress.step === 'details')).toHaveLength(3);
    expect(seen.indexOf(listing as AnalysisProgress)).toBeLessThan(
      seen.findIndex((progress) => progress.step === 'details'),
    );
  });
});
