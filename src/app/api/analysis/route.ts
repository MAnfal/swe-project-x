import { createGitHubClient } from '@/lib/ingest/github';
import { analyzeRepository } from '@/lib/ingest/ingest';
import {
  classifyFailure,
  encodeEvent,
  type AnalysisEvent,
  type AnalysisStep,
} from '@/lib/live/protocol';
import { parseRepositoryUrl, resolveAnalysisBounds } from '@/lib/live/request';

/**
 * Analyzes a repository the caller named, streaming progress as it goes.
 *
 * A thin orchestrator (`bibles/swe/patterns/orchestrator-pattern.md`): it validates the
 * boundary, reads the credential, resolves the bounds, wires an abort signal, and
 * sequences `src/lib/` functions. Every rule about *what* an analysis is — the window, the
 * ceiling, the ordering, the attribution — lives in `src/lib/ingest/`, and this file would
 * not change if any of them did.
 *
 * Three decisions this file makes and nothing else can:
 *
 *  - **Node.js runtime.** Octokit does not run on the Edge runtime.
 *  - **300 second ceiling**, the most the deployment target's free tier allows
 *    (https://vercel.com/docs/functions/configuring-functions/duration, read 2026-09-20).
 *    The work is bounded to fit well inside it by the pull-request ceiling, not by this.
 *  - **Nothing outlives the request.** There is no job, no queue and no store: if the
 *    caller disconnects, `cancel` aborts the in-flight GitHub requests and the work is
 *    gone. A retry starts over.
 */

export const runtime = 'nodejs';
export const maxDuration = 300;

function reject(kind: 'invalid-url' | 'failed', message: string, status: number): Response {
  return Response.json({ kind, message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { url?: unknown };
  const submitted = typeof body.url === 'string' ? body.url : '';

  const parsed = parseRepositoryUrl(submitted);
  if (!parsed.ok) return reject('invalid-url', parsed.message, 400);
  const ref = parsed.ref;

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return reject('failed', 'Grain has no GitHub token configured, so it cannot read any repository.', 500);
  }

  let bounds;
  try {
    bounds = resolveAnalysisBounds({ now: new Date(), env: process.env });
  } catch (error) {
    console.error('[Analysis] bounds are misconfigured:', error);
    return reject('failed', "Grain's analysis bounds are misconfigured on the server.", 500);
  }

  // One controller for the whole analysis. `request.signal` covers a dropped connection;
  // `cancel` covers a reader that walks away from a stream still being written.
  const abort = new AbortController();
  // A signal that aborted before the handler ran dispatched its event already, so the
  // listener below would never fire and the analysis would be paid for in full on behalf
  // of a caller that is gone. Measured on Node 24.13.0: `addEventListener('abort', …)` on
  // an already-aborted signal is never called, while `fetch` with one rejects
  // immediately with `AbortError` and opens no socket.
  if (request.signal.aborted) abort.abort();
  request.signal.addEventListener('abort', () => abort.abort(), { once: true });
  const client = createGitHubClient({ token, signal: abort.signal });

  const label = `${ref.owner}/${ref.repo}`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // `step` is the only state this handler keeps, and it exists so a failure can say
      // where it stopped. The pipeline owns everything else.
      let step: AnalysisStep = 'resolve';
      const send = (event: AnalysisEvent) => controller.enqueue(encoder.encode(encodeEvent(event)));

      console.log(`[Analysis] ${label} ${bounds.since}..${bounds.until} max ${bounds.maxPullRequests}`);
      try {
        const result = await analyzeRepository(client, {
          repository: ref,
          since: bounds.since,
          until: bounds.until,
          maxPullRequests: bounds.maxPullRequests,
          analyzedAt: new Date().toISOString(),
          onProgress: (progress) => {
            step = progress.step;
            send({ type: 'progress', progress });
          },
        });

        console.log(
          `[Analysis] ${label} complete: ${result.bound.kept} of ${result.bound.matched} pull requests`,
        );
        send({
          type: 'complete',
          snapshot: result.snapshot,
          bound: result.bound,
          repository: label,
          branch: result.branch,
        });
      } catch (error) {
        const failure = classifyFailure(error, step);
        console.error(`[Analysis] ${label} stopped at ${failure.step} (${failure.kind}):`, failure.detail);
        send({ type: 'failed', ...failure });
      }

      controller.close();
    },
    cancel() {
      console.log(`[Analysis] ${label} cancelled by the caller — stopping`);
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      // Tells a buffering proxy to pass chunks through; without it the progress the
      // pipeline reports arrives all at once at the end, which is the spinner this
      // whole mechanism exists to avoid.
      'x-accel-buffering': 'no',
    },
  });
}
