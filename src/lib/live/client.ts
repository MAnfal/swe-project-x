import { fallbackEnrichment } from '../ai/enrichment-record.ts';
import { enrichmentEntrySchema, type EnrichmentEntry, type PullRequestRecord } from '../snapshot.ts';
import {
  classifyFailure,
  decodeEvents,
  type AnalysisEvent,
  type FailureKind,
  type TerminalEvent,
} from './protocol.ts';

/**
 * The browser half of the wire contract: ask the routes, hand the caller typed events.
 *
 * Nothing here reads a credential or talks to GitHub or Anthropic — both routes do that
 * on the server (Principle 1). `fetch` is a parameter so a spec can drive a real
 * `ReadableStream` through the decoder rather than stubbing the decoder itself.
 */

export const ANALYSIS_PATH = '/api/analysis';
export const ENRICHMENT_PATH = '/api/enrichment';

function failed(kind: FailureKind, message: string, detail?: string): TerminalEvent {
  return { type: 'failed', kind, message, step: 'resolve', ...(detail ? { detail } : {}) };
}

/**
 * Runs one analysis, reporting every event as it arrives and resolving with the terminal
 * one. It never rejects: a transport failure is an `AnalysisEvent` like any other, so the
 * caller has exactly one shape to render.
 *
 * Aborting `signal` ends the request. There is nothing to resume afterwards — the work
 * happened inside that request, and `cancel()` on the response body is what tells the
 * server to stop paying for it.
 */
export async function requestAnalysis(options: {
  url: string;
  onEvent: (event: AnalysisEvent) => void;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}): Promise<TerminalEvent> {
  const call = options.fetch ?? globalThis.fetch;
  let terminal: TerminalEvent | null = null;

  try {
    const response = await call(ANALYSIS_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: options.url }),
      ...(options.signal ? { signal: options.signal } : {}),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { kind?: FailureKind; message?: string };
      const event = failed(
        body.kind ?? 'failed',
        body.message ?? `The analysis request was rejected (${response.status}).`,
      );
      options.onEvent(event);
      return event;
    }

    const body = response.body;
    if (body === null) return failed('failed', 'The analysis response carried no body.');

    const decoder = new TextDecoder();
    const reader = body.getReader();
    let rest = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      const decoded = decodeEvents(decoder.decode(value, { stream: true }), rest);
      rest = decoded.rest;
      for (const event of decoded.events) {
        if (event.type !== 'progress') terminal = event;
        options.onEvent(event);
      }
    }
  } catch (error) {
    const failure = classifyFailure(error, 'resolve');
    const event: TerminalEvent = { type: 'failed', ...failure };
    options.onEvent(event);
    return event;
  }

  // A stream that stops without a terminal event is a dropped connection or a crashed
  // function; either way the analysis did not finish, and saying so is the honest answer.
  if (terminal === null) {
    const event = failed('failed', 'The analysis ended before it finished. Retrying starts it over.');
    options.onEvent(event);
    return event;
  }
  return terminal;
}

export type EnrichmentResult = {
  entry: EnrichmentEntry;
  /** True when the record is the pull request's own title rather than a model result. */
  fallback: boolean;
  /** True when the server answered from its cache without a model call. */
  cached: boolean;
};

/**
 * Enriches one pull request on demand.
 *
 * Never throws and never returns a blank node: any failure degrades to chunk 03's
 * `fallbackEnrichment`, the same record a failed bake writes, so a change card reads
 * identically whichever path produced it.
 */
export async function requestEnrichment(options: {
  repository: { owner: string; name: string };
  pullRequest: PullRequestRecord;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}): Promise<EnrichmentResult> {
  const call = options.fetch ?? globalThis.fetch;

  try {
    const response = await call(ENRICHMENT_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repository: options.repository, pullRequest: options.pullRequest }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    if (!response.ok) throw new Error(`enrichment request failed with ${response.status}`);

    const body = (await response.json()) as { entry?: unknown; cached?: boolean; fallback?: boolean };
    // Parsed through the snapshot's own schema: what the canvas renders is the one
    // validated shape, whatever the wire carried (Principle 5).
    const entry = enrichmentEntrySchema.parse(body.entry);
    return { entry, fallback: body.fallback === true, cached: body.cached === true };
  } catch {
    return { entry: fallbackEnrichment(options.pullRequest), fallback: true, cached: false };
  }
}
