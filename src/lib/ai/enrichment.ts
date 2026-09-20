import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';

import {
  buildRecord,
  enrichmentEntrySchema,
  type EnrichmentEntry,
  type PullRequestRecord,
  type Snapshot,
} from '../snapshot.ts';

/**
 * The one model call in the whole pipeline: given a pull request's metadata, what the
 * change was, how it was done, and the ordered chain of commits that produced it.
 *
 * Three rules this module exists to hold:
 *
 * 1. **No credential is read here.** The caller hands in a configured `LanguageModel`
 *    (Principle 1) — a script or a route handler resolves `ANTHROPIC_API_KEY`, never
 *    `src/lib/`.
 * 2. **A failure degrades, it never blanks a node.** Every path returns an entry that
 *    validates against `enrichmentEntrySchema`; a failed call falls back to the pull
 *    request's own title and is counted and reported rather than swallowed.
 * 3. **Enrichment is keyed by merge SHA** (`enrichmentKey`), so it is computed once per
 *    pull request and reused forever. Chunk 06's in-memory cache uses this same function
 *    rather than re-deriving the key.
 *
 * The payload is metadata only — title, body, commit messages, changed paths, packages.
 * No patches: that is what keeps one call per pull request affordable, and it is bounded
 * before the call so a pathological pull request cannot overrun the model's context.
 */

/**
 * Default model. Set by ORCHESTRATOR.md Design Decision 10: the payload is metadata only,
 * so the ceiling on `approach` quality is the signal in the commit messages rather than
 * the model reading them. Overridable by the caller — escalating is an environment change,
 * not a code change.
 */
export const DEFAULT_ENRICHMENT_MODEL = 'claude-haiku-4-5';

/** How many pull requests may be in flight at once during a bake. */
export const DEFAULT_ENRICHMENT_CONCURRENCY = 4;

/** Bounds on the model's output, so a record stays renderable on a canvas node. */
export const MAX_LABEL_CHARS = 80;
export const MAX_APPROACH_CHARS = 320;
export const MAX_STEP_SUMMARY_CHARS = 140;
export const MAX_STEPS = 6;

/**
 * Bounds on the model's input. `MAX_COMMITS_PER_PULL_REQUEST` is 1000 and
 * `MAX_FILES_PER_PULL_REQUEST` is 3000 in the snapshot schema, and Haiku 4.5's context is
 * 200K — so the payload is capped here rather than discovered at bake time.
 */
export const MAX_PROMPT_COMMITS = 40;
export const MAX_PROMPT_FILES = 120;
export const MAX_PROMPT_BODY_CHARS = 4_000;
export const MAX_PROMPT_COMMIT_MESSAGE_CHARS = 300;

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
 * What the model is asked to return.
 *
 * Narrower than `enrichmentEntrySchema`, which is the snapshot contract: the bounds live
 * here so the snapshot schema stays the one shape every consumer reads. The per-field
 * descriptions are the instruction — they reach the model as the JSON schema's
 * `description` values, which is cheaper and more reliable than restating them in prose.
 */
export const modelEnrichmentSchema = z.object({
  label: z
    .string()
    .min(1)
    .max(MAX_LABEL_CHARS)
    .describe(
      'What the change was, in the words a codeowner would use — a short noun phrase such as ' +
        `"Added global site settings", at most ${MAX_LABEL_CHARS} characters. Not the pull ` +
        'request title verbatim, and never a file path.',
    ),
  approach: z
    .string()
    .min(1)
    .max(MAX_APPROACH_CHARS)
    .describe(
      'One sentence on HOW the change was built: the path taken and, where the commits or ' +
        'file layout make it visible, the path not taken. For example "wired site settings ' +
        'directly into the render config rather than through the existing settings resolver". ' +
        `Describe the method, not a restatement of what changed. At most ${MAX_APPROACH_CHARS} characters.`,
    ),
  steps: z
    .array(
      z.object({
        commitSha: z
          .string()
          .min(1)
          .describe('The SHA of the commit this step came from, copied verbatim from the commits listed in the input.'),
        summary: z
          .string()
          .min(1)
          .max(MAX_STEP_SUMMARY_CHARS)
          .describe(
            'A short phrase for what this commit did, such as "Added a DB column" — at most ' +
              `${MAX_STEP_SUMMARY_CHARS} characters, so it fits on a canvas step. Not a sentence.`,
          ),
      }),
    )
    .min(1)
    .max(MAX_STEPS)
    .describe(
      'The ordered chain of work that produced the change, earliest first. Merge, revert and ' +
        'formatting-only commits are folded into their neighbours rather than listed.',
    ),
});

export type ModelEnrichment = z.infer<typeof modelEnrichmentSchema>;

/** Tokens a call or a run consumed. Reported so a decision to escalate the model has evidence. */
export type EnrichmentUsage = { inputTokens: number; outputTokens: number };

