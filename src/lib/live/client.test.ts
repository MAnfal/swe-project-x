import { describe, expect, it } from 'vitest';

import { FALLBACK_APPROACH, isFallbackEnrichment } from '@/lib/ai/enrichment-record';
import { requestAnalysis, requestEnrichment } from '@/lib/live/client';
import { encodeEvent, type AnalysisEvent } from '@/lib/live/protocol';
import type { PullRequestRecord } from '@/lib/snapshot';

/**
 * The browser half of the wire contract, driven by a stub `fetch` rather than a mock of
 * itself: every assertion is on the value a caller receives back.
 */

const COMMIT = 'aaaaaaaabbbbbbbbccccccccddddddddeeeeeeee';

function pullRequest(): PullRequestRecord {
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
  };
}

/** A `fetch` returning `chunks` as the body, so a mid-line split is exercised for real. */
function streamingFetch(chunks: string[], init: ResponseInit = {}): typeof fetch {
  return (async () => {
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
          controller.close();
        },
      }),
      { status: 200, ...init },
    );
  }) as unknown as typeof fetch;
}

function jsonFetch(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

const progress: AnalysisEvent = {
  type: 'progress',
  progress: { step: 'details', done: 2, total: 6 },
};

const complete: AnalysisEvent = {
  type: 'complete',
  repository: 'xyflow/xyflow',
  branch: 'main',
  bound: { maxPullRequests: 100, matched: 6, kept: 6, truncated: false },
  snapshot: {
    metadata: {
      repository: { owner: 'xyflow', name: 'xyflow' },
      window: { since: '2026-08-31T00:00:00Z', until: '2026-09-02T00:00:00Z' },
      analyzedAt: '2026-09-20T00:00:00.000Z',
      packageCount: 0,
      pullRequestCount: 0,
    },
    packages: { nodes: [], edges: [] },
    pullRequests: [],
  },
};

describe('requestAnalysis', () => {
  it('delivers every event in order and returns the terminal one', async () => {
    const seen: AnalysisEvent[] = [];
    const terminal = await requestAnalysis({
      url: 'github.com/xyflow/xyflow',
      fetch: streamingFetch([encodeEvent(progress), encodeEvent(complete)]),
      onEvent: (event) => seen.push(event),
    });

    expect(seen).toEqual([progress, complete]);
    expect(terminal).toEqual(complete);
  });

  it('reassembles an event split across two body chunks', async () => {
    const wire = encodeEvent(progress) + encodeEvent(complete);
    const split = Math.floor(wire.length / 2);

    const seen: AnalysisEvent[] = [];
    await requestAnalysis({
      url: 'github.com/xyflow/xyflow',
      fetch: streamingFetch([wire.slice(0, split), wire.slice(split)]),
      onEvent: (event) => seen.push(event),
    });

    expect(seen).toEqual([progress, complete]);
  });

  it('turns a rejected request into a failure the error surface can render', async () => {
    const terminal = await requestAnalysis({
      url: 'nope',
      fetch: jsonFetch({ kind: 'invalid-url', message: 'That is not a repository URL.' }, 400),
      onEvent: () => {},
    });

    expect(terminal).toMatchObject({ type: 'failed', kind: 'invalid-url' });
    expect(terminal.type === 'failed' && terminal.message).toBe('That is not a repository URL.');
  });

  it('still reports a rejection whose body is not the shape it promised', async () => {
    const terminal = await requestAnalysis({
      url: 'nope',
      fetch: (async () => new Response('<html>gateway error</html>', { status: 502 })) as unknown as typeof fetch,
      onEvent: () => {},
    });
    expect(terminal).toMatchObject({ type: 'failed', kind: 'failed' });
    expect(terminal.type === 'failed' && terminal.message).toContain('502');
  });

  it('reports a 200 with no body rather than hanging on a reader it cannot make', async () => {
    const terminal = await requestAnalysis({
      url: 'github.com/xyflow/xyflow',
      fetch: (async () => new Response(null, { status: 200 })) as unknown as typeof fetch,
      onEvent: () => {},
    });
    expect(terminal).toMatchObject({ type: 'failed', kind: 'failed' });
  });

  it('turns a stream that ends without a terminal event into a failure', async () => {
    const terminal = await requestAnalysis({
      url: 'github.com/xyflow/xyflow',
      fetch: streamingFetch([encodeEvent(progress)]),
      onEvent: () => {},
    });
    expect(terminal).toMatchObject({ type: 'failed', kind: 'failed' });
  });

  it('turns a transport error into a failure rather than throwing at the caller', async () => {
    const terminal = await requestAnalysis({
      url: 'github.com/xyflow/xyflow',
      fetch: (async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
      onEvent: () => {},
    });
    expect(terminal).toMatchObject({ type: 'failed', kind: 'failed' });
  });

  it('reports an abort as cancelled, not as a failure to show the reader', async () => {
    const terminal = await requestAnalysis({
      url: 'github.com/xyflow/xyflow',
      fetch: (async () => {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }) as unknown as typeof fetch,
      onEvent: () => {},
    });
    expect(terminal).toMatchObject({ type: 'failed', kind: 'cancelled' });
  });

  it('never surfaces a partial event, so a truncated stream cannot render half a snapshot', async () => {
    const wire = encodeEvent(complete);
    const seen: AnalysisEvent[] = [];
    await requestAnalysis({
      url: 'github.com/xyflow/xyflow',
      fetch: streamingFetch([wire.slice(0, wire.length - 5)]),
      onEvent: (event) => seen.push(event),
    });
    // The truncated `complete` line is dropped, not half-parsed — so the only event the
    // caller sees is the synthesized failure, and no snapshot reaches the canvas.
    expect(seen.map((event) => event.type)).toEqual(['failed']);
  });
});

describe('requestEnrichment', () => {
  const repository = { owner: 'xyflow', name: 'xyflow' };

  it('returns the record the route produced', async () => {
    const entry = { label: 'Added site settings', approach: 'Threaded them in.', steps: [] as unknown[] };
    const result = await requestEnrichment({
      repository,
      pullRequest: pullRequest(),
      fetch: jsonFetch({
        key: 'xyflow/xyflow#abc',
        entry: { ...entry, steps: [{ commitSha: COMMIT, summary: 'added' }] },
        cached: false,
        fallback: false,
      }),
    });

    expect(result.entry.label).toBe('Added site settings');
    expect(result.entry.steps[0].commitSha).toBe(COMMIT);
    expect(result.fallback).toBe(false);
  });

  it('falls back to the pull request title when the route is unreachable', async () => {
    const record = pullRequest();
    const result = await requestEnrichment({
      repository,
      pullRequest: record,
      fetch: (async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
    });

    expect(result.fallback).toBe(true);
    expect(isFallbackEnrichment(result.entry)).toBe(true);
    expect(result.entry.label).toBe(record.title);
    expect(result.entry.approach).toBe(FALLBACK_APPROACH);
  });

  it('falls back when the route answers with an error status, never with a blank node', async () => {
    const record = pullRequest();
    const result = await requestEnrichment({
      repository,
      pullRequest: record,
      fetch: jsonFetch({ message: 'no key configured' }, 500),
    });

    expect(result.fallback).toBe(true);
    expect(result.entry.label).toBe(record.title);
  });

  it('falls back when the route answers with a body the schema rejects', async () => {
    const record = pullRequest();
    const result = await requestEnrichment({
      repository,
      pullRequest: record,
      fetch: jsonFetch({ key: 'k', entry: { label: '', approach: '', steps: [] }, cached: false }),
    });

    expect(result.fallback).toBe(true);
    expect(result.entry.label).toBe(record.title);
  });
});
