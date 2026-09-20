import { describe, expect, it } from 'vitest';

import { recordingFetch, replayFetch, sampleTranscript, type TranscriptEntry } from '@/lib/ingest/transcript';

const entry = (url: string, body: unknown, headers: Record<string, string> = {}): TranscriptEntry => ({
  method: 'GET',
  url,
  status: 200,
  headers: { 'content-type': 'application/json', ...headers },
  json: body,
});

describe('replayFetch', () => {
  it('serves a recorded response for a recorded request', async () => {
    const f = replayFetch({ entries: [entry('https://api.github.com/x', { a: 1 })] });
    const response = await f('https://api.github.com/x');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ a: 1 });
  });

  it('serves the same recorded response twice, so a replayed run is repeatable', async () => {
    const f = replayFetch({ entries: [entry('https://api.github.com/x', { a: 1 })] });
    expect(await (await f('https://api.github.com/x')).text()).toBe(
      await (await f('https://api.github.com/x')).text(),
    );
  });

  it('preserves the headers that drive pagination', async () => {
    const f = replayFetch({ entries: [entry('https://api.github.com/x', [], { link: '<https://n>; rel="next"' })] });
    expect((await f('https://api.github.com/x')).headers.get('link')).toBe('<https://n>; rel="next"');
  });

  it('throws naming the request when the transcript has no entry for it', async () => {
    const f = replayFetch({ entries: [] });
    await expect(f('https://api.github.com/missing')).rejects.toThrow(/missing/);
  });
});

describe('recordingFetch', () => {
  it('returns the upstream body unchanged and appends it to the sink', async () => {
    const upstream = async () => new Response('{"a":1}', { status: 200, headers: { 'content-type': 'application/json' } });
    const sink: TranscriptEntry[] = [];
    const f = recordingFetch(upstream as unknown as typeof fetch, sink);

    const response = await f('https://api.github.com/x');
    expect(await response.json()).toEqual({ a: 1 });
    expect(sink).toHaveLength(1);
    expect(sink[0].url).toBe('https://api.github.com/x');
    expect(sink[0].json).toEqual({ a: 1 });
  });

  it('never records a request header, so a token cannot reach the transcript', async () => {
    const upstream = async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    const sink: TranscriptEntry[] = [];
    const f = recordingFetch(upstream as unknown as typeof fetch, sink);
    await f('https://api.github.com/x', { headers: { authorization: 'Bearer SUPER_SECRET' } });
    expect(JSON.stringify(sink)).not.toContain('SUPER_SECRET');
    expect(JSON.stringify(sink)).not.toContain('authorization');
  });

  it('round-trips through replay: what was recorded is what is served', async () => {
    const upstream = async () => new Response('{"a":1}', { status: 200, headers: { 'content-type': 'application/json' } });
    const sink: TranscriptEntry[] = [];
    await recordingFetch(upstream as unknown as typeof fetch, sink)('https://api.github.com/x');
    const replayed = await replayFetch({ entries: sink })('https://api.github.com/x');
    expect(await replayed.json()).toEqual({ a: 1 });
  });
});