export type EnrichmentOutcome = {
  /** Always valid against `enrichmentEntrySchema`, whether the call succeeded or not. */
  entry: EnrichmentEntry;
  failed: boolean;
  /** Present only when `failed` — the reason, for the run's output. */
  error?: string;
  usage: EnrichmentUsage;
};

export type EnrichmentFailure = { key: string; number: number; error: string };

export type EnrichSnapshotResult = {
  snapshot: Snapshot;
  enriched: number;
  reused: number;
  failed: number;
  failures: EnrichmentFailure[];
  usage: EnrichmentUsage;
};

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

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

/**
 * The model input: metadata only, bounded before the call.
 *
 * Commits and files are kept from the front — the earliest commits are what the step chain
 * is built from, and an elision note tells the model the list is partial rather than
 * letting it infer a shorter change than really happened.
 */
export function buildEnrichmentPrompt(pullRequest: PullRequestRecord): string {
  const commits = pullRequest.commits.slice(0, MAX_PROMPT_COMMITS);
  const files = pullRequest.files.slice(0, MAX_PROMPT_FILES);
  const body = (pullRequest.body ?? '').trim();

  const lines = [
    `Pull request #${pullRequest.number}: ${pullRequest.title}`,
    '',
    'Description:',
    body.length > 0 ? truncate(body, MAX_PROMPT_BODY_CHARS) : '(none)',
    '',
    `Commits, earliest first (${commits.length} of ${pullRequest.commits.length}):`,
    ...commits.map(
      (commit) => `- ${commit.sha} ${truncate(commit.message.trim().split('\n')[0], MAX_PROMPT_COMMIT_MESSAGE_CHARS)}`,
    ),
    '',
    `Changed files (${files.length} of ${pullRequest.files.length}):`,
    ...files.map((file) => `- ${file.status} ${file.path}${file.package ? ` [${file.package}]` : ''}`),
    '',
    `Packages changed directly: ${pullRequest.directPackages.join(', ') || '(none)'}`,
    `Packages reached through the dependency graph: ${
      pullRequest.indirectPackages.map((reach) => `${reach.package} via ${reach.through}`).join(', ') || '(none)'
    }`,
  ];

  if (commits.length < pullRequest.commits.length || files.length < pullRequest.files.length) {
    lines.push('', 'Note: the lists above were truncated — describe the change from what is shown.');
  }

  return lines.join('\n');
}

const SYSTEM_PROMPT =
  'You summarise a merged pull request for a codeowner reading a dependency canvas. ' +
  'You are given metadata only — no patches — so describe what the commit messages and ' +
  'file layout actually show and never invent a detail you cannot see.';

/**
 * Characters of a SHA that must agree before two are taken to be the same commit. Seven is
 * git's own canonical short form, so a model abbreviating the way git does still resolves.
 */
const SHA_PREFIX_CHARS = 7;

/**
 * Binds each step to a commit the pull request really contains.
 *
 * Two transcription slips are tolerated, because both were seen in the real bake and
 * neither is the model inventing a commit:
 *
 * - an **abbreviated** SHA (`9fd41fd4` for the full forty characters), and
 * - a SHA whose **tail is mistyped** — shadcn-ui/ui#11861 came back 37 characters long,
 *   trpc/trpc#7375 39, each having dropped a character mid-copy.
 *
 * So the leading prefix decides, and it must identify exactly one of this pull request's
 * commits. Seven hex characters is 268 million to one against a coincidence within one
 * pull request's handful of commits, which is why a genuinely invented SHA still fails
 * here — and a step that resolves to nothing rejects the whole record rather than storing
 * an unlinkable step.
 */
function resolveSteps(steps: ModelEnrichment['steps'], pullRequest: PullRequestRecord): EnrichmentEntry['steps'] {
  const shas = pullRequest.commits.map((commit) => commit.sha);
  return steps.map((step) => {
    const given = step.commitSha.trim().toLowerCase();
    const exact = shas.find((sha) => sha.toLowerCase() === given);
    if (exact) return { commitSha: exact, summary: step.summary };

    const prefix = given.slice(0, SHA_PREFIX_CHARS);
    const matched = prefix.length >= SHA_PREFIX_CHARS ? shas.filter((sha) => sha.toLowerCase().startsWith(prefix)) : [];
    if (matched.length === 1) return { commitSha: matched[0], summary: step.summary };

    throw new Error(
      `step names commit "${step.commitSha}", which pull request #${pullRequest.number} does not contain`,
    );
  });
}

export type EnrichPullRequestOptions = {
  /** Already configured by the caller — this module never reads a credential. */
  model: LanguageModel;
  pullRequest: PullRequestRecord;
  /** Retries the AI SDK may make for a retryable provider error. */
  maxRetries?: number;
  abortSignal?: AbortSignal;
};

