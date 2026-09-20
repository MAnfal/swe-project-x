import { describe, expect, it } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';

import {
  cachedEnrichment,
  createEnrichmentCache,
  DEFAULT_ENRICHMENT_CACHE_ENTRIES,
  enrichmentCacheKey,
} from '@/lib/ai/enrichment-cache';
import { enrichPullRequest, FALLBACK_APPROACH, isFallbackEnrichment } from '@/lib/ai/enrichment';
import type { EnrichmentEntry, PullRequestRecord } from '@/lib/snapshot';

/**
 * The cache is asserted through the record a caller receives, never through a call count
 * on a mock (`bibles/swe/testing.md`). Every model double below answers *differently on
 * each call*, so "the second request made no model call" is observable: the caller gets
 * the first answer back, not the second.
 */

const COMMIT = 'aaaaaaaabbbbbbbbccccccccddddddddeeeeeeee';

function pullRequest(overrides: Partial<PullRequestRecord> = {}): PullRequestRecord {
  return {
    number: 5989,
    title: 'feat(system): add global site settings',
    body: null,
    author: 'moklick',
    mergedAt: '2026-08-31T09:22:57Z',
    mergeCommitSha: '1f0c2d3e4a5b6c7d8e9f0a1b2c3d4e5f60718293',
    url: 'https://github.com/xyflow/xyflow/pull/5989',
    commits: [{ sha: COMMIT, message: 'add site_settings table' }],
    files: [
      {
        path: 'packages/system/src/render-config.ts',
        additions: 8,
        deletions: 2,
        status: 'modified',
        package: '@xyflow/system',
      },
    ],
    directPackages: ['@xyflow/system'],
    indirectPackages: [],
    ...overrides,
  };
}

/** A model whose label counts up, so two answers are never the same string. */
function countingModel(): MockLanguageModelV4 {
  let call = 0;
  return new MockLanguageModelV4({
    doGenerate: async () => {
      call += 1;
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              label: `Model answer ${call}`,
              approach: `Approach from call ${call}.`,
              steps: [{ commitSha: COMMIT, summary: `Step from call ${call}` }],
            }),
          },
        ],
        finishReason: { unified: 'stop' as const, raw: 'end_turn' },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 5, text: 5, reasoning: 0 },
        },
        warnings: [],
      };
    },
  });
}

/** A model that always fails, so the caller gets chunk 03's fallback record. */
function failingModel(): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => {
      throw new Error('provider is down');
    },
  });
}

function enrichWith(model: MockLanguageModelV4, record: PullRequestRecord) {
  return async () => enrichPullRequest({ model, pullRequest: record, maxRetries: 0 });
}

const REF = { owner: 'xyflow', repo: 'xyflow' };

describe('enrichmentCacheKey', () => {
  it('reuses chunk 03 key derivation — the merge commit SHA', () => {
    const record = pullRequest();
    expect(enrichmentCacheKey(REF, record)).toContain(record.mergeCommitSha as string);
  });

  it('falls back to the pull-request number when GitHub reported no merge commit', () => {
    expect(enrichmentCacheKey(REF, pullRequest({ mergeCommitSha: null }))).toContain('5989');
  });

  it('scopes the key to the repository, so the same SHA in two repositories cannot collide', () => {
    const record = pullRequest();
    expect(enrichmentCacheKey(REF, record)).not.toBe(enrichmentCacheKey({ owner: 'a', repo: 'b' }, record));
  });

  it('names which half of the key was reserved', () => {
    expect(() => enrichmentCacheKey({ owner: 'acme', repo: '__proto__' }, pullRequest())).toThrow(
      /repository name/i,
    );
    expect(() => enrichmentCacheKey({ owner: '__proto__', repo: 'acme' }, pullRequest())).toThrow(
      /repository owner/i,
    );
  });

  it('refuses a reserved key rather than letting it reach the record', () => {
    // Belt and braces with `parseRepositoryUrl`, which rejects these earlier: the schema
    // cannot catch a reserved key (zod 4.6.5 drops `__proto__` silently), so the guard
    // lives at every point where repository-derived text becomes a key.
    expect(() => enrichmentCacheKey({ owner: '__proto__', repo: '__proto__' }, pullRequest())).toThrow(
      /reserved/i,
    );
  });
});

