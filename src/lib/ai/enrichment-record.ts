import type { EnrichmentEntry, PullRequestRecord } from '../snapshot.ts';

/**
 * The parts of the enrichment contract that involve no model: how a record is keyed, what
 * a degraded record looks like, and how to tell one from a real result.
 *
 * Split out of `enrichment.ts` by chunk 05 for one reason: the view derivation needs
 * `enrichmentKey` and `isFallbackEnrichment`, and `src/lib/view/derive.ts` is imported by
 * client components. `enrichment.ts` imports `ai`, so reaching those helpers through it
 * would pull the AI SDK into the canvas bundle — Principle 2 forbids an `ai` import on any
 * path a component reaches. Nothing here imports `ai`.
 *
 * `enrichment.ts` re-exports every symbol below, so chunk 03's public surface is unchanged.
 */

/** Bound on the model's label, and on the pull request title a fallback is built from. */
export const MAX_LABEL_CHARS = 80;

/**
 * The fallback marker.
 *
 * It lives *inside* `approach` rather than as an extra field, because
 * `enrichmentEntrySchema` is a plain `z.object` and strips unknown keys — measured on
 * zod 4.6.5: parsing `{label, approach, steps, fallback: true}` returns an object with no
 * `fallback` key, so a marker declared alongside the entry would not survive the snapshot
 * write. A renderer distinguishes a real label from a degraded one with
 * `isFallbackEnrichment`, never by string-matching this constant itself.
 */
export const FALLBACK_APPROACH = 'Enrichment did not complete for this pull request, so no approach note is available.';

/**
 * The single step a degraded record carries. `enrichmentEntrySchema` requires at least one
 * step, so an empty chain is not expressible; this one names the pull request itself
 * rather than inventing a commit.
 */
export const FALLBACK_STEP_SUMMARY = 'No step chain — enrichment did not complete for this pull request.';

/**
 * The cache key for a pull request's enrichment.
 *
 * The merge commit SHA, which is what makes enrichment a pure function of the change —
 * it does not vary with the window or the analysis clock. `pullRequestSchema.mergeCommitSha`
 * is nullable (GitHub reports none for some merges), so a pull request without one is keyed
 * by its number. A number never collides with a 40-character SHA.
 */
export function enrichmentKey(pullRequest: Pick<PullRequestRecord, 'number' | 'mergeCommitSha'>): string {
  return pullRequest.mergeCommitSha ?? String(pullRequest.number);
}

/** True when this entry is a degraded record rather than a model result. */
export function isFallbackEnrichment(entry: EnrichmentEntry): boolean {
  return entry.approach === FALLBACK_APPROACH;
}

/**
 * The record a pull request gets when its model call fails: its own title as the label,
 * so the node still renders something a reader recognises.
 */
export function fallbackEnrichment(pullRequest: PullRequestRecord): EnrichmentEntry {
  const title = pullRequest.title.trim();
  return {
    label: title.length > 0 ? title.slice(0, MAX_LABEL_CHARS) : `Pull request #${pullRequest.number}`,
    approach: FALLBACK_APPROACH,
    steps: [{ commitSha: enrichmentKey(pullRequest), summary: FALLBACK_STEP_SUMMARY }],
  };
}
