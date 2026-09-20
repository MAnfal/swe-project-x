import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST } from '@/app/api/enrichment/route';
import type { PullRequestRecord } from '@/lib/snapshot';

/**
 * The enrichment route's guards. Nothing here reaches Anthropic: every case is rejected
 * before a model is configured. The caching and fallback behaviour behind the guards is
 * covered by `src/lib/ai/enrichment-cache.test.ts`, which drives the real
 * `enrichPullRequest` against a model double.
 */

const COMMIT = 'aaaaaaaabbbbbbbbccccccccddddddddeeeeeeee';

function pullRequest(overrides: Partial<PullRequestRecord> = {}): PullRequestRecord {
  return {
    number: 5989,
    title: 'feat(system): add global site settings',
    body: null,
    author: 'moklick',
    mergedAt: '2026-08-31T09:22:57Z',
    mergeCommitSha: '1f0c2d3e4a5b6c7d8e9f0a1b2c3d4e5f60718293',
    url: 'https://github.com/xyflow/xyflow/pull/5989',
    commits: [{ sha: COMMIT, message: 'add site_settings table' }],
    files: [],
    directPackages: [],
    indirectPackages: [],
    ...overrides,
  };
}

function post(body: unknown): Request {
  return new Request('http://localhost/api/enrichment', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('POST /api/enrichment', () => {
  it('declares the Node.js runtime and an explicit duration ceiling', async () => {
    const route = await import('@/app/api/enrichment/route');
    expect(route.runtime).toBe('nodejs');
    expect(route.maxDuration).toBe(60);
  });

  const badRepository: [string, unknown, RegExp][] = [
    ['a missing repository', undefined, /owner and a repo/i],
    ['an owner that is not a string', { owner: 7, name: 'xyflow' }, /owner and a repo/i],
    ['a reserved repository name', { owner: 'xyflow', name: '__proto__' }, /reserved/i],
    ['a reserved owner', { owner: 'constructor', name: 'xyflow' }, /reserved/i],
    ['a name carrying a path', { owner: 'xyflow', name: 'xyflow/pulls' }, /inside a repository/i],
    ['a traversal name', { owner: 'xyflow', name: '..' }, /repository name/i],
  ];

  it.each(badRepository)('rejects %s with 400, before reading the key', async (_label, repository, message) => {
    const response = await POST(post({ repository, pullRequest: pullRequest() }));
    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(message);
  });

  const badPullRequest: [string, unknown][] = [
    ['a missing pull request', undefined],
    ['an empty object', {}],
    ['a negative number', { ...pullRequest(), number: -1 }],
    ['a blank merge SHA', { ...pullRequest(), mergeCommitSha: '' }],
    ['a pull request whose commits are not commits', { ...pullRequest(), commits: [{ sha: 1 }] }],
  ];

  it.each(badPullRequest)('rejects %s with 400', async (_label, record) => {
    const response = await POST(
      post({ repository: { owner: 'xyflow', name: 'xyflow' }, pullRequest: record }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/not a pull request/i);
  });

  it('rejects a body that is not JSON at all', async () => {
    const response = await POST(post('not json'));
    expect(response.status).toBe(400);
  });

  it('answers 500 when no Anthropic key is configured, rather than a blank record', async () => {
    const response = await POST(
      post({ repository: { owner: 'xyflow', name: 'xyflow' }, pullRequest: pullRequest() }),
    );
    expect(response.status).toBe(500);
    expect((await response.json()).message).toMatch(/Anthropic key/i);
  });

  it('never echoes the configured key', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-thisMustNeverAppear';
    const response = await POST(post({ repository: { owner: 'xyflow', name: '..' }, pullRequest: {} }));
    expect(await response.text()).not.toContain('sk-ant-thisMustNeverAppear');
  });
});