/**
 * One model call for one pull request. Never throws: a failure becomes a degraded entry
 * plus an error string, because a blank canvas node is the failure mode this prevents.
 */
export async function enrichPullRequest(options: EnrichPullRequestOptions): Promise<EnrichmentOutcome> {
  const { model, pullRequest } = options;
  let usage: EnrichmentUsage = { inputTokens: 0, outputTokens: 0 };

  // Every step must name a commit the pull request contains, so a pull request GitHub
  // reports no commits for cannot produce a valid chain however good the model is. Seen
  // in the real bake (trpc/trpc#7592). Skip the call rather than paying for a rejection.
  if (pullRequest.commits.length === 0) {
    return {
      entry: fallbackEnrichment(pullRequest),
      failed: true,
      error: `pull request #${pullRequest.number} has no commits, so no step chain can be derived`,
      usage,
    };
  }

  try {
    const result = await generateObject({
      model,
      schema: modelEnrichmentSchema,
      schemaName: 'pull_request_enrichment',
      schemaDescription: 'What a merged pull request changed, how it was built, and the commits that produced it.',
      system: SYSTEM_PROMPT,
      prompt: buildEnrichmentPrompt(pullRequest),
      maxRetries: options.maxRetries ?? 2,
      ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
    });

    usage = { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0 };

    // Parsed again through the snapshot's own schema: the value written into a snapshot
    // validates against the merged contract, not just against the model-output schema.
    const entry = enrichmentEntrySchema.parse({
      label: result.object.label.trim(),
      approach: result.object.approach.trim(),
      steps: resolveSteps(result.object.steps, pullRequest),
    });

    return { entry, failed: false, usage };
  } catch (error) {
    return {
      entry: fallbackEnrichment(pullRequest),
      failed: true,
      error: error instanceof Error ? error.message : String(error),
      usage,
    };
  }
}

/** Runs `task` over `items` with at most `limit` in flight, preserving input order. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export type EnrichSnapshotOptions = {
  snapshot: Snapshot;
  model: LanguageModel;
  /** Pull requests in flight at once. Defaults to `DEFAULT_ENRICHMENT_CONCURRENCY`. */
  concurrency?: number;
  maxRetries?: number;
  abortSignal?: AbortSignal;
  /** Called once per pull request as it resolves, for a CLI's progress output. */
  onProgress?: (progress: { done: number; total: number; key: string; failed: boolean }) => void;
};

/**
 * Enriches every pull request in a snapshot and returns a new snapshot carrying the
 * result. A pull request the snapshot already has a *successful* entry for costs no model
 * call; a stored fallback is retried.
 *
 * The returned `enrichment` covers exactly this snapshot's pull requests: it is built with
 * `buildRecord`, which rejects reserved keys and duplicates before parsing — `z.record`
 * silently drops `__proto__` rather than rejecting it (measured on zod 4.6.5), so the
 * schema cannot do this job.
 */
export async function enrichSnapshot(options: EnrichSnapshotOptions): Promise<EnrichSnapshotResult> {
  const { snapshot, model } = options;
  const stored = snapshot.enrichment ?? {};
  const total = snapshot.pullRequests.length;

  let enriched = 0;
  let reused = 0;
  let done = 0;
  const failures: EnrichmentFailure[] = [];
  const usage: EnrichmentUsage = { inputTokens: 0, outputTokens: 0 };

  const entries = await mapWithConcurrency(
    snapshot.pullRequests,
    options.concurrency ?? DEFAULT_ENRICHMENT_CONCURRENCY,
    async (pullRequest): Promise<readonly [string, EnrichmentEntry]> => {
      const key = enrichmentKey(pullRequest);
      const existing = Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] : undefined;

      // A degraded record is a failure receipt, not a result, so it is never a cache hit —
      // a re-bake retries it rather than freezing the failure into every later snapshot.
      if (existing && !isFallbackEnrichment(existing)) {
        reused += 1;
        done += 1;
        options.onProgress?.({ done, total, key, failed: false });
        return [key, existing];
      }

      const outcome = await enrichPullRequest({
        model,
        pullRequest,
        ...(options.maxRetries === undefined ? {} : { maxRetries: options.maxRetries }),
        ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
      });

      usage.inputTokens += outcome.usage.inputTokens;
      usage.outputTokens += outcome.usage.outputTokens;

      if (outcome.failed) {
        failures.push({ key, number: pullRequest.number, error: outcome.error ?? 'unknown error' });
      } else {
        enriched += 1;
      }

      done += 1;
      options.onProgress?.({ done, total, key, failed: outcome.failed });
      return [key, outcome.entry];
    },
  );

  return {
    snapshot: { ...snapshot, enrichment: buildRecord(entries, 'enrichment key') },
    enriched,
    reused,
    failed: failures.length,
    failures,
    usage,
  };
}
