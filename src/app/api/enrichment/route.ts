import { createAnthropic } from '@ai-sdk/anthropic';

import { cachedEnrichment, createEnrichmentCache, enrichmentCacheKey } from '@/lib/ai/enrichment-cache';
import { DEFAULT_ENRICHMENT_MODEL, enrichPullRequest } from '@/lib/ai/enrichment';
import { parseRepositoryUrl } from '@/lib/live/request';
import { pullRequestSchema } from '@/lib/snapshot';

/**
 * Enriches one pull request on demand — the label, the approach note and the step chain a
 * change node shows when it is first expanded.
 *
 * A thin orchestrator: it validates the boundary, reads the credential, derives the cache
 * key with chunk 03's own `enrichmentKey`, and hands `enrichPullRequest` a configured
 * model. The prompt, the schema, the SHA resolution and the fallback are all chunk 03's
 * and are not restated here — a second enrichment prompt in this chunk would be a defect.
 *
 * Node.js runtime because the AI SDK does not run on the Edge runtime. 60 seconds rather
 * than the 300 the analysis route takes: this is one model call, and a request that has
 * not answered in a minute has failed, not stalled.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * **Per serving instance, and gone when it recycles.** The deployment target has no
 * writable filesystem and no shared store at request time (Principle 3), so this is a
 * module-scope object living as long as the process that holds it. A cold instance starts
 * empty and re-asks the model; that is a normal miss, not an error, and nothing downstream
 * may depend on a hit.
 */
const cache = createEnrichmentCache();

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as {
    repository?: { owner?: unknown; name?: unknown };
    pullRequest?: unknown;
  };

  // The repository goes through the same parser the analysis route uses, because it is
  // the same kind of value: request-derived text that becomes half a cache key.
  const owner = typeof body.repository?.owner === 'string' ? body.repository.owner : '';
  const name = typeof body.repository?.name === 'string' ? body.repository.name : '';
  const parsed = parseRepositoryUrl(`${owner}/${name}`);
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });

  const record = pullRequestSchema.safeParse(body.pullRequest);
  if (!record.success) {
    return Response.json({ message: 'That is not a pull request Grain can enrich.' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ message: 'Grain has no Anthropic key configured.' }, { status: 500 });
  }

  const key = enrichmentCacheKey(parsed.ref, record.data);
  const modelId = process.env.ENRICHMENT_MODEL ?? DEFAULT_ENRICHMENT_MODEL;

  const result = await cachedEnrichment({
    cache,
    key,
    enrich: () =>
      enrichPullRequest({
        model: createAnthropic({ apiKey })(modelId),
        pullRequest: record.data,
        abortSignal: request.signal,
      }),
  });

  console.log(`[Enrichment] ${key} ${result.cached ? 'cache hit' : result.fallback ? 'fallback' : 'generated'}`);
  return Response.json(
    { key, entry: result.entry, cached: result.cached, fallback: result.fallback },
    { headers: { 'cache-control': 'no-store' } },
  );
}
