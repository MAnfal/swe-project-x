import type { RepositoryRef } from '../ingest/github.ts';
import { assertSafeKey, type EnrichmentEntry, type PullRequestRecord } from '../snapshot.ts';
import { enrichmentKey } from './enrichment-record.ts';

/**
 * The on-demand enrichment cache: one model call per pull request per serving instance.
 *
 * Bounded, because the deployment target has no writable filesystem and no shared store,
 * so this lives in the process and grows with every repository anyone analyzes. A miss is
 * the normal case — a cold instance has an empty cache, and nothing may treat that as an
 * error (Principle 2 requires the answer be reused *for the session*, not that it be
 * durable).
 *
 * No `ai` import: the producer arrives as a thunk, so this module stays reachable from
 * anywhere without pulling the AI SDK along.
 */

/**
 * Entries kept per serving instance. 200 records at roughly 400 bytes each is under
 * 100 KB — small against a function's memory, and two full 100-pull-request analyses
 * deep, which is more than one session expands.
 */
export const DEFAULT_ENRICHMENT_CACHE_ENTRIES = 200;

export type EnrichmentCache = {
  get(key: string): EnrichmentEntry | undefined;
  set(key: string, entry: EnrichmentEntry): void;
  readonly size: number;
  readonly maxEntries: number;
};

/**
 * A least-recently-used cache over a `Map`, which iterates in insertion order — so
 * deleting and re-inserting on read makes the first key the least recently used one.
 */
export function createEnrichmentCache(maxEntries: number = DEFAULT_ENRICHMENT_CACHE_ENTRIES): EnrichmentCache {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new Error(`enrichment cache size must be a positive integer, received ${String(maxEntries)}`);
  }

  // A `Map`, not an object literal: a repository-derived key must never reach
  // `Object.prototype`, and `map.get('toString')` is undefined where an object's is not.
  const entries = new Map<string, EnrichmentEntry>();

  return {
    get(key) {
      const entry = entries.get(key);
      if (entry === undefined) return undefined;
      entries.delete(key);
      entries.set(key, entry);
      return entry;
    },
    set(key, entry) {
      entries.delete(key);
      entries.set(key, entry);
      // `Map` iterates in insertion order, and `get` re-inserts — so the first key is
      // the least recently used one. Iterating rather than calling `keys().next()` keeps
      // the loop free of an `is the map empty` branch nothing can reach: the loop is only
      // entered when the size is above a bound that is at least 1.
      for (const oldest of entries.keys()) {
        if (entries.size <= maxEntries) break;
        entries.delete(oldest);
      }
    },
    get size() {
      return entries.size;
    },
    maxEntries,
  };
}

/**
 * The cache key for one pull request of one repository.
 *
 * The pull-request half is `enrichmentKey` — chunk 03's derivation, imported rather than
 * re-derived, so the live path and a baked snapshot key the same change identically. The
 * repository half scopes it: two repositories can carry the same pull-request number, and
 * a client supplies both halves.
 */
export function enrichmentCacheKey(
  repository: RepositoryRef,
  pullRequest: Pick<PullRequestRecord, 'number' | 'mergeCommitSha'>,
): string {
  assertSafeKey(repository.owner, 'repository owner');
  assertSafeKey(repository.repo, 'repository name');

  const key = `${repository.owner}/${repository.repo}#${enrichmentKey(pullRequest)}`;
  assertSafeKey(key, 'enrichment cache key');
  return key;
}

export type CachedEnrichment = {
  entry: EnrichmentEntry;
  /** True when the entry came from the cache and no model was asked. */
  cached: boolean;
  /** True when this is chunk 03's degraded record rather than a model result. */
  fallback: boolean;
};

/**
 * Returns the stored record for `key`, or produces one and stores it.
 *
 * A **failure is never stored**, matching `enrichSnapshot`'s rule: a degraded record is a
 * failure receipt, not a result, and caching one would freeze a transient provider error
 * into every later expansion of that change for the life of the instance.
 */
export async function cachedEnrichment(options: {
  cache: EnrichmentCache;
  key: string;
  enrich: () => Promise<{ entry: EnrichmentEntry; failed: boolean }>;
}): Promise<CachedEnrichment> {
  const hit = options.cache.get(options.key);
  if (hit !== undefined) return { entry: hit, cached: true, fallback: false };

  const outcome = await options.enrich();
  if (!outcome.failed) options.cache.set(options.key, outcome.entry);

  return { entry: outcome.entry, cached: false, fallback: outcome.failed };
}