describe('sampleTranscript', () => {
  const listEntry = (url: string, numbers: number[]): TranscriptEntry =>
    entry(url, numbers.map((n) => ({ number: n, node_id: `n${n}` })), { link: '<https://next>; rel="next"' });

  it('keeps every pull request the run matched, whatever page it was on', () => {
    const trimmed = sampleTranscript(
      { entries: [listEntry('https://api.github.com/repos/o/r/pulls?page=1', [1, 2, 3, 4, 5])] },
      { keep: new Set([2, 5]), sample: 0 },
    );
    expect((trimmed.entries[0].json as { number: number }[]).map((p) => p.number)).toEqual([2, 5]);
  });

  it('keeps a sample of the others so the page still looks like a page', () => {
    const trimmed = sampleTranscript(
      { entries: [listEntry('https://api.github.com/repos/o/r/pulls?page=1', [1, 2, 3, 4, 5])] },
      { keep: new Set([5]), sample: 2 },
    );
    expect((trimmed.entries[0].json as { number: number }[]).map((p) => p.number)).toEqual([1, 2, 5]);
  });

  it('leaves the retained objects byte-identical, incidental fields and all', () => {
    const trimmed = sampleTranscript(
      { entries: [listEntry('https://api.github.com/repos/o/r/pulls?page=1', [1, 2])] },
      { keep: new Set([2]), sample: 0 },
    );
    expect(trimmed.entries[0].json).toEqual([{ number: 2, node_id: 'n2' }]);
  });

  it('keeps the headers that drive pagination', () => {
    const trimmed = sampleTranscript(
      { entries: [listEntry('https://api.github.com/repos/o/r/pulls?page=1', [1])] },
      { keep: new Set<number>(), sample: 0 },
    );
    expect(trimmed.entries[0].headers.link).toBe('<https://next>; rel="next"');
  });

  it('accepts the numeric-id spelling GitHub uses in its own link header', () => {
    const trimmed = sampleTranscript(
      { entries: [listEntry('https://api.github.com/repositories/197018189/pulls?page=2', [7, 8])] },
      { keep: new Set([8]), sample: 0 },
    );
    expect((trimmed.entries[0].json as { number: number }[]).map((p) => p.number)).toEqual([8]);
  });

  it('never truncates a per-pull-request sub-resource, which must stay whole', () => {
    const files = entry('https://api.github.com/repos/o/r/pulls/5989/files?per_page=100', [
      { filename: 'a.ts', additions: 1 },
      { filename: 'b.ts', additions: 2 },
      { filename: 'c.ts', additions: 3 },
    ]);
    const trimmed = sampleTranscript({ entries: [files] }, { keep: new Set<number>(), sample: 0 });
    expect(trimmed.entries[0].json).toEqual(files.json);
  });

  it('leaves a non-array body alone', () => {
    const repo = entry('https://api.github.com/repos/o/r', { default_branch: 'main' });
    expect(sampleTranscript({ entries: [repo] }, { keep: new Set<number>(), sample: 0 }).entries[0].json).toEqual(repo.json);
  });
});

describe('recordingFetch redaction', () => {
  it('drops the response headers that describe the caller credential', async () => {
    const upstream = async () =>
      new Response('{}', {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-oauth-scopes': 'admin:public_key, gist, read:org, repo',
          'x-oauth-client-id': '178c6fc778ccc68e1d6a',
          'x-accepted-oauth-scopes': 'repo',
          link: '<https://next>; rel="next"',
        },
      });
    const sink: TranscriptEntry[] = [];
    await recordingFetch(upstream as unknown as typeof fetch, sink)('https://api.github.com/x');

    expect(sink[0].headers['x-oauth-scopes']).toBeUndefined();
    expect(sink[0].headers['x-oauth-client-id']).toBeUndefined();
    expect(sink[0].headers['x-accepted-oauth-scopes']).toBeUndefined();
    // …while the headers replay and pagination need survive.
    expect(sink[0].headers.link).toBe('<https://next>; rel="next"');
    expect(sink[0].headers['content-type']).toBe('application/json');
  });

  it('builds the header record on a null prototype', async () => {
    const upstream = async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    const sink: TranscriptEntry[] = [];
    await recordingFetch(upstream as unknown as typeof fetch, sink)('https://api.github.com/x');
    expect(Object.getPrototypeOf(sink[0].headers)).toBeNull();
  });
});

describe('non-JSON responses', () => {
  it('keeps a raw text body exactly, and replays it unchanged', async () => {
    const yaml = "packages:\n  - 'packages/*'\n";
    const upstream = async () => new Response(yaml, { status: 200, headers: { 'content-type': 'text/plain' } });
    const sink: TranscriptEntry[] = [];
    await recordingFetch(upstream as unknown as typeof fetch, sink)('https://api.github.com/raw');

    expect(sink[0].text).toBe(yaml);
    expect(sink[0].json).toBeUndefined();
    expect(await (await replayFetch({ entries: sink })('https://api.github.com/raw')).text()).toBe(yaml);
  });
});
