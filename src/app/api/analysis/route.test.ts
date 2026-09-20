import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST } from '@/app/api/analysis/route';
import { decodeEvents } from '@/lib/live/protocol';

/**
 * The analysis route's guards — everything it does *before* it opens a socket.
 *
 * No test here reaches GitHub: each one is an input the handler must reject or a
 * configuration it must refuse, and all of them return before the client is built. The
 * pipeline behind the guards is covered by `src/lib/ingest/ingest.test.ts`, which drives
 * a real Octokit from the committed transcript.
 */

function post(body: unknown, signal?: AbortSignal): Request {
  return new Request('http://localhost/api/analysis', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
}

/** Restored after every test — `process.env` is shared with the whole run. */
const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.GITHUB_TOKEN;
  delete process.env.GRAIN_ANALYSIS_WINDOW_DAYS;
  delete process.env.GRAIN_MAX_PULL_REQUESTS;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('POST /api/analysis', () => {
  it('declares the Node.js runtime and an explicit duration ceiling', async () => {
    const route = await import('@/app/api/analysis/route');
    // Asserted as values because that is what the framework reads — a grep over the
    // source would also match the comment explaining why they are here.
    expect(route.runtime).toBe('nodejs');
    expect(route.maxDuration).toBe(300);
  });

  const rejected: [string, unknown, RegExp][] = [
    ['a blank URL', { url: '' }, /owner and a repo/i],
    ['a missing URL', {}, /owner and a repo/i],
    ['a URL that is not a string', { url: 42 }, /owner and a repo/i],
    ['a non-GitHub host', { url: 'https://gitlab.com/acme/monorepo' }, /only analyzes repositories on github\.com/i],
    ['a path inside a repository', { url: 'github.com/acme/monorepo/pull/1' }, /inside a repository/i],
    ['a traversal segment', { url: 'github.com/acme/..' }, /repository name/i],
    ['a reserved repository name', { url: 'github.com/acme/__proto__' }, /reserved/i],
  ];

  it.each(rejected)('rejects %s with 400 before reading any credential', async (_label, body, message) => {
    // No token is set, so a handler that validated *after* reading the credential would
    // answer 500 here instead — which is what pins the ordering.
    const response = await POST(post(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ kind: 'invalid-url', message: expect.stringMatching(message) });
  });

  it('rejects a body that is not JSON at all', async () => {
    const response = await POST(post('not json'));
    expect(response.status).toBe(400);
    expect((await response.json()).kind).toBe('invalid-url');
  });

  it('answers 500 with a readable reason when no GitHub token is configured', async () => {
    const response = await POST(post({ url: 'github.com/xyflow/xyflow' }));
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.kind).toBe('failed');
    expect(body.message).toMatch(/no GitHub token/i);
  });

  it('answers 500 rather than silently defaulting when a bound is misconfigured', async () => {
    process.env.GITHUB_TOKEN = 'not-a-real-token';
    process.env.GRAIN_MAX_PULL_REQUESTS = 'all of them';

    const response = await POST(post({ url: 'github.com/xyflow/xyflow' }));
    expect(response.status).toBe(500);
    expect((await response.json()).message).toMatch(/bounds are misconfigured/i);
  });

  it('never echoes the configured token in a rejection', async () => {
    process.env.GITHUB_TOKEN = 'ghp_thisMustNeverAppear';
    process.env.GRAIN_ANALYSIS_WINDOW_DAYS = '-1';

    const response = await POST(post({ url: 'github.com/xyflow/xyflow' }));
    expect(await response.text()).not.toContain('ghp_thisMustNeverAppear');
  });

  it('streams NDJSON rather than buffering a single JSON document', async () => {
    process.env.GITHUB_TOKEN = 'not-a-real-token';

    // A caller whose connection is already gone. Measured on Node 24.13.0: an
    // already-aborted signal never dispatches `abort` to a listener added afterwards, so
    // the handler checks `signal.aborted` outright — and `fetch` with that signal rejects
    // with `AbortError` before opening a socket, which is what keeps this spec off the
    // network while still exercising the real stream.
    const response = await POST(post({ url: 'github.com/xyflow/xyflow' }, AbortSignal.abort()));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/application\/x-ndjson/);
    expect(response.headers.get('cache-control')).toMatch(/no-store/);

    // The body is whole lines, each one a decodable event, ending on a terminal one.
    const { events, rest } = decodeEvents(await response.text(), '');
    expect(rest).toBe('');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'failed', kind: 'cancelled', step: 'resolve' });
  });

  it('stops before the first GitHub request when the caller has already disconnected', async () => {
    process.env.GITHUB_TOKEN = 'not-a-real-token';
    const response = await POST(post({ url: 'github.com/xyflow/xyflow' }, AbortSignal.abort()));
    const { events } = decodeEvents(await response.text(), '');

    // No `resolve` progress report means the default-branch lookup never completed, so
    // nothing downstream of it ran either.
    expect(events.filter((event) => event.type === 'progress')).toEqual([]);
  });
});