describe('createEnrichmentCache', () => {
  it('returns what was stored', () => {
    const cache = createEnrichmentCache();
    const entry: EnrichmentEntry = { label: 'x', approach: 'y', steps: [{ commitSha: COMMIT, summary: 's' }] };
    cache.set('k', entry);
    expect(cache.get('k')).toEqual(entry);
  });

  it('reports a miss as undefined, which is the normal case and not an error', () => {
    expect(createEnrichmentCache().get('never-stored')).toBeUndefined();
  });

  it('never answers from the object prototype', () => {
    expect(createEnrichmentCache().get('toString')).toBeUndefined();
  });

  it('evicts rather than growing past its bound', () => {
    const cache = createEnrichmentCache(3);
    for (let i = 0; i < 10; i += 1) {
      cache.set(`key-${i}`, { label: `l${i}`, approach: 'a', steps: [{ commitSha: COMMIT, summary: 's' }] });
    }
    expect(cache.size).toBe(3);
    expect(cache.get('key-0')).toBeUndefined();
    expect(cache.get('key-9')?.label).toBe('l9');
  });

  it('evicts the least recently *used*, not the least recently written', () => {
    const cache = createEnrichmentCache(2);
    const entry = (label: string): EnrichmentEntry => ({
      label,
      approach: 'a',
      steps: [{ commitSha: COMMIT, summary: 's' }],
    });
    cache.set('a', entry('a'));
    cache.set('b', entry('b'));
    cache.get('a'); // `a` is now the most recent
    cache.set('c', entry('c'));

    expect(cache.get('a')?.label).toBe('a');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')?.label).toBe('c');
  });

  it.each([0, -1, 1.5, Number.NaN])('refuses a size of %s rather than caching nothing forever', (size) => {
    expect(() => createEnrichmentCache(size)).toThrow(/positive integer/i);
  });

  it('defaults to a bound rather than to unbounded growth', () => {
    expect(DEFAULT_ENRICHMENT_CACHE_ENTRIES).toBeGreaterThan(0);
    expect(createEnrichmentCache().maxEntries).toBe(DEFAULT_ENRICHMENT_CACHE_ENTRIES);
  });
});

describe('cachedEnrichment', () => {
  it('produces a record on the first request for a merge SHA', async () => {
    const cache = createEnrichmentCache();
    const record = pullRequest();
    const result = await cachedEnrichment({
      cache,
      key: enrichmentCacheKey(REF, record),
      enrich: enrichWith(countingModel(), record),
    });

    expect(result.cached).toBe(false);
    expect(result.entry.label).toBe('Model answer 1');
    expect(result.entry.steps[0].commitSha).toBe(COMMIT);
  });

  it('answers the second request for the same merge SHA without a model call', async () => {
    const cache = createEnrichmentCache();
    const record = pullRequest();
    const key = enrichmentCacheKey(REF, record);
    const model = countingModel();

    const first = await cachedEnrichment({ cache, key, enrich: enrichWith(model, record) });
    const second = await cachedEnrichment({ cache, key, enrich: enrichWith(model, record) });

    // The model would answer "Model answer 2" if it had been asked again. It was not.
    expect(second.entry).toEqual(first.entry);
    expect(second.entry.label).toBe('Model answer 1');
    expect(second.cached).toBe(true);
  });

  it('asks again for a different merge SHA', async () => {
    const cache = createEnrichmentCache();
    const model = countingModel();
    const a = pullRequest();
    const b = pullRequest({ number: 5990, mergeCommitSha: `${'9'.repeat(40)}` });

    const first = await cachedEnrichment({
      cache,
      key: enrichmentCacheKey(REF, a),
      enrich: enrichWith(model, a),
    });
    const second = await cachedEnrichment({
      cache,
      key: enrichmentCacheKey(REF, b),
      enrich: enrichWith(model, b),
    });

    expect(first.entry.label).toBe('Model answer 1');
    expect(second.entry.label).toBe('Model answer 2');
  });

  it('returns chunk 03 fallback when the model fails, never a blank record', async () => {
    const cache = createEnrichmentCache();
    const record = pullRequest();
    const result = await cachedEnrichment({
      cache,
      key: enrichmentCacheKey(REF, record),
      enrich: enrichWith(failingModel(), record),
    });

    expect(result.fallback).toBe(true);
    expect(isFallbackEnrichment(result.entry)).toBe(true);
    expect(result.entry.label).toBe(record.title);
    expect(result.entry.approach).toBe(FALLBACK_APPROACH);
  });

  it('does not cache a failure, so a retry can still succeed', async () => {
    const cache = createEnrichmentCache();
    const record = pullRequest();
    const key = enrichmentCacheKey(REF, record);

    const failed = await cachedEnrichment({ cache, key, enrich: enrichWith(failingModel(), record) });
    expect(failed.fallback).toBe(true);
    expect(cache.size).toBe(0);

    const retried = await cachedEnrichment({ cache, key, enrich: enrichWith(countingModel(), record) });
    expect(retried.fallback).toBe(false);
    expect(retried.entry.label).toBe('Model answer 1');
  });

  it('serves an evicted key by asking again rather than by returning nothing', async () => {
    const cache = createEnrichmentCache(1);
    const model = countingModel();
    const a = pullRequest();
    const b = pullRequest({ number: 5990, mergeCommitSha: `${'9'.repeat(40)}` });
    const keyA = enrichmentCacheKey(REF, a);

    await cachedEnrichment({ cache, key: keyA, enrich: enrichWith(model, a) });
    await cachedEnrichment({ cache, key: enrichmentCacheKey(REF, b), enrich: enrichWith(model, b) });

    const again = await cachedEnrichment({ cache, key: keyA, enrich: enrichWith(model, a) });
    expect(again.cached).toBe(false);
    expect(again.entry.label).toBe('Model answer 3');
  });
});
