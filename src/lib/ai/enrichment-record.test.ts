import { describe, expect, it } from 'vitest';

import {
  FALLBACK_APPROACH,
  FALLBACK_STEP_SUMMARY,
  MAX_LABEL_CHARS,
  enrichmentKey,
  fallbackEnrichment,
  isFallbackEnrichment,
} from '@/lib/ai/enrichment-record';
import * as enrichment from '@/lib/ai/enrichment';
import { enrichmentEntrySchema } from '@/lib/snapshot';
import { loadSnapshot, snapshotWithTitle, snapshotWithoutMergeCommitSha } from '@/lib/view/fixture';

/**
 * The model-free half of the enrichment contract, exercised **directly** rather than
 * through `enrichment.ts`'s re-export — the Convention Map asks every `src/lib/**` module
 * for a co-located spec, and a spec that only reaches a module through another module's
 * surface cannot tell the two apart.
 *
 * Every pull request here is a real captured one, read off a committed snapshot. These are
 * transforms over the ingester's output, so the bible's rule applies: test them against
 * what the producer really wrote, not a hand-rolled approximation of it.
 */

const xyflow = loadSnapshot('xyflow-xyflow-2026-06-22.json');
const trpc = loadSnapshot('trpc-trpc-2026-06-22.json');

function capturedPullRequest(number: number) {
  const found = xyflow.pullRequests.find((candidate) => candidate.number === number);
  if (found === undefined) throw new Error(`the capture has no pull request #${number}`);
  return found;
}

describe('enrichmentKey', () => {
  it('keys a change by the merge commit the ingester recorded', () => {
    const pullRequest = capturedPullRequest(5994);

    expect(pullRequest.mergeCommitSha).not.toBeNull();
    expect(enrichmentKey(pullRequest)).toBe(pullRequest.mergeCommitSha);
    // And that key is the one the bake really wrote under.
    expect(Object.keys(xyflow.enrichment ?? {})).toContain(enrichmentKey(pullRequest));
  });

  it('falls back to the number when GitHub reported no merge commit', () => {
    // Constructed: 0 of the 242 captured pull requests have a null `mergeCommitSha`, and
    // `pullRequestSchema` declares the field nullable.
    const keyed = snapshotWithoutMergeCommitSha([5994]);

    expect(keyed.pullRequests[0].mergeCommitSha).toBeNull();
    expect(enrichmentKey(keyed.pullRequests[0])).toBe('5994');
  });
});

describe('fallbackEnrichment', () => {
  it('names the change by the pull request title the ingester captured', () => {
    const pullRequest = capturedPullRequest(5994);
    // Parsed through the snapshot's own schema: the assertion is on the value a consumer
    // receives, not on the object literal this function happened to build.
    const entry = enrichmentEntrySchema.parse(fallbackEnrichment(pullRequest));

    expect(entry.label).toBe('fix(store): reset functions');
    expect(entry.approach).toBe(FALLBACK_APPROACH);
    expect(entry.steps).toEqual([{ commitSha: pullRequest.mergeCommitSha, summary: FALLBACK_STEP_SUMMARY }]);
  });

  it('clips a title too long to render on a card', () => {
    // #5871's captured title is 94 characters — longer than a card can carry.
    const pullRequest = capturedPullRequest(5871);

    expect(pullRequest.title.length).toBeGreaterThan(MAX_LABEL_CHARS);
    expect(fallbackEnrichment(pullRequest).label).toHaveLength(MAX_LABEL_CHARS);
    expect(fallbackEnrichment(pullRequest).label).toBe(pullRequest.title.slice(0, MAX_LABEL_CHARS));
  });

  it('names the change by its number when there is no title to use', () => {
    // Constructed: every captured pull request has a non-empty title.
    const blanked = snapshotWithTitle(5994, '   ');
    const pullRequest = blanked.pullRequests.find((candidate) => candidate.number === 5994);

    expect(fallbackEnrichment(pullRequest!).label).toBe('Pull request #5994');
  });

  it('always produces a record the snapshot schema accepts', () => {
    // `enrichmentEntrySchema` requires at least one step, so an empty chain is not
    // expressible — which is why the degraded record names the pull request itself.
    for (const pullRequest of xyflow.pullRequests) {
      expect(() => enrichmentEntrySchema.parse(fallbackEnrichment(pullRequest))).not.toThrow();
    }
  });
});

describe('isFallbackEnrichment', () => {
  it('recognises the record this module itself builds', () => {
    expect(isFallbackEnrichment(fallbackEnrichment(capturedPullRequest(5994)))).toBe(true);
  });

  it('recognises the degraded record the real bake wrote', () => {
    // trpc/trpc#7592 has no commits, so no step chain could be derived and the bake stored
    // a fallback. The one captured receipt that the predicate matches real output.
    const degraded = Object.values(trpc.enrichment ?? {}).filter((entry) => isFallbackEnrichment(entry));

    expect(degraded).toHaveLength(1);
    expect(degraded[0].approach).toBe(FALLBACK_APPROACH);
  });

  it('leaves every real model result alone', () => {
    const entries = Object.values(xyflow.enrichment ?? {});

    expect(entries.length).toBe(100);
    expect(entries.filter((entry) => isFallbackEnrichment(entry))).toEqual([]);
  });
});

describe('the enrichment.ts re-export', () => {
  it("hands back this module's bindings rather than a second copy", () => {
    // The relocation is only safe while the two surfaces cannot drift. If `enrichment.ts`
    // ever redefines one of these instead of re-exporting it, this fails.
    expect(enrichment.enrichmentKey).toBe(enrichmentKey);
    expect(enrichment.fallbackEnrichment).toBe(fallbackEnrichment);
    expect(enrichment.isFallbackEnrichment).toBe(isFallbackEnrichment);
    expect(enrichment.FALLBACK_APPROACH).toBe(FALLBACK_APPROACH);
    expect(enrichment.FALLBACK_STEP_SUMMARY).toBe(FALLBACK_STEP_SUMMARY);
    expect(enrichment.MAX_LABEL_CHARS).toBe(MAX_LABEL_CHARS);
  });
});
