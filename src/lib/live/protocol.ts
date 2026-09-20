import type { PullRequestBound } from '../ingest/ingest.ts';
import type { Snapshot } from '../snapshot.ts';

/**
 * The wire contract between the analysis route and the browser: what a step is, what a
 * progress report carries, how events are framed, and how a thrown error becomes
 * something the error surface can render.
 *
 * Both sides import this one module, so the shapes cannot drift. It has **no runtime
 * imports** — the types above are erased — which is what lets a client component import it
 * without dragging Octokit, the AI SDK or zod onto a component path (Principle 2).
 */

export type AnalysisStep = 'resolve' | 'topology' | 'pull-requests' | 'details' | 'attribute';

/**
 * The five steps design page 3 draws, in the order the pipeline runs them.
 *
 * Page 3's fifth step is "Summarizing how each change was built". A live analysis does not
 * summarize — enrichment is deferred to expansion, which is what keeps the request inside
 * one serverless invocation — so the fifth step here is the attribution the pipeline
 * really ends on. The design's layout is followed; its copy is not.
 */
export const ANALYSIS_STEPS: readonly { id: AnalysisStep; label: string }[] = [
  { id: 'resolve', label: 'Resolved repository' },
  { id: 'topology', label: 'Read the dependency graph' },
  { id: 'pull-requests', label: 'Fetching pull requests' },
  { id: 'details', label: 'Reading files and commits' },
  { id: 'attribute', label: 'Attributing changes to packages' },
];

/**
 * One progress report. `done`/`total` are within the step, so the view can draw a bar for
 * the counted steps and a tick for the rest.
 *
 * The extra fields are typed values, not sentences: every word the reader sees is composed
 * in the component, so no copy lives in `src/lib/`.
 */
export type AnalysisProgress = {
  step: AnalysisStep;
  done: number;
  /** Null when the step is a single action with nothing to count. */
  total: number | null;
  /** `resolve`: the branch the analysis ran against. */
  branch?: string;
  /** `topology`: what the dependency graph came out as. */
  packageCount?: number;
  edgeCount?: number;
  /** `pull-requests`: how many the window really held, before the ceiling applied. */
  matched?: number;
  truncated?: boolean;
  /** `details`: the pull request just read, for the design's "just read" list. */
  read?: { number: number; title: string; packages: string[] };
};

/**
 * Why an analysis stopped. `cancelled` is the client's own abort coming back — the surface
 * says nothing about it, because the person who cancelled already knows.
 */
export type FailureKind = 'invalid-url' | 'not-found' | 'rate-limit' | 'cancelled' | 'failed';

export type AnalysisFailure = {
  kind: FailureKind;
  /** One sentence for the error surface. Never contains a credential or a token. */
  message: string;
  step: AnalysisStep;
  /** The raw upstream line, shown in the monospace block on design page 8. */
  detail?: string;
  /** ISO 8601, when GitHub told us when the quota comes back. */
  resetAt?: string;
};

export type AnalysisEvent =
  | { type: 'progress'; progress: AnalysisProgress }
  | { type: 'complete'; snapshot: Snapshot; bound: PullRequestBound; repository: string; branch: string }
  | ({ type: 'failed' } & AnalysisFailure);

/**
 * The events an analysis can end on. Exactly one of them arrives, and a stream that ends
 * without one did not finish — which is itself reported as a `failed`.
 */
export type TerminalEvent = Extract<AnalysisEvent, { type: 'complete' } | { type: 'failed' }>;

/** One event, one line. `JSON.stringify` escapes any newline inside the payload. */
export function encodeEvent(event: AnalysisEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/**
 * Splits a chunk of the response body into whole events, returning whatever tail has not
 * had its newline yet. The caller threads `rest` back in on the next chunk — a stream
 * chunk boundary lands mid-line routinely, and a decoder that does not buffer drops the
 * event it lands in.
 */
export function decodeEvents(chunk: string, rest: string): { events: AnalysisEvent[]; rest: string } {
  const buffered = rest + chunk;
  const lines = buffered.split('\n');
  const tail = lines.pop() ?? '';

  return {
    events: lines.flatMap((line) => (line.trim().length === 0 ? [] : [JSON.parse(line) as AnalysisEvent])),
    rest: tail,
  };
}

function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const status = (error as { status: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

function headersOf(error: unknown): Record<string, string> {
  if (typeof error !== 'object' || error === null || !('response' in error)) return {};
  const response = (error as { response: unknown }).response;
  if (typeof response !== 'object' || response === null || !('headers' in response)) return {};
  const headers = (response as { headers: unknown }).headers;
  return typeof headers === 'object' && headers !== null ? (headers as Record<string, string>) : {};
}

function resetAtFrom(headers: Record<string, string>): string | undefined {
  const reset = Number(headers['x-ratelimit-reset']);
  return Number.isFinite(reset) && reset > 0 ? new Date(reset * 1_000).toISOString() : undefined;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

/**
 * Turns whatever the pipeline threw into something the error surface can render.
 *
 * No message here says work was kept or can be resumed: analysis happens inside the
 * request that asked for it, and a retry starts over (SPEC clarification, 2026-09-20).
 * Design page 8's "42 of 100 were already fetched and are kept" is copy from before that
 * was settled.
 */
export function classifyFailure(error: unknown, step: AnalysisStep): AnalysisFailure {
  if (isAbort(error)) {
    return { kind: 'cancelled', step, message: 'Analysis was cancelled.' };
  }

  const raw = error instanceof Error ? error.message : String(error);
  const status = statusOf(error);
  const headers = headersOf(error);
  const detail = status === undefined ? raw : `${status} · ${raw}`;

  if (status === 404) {
    return {
      kind: 'not-found',
      step,
      message: "Grain can't see that repository. It may be private, renamed, or misspelled.",
      detail,
    };
  }

  const quotaSpent = headers['x-ratelimit-remaining'] === '0';
  const secondary = /rate limit/i.test(raw);
  if (status === 429 || (status === 403 && (quotaSpent || secondary))) {
    const resetAt = resetAtFrom(headers);
    return {
      kind: 'rate-limit',
      step,
      message: "GitHub's rate limit is spent, so Grain stopped reading this repository.",
      detail,
      ...(resetAt ? { resetAt } : {}),
    };
  }

  if (status === 401) {
    return {
      kind: 'failed',
      step,
      // Names no environment variable. This module is imported by client components, so
      // every string in it ships in the browser bundle, and the deploy gate asserts that
      // neither credential's *name* appears there — copy that spells one out fails it.
      message: "GitHub rejected Grain's token. The server's credential needs attention.",
      detail,
    };
  }

  return {
    kind: 'failed',
    step,
    message: 'Analysis stopped before it finished. Nothing was written to your repository.',
    detail,
  };
}
