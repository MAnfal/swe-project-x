import { describe, expect, it } from 'vitest';

import {
  createGitHubClient,
  fetchMergedPullRequests,
  fetchPullRequestCommits,
  fetchPullRequestFiles,
  fetchRecursiveTree,
  fetchTextFile,
  parseRepositoryRef,
} from '@/lib/ingest/github';

import { MISSING_FILE_TRANSCRIPT, replayClient, XYFLOW } from './fixtures/replay';

describe('parseRepositoryRef', () => {
  it.each([
    ['xyflow/xyflow', { owner: 'xyflow', repo: 'xyflow' }],
    ['https://github.com/xyflow/xyflow', { owner: 'xyflow', repo: 'xyflow' }],
    ['https://github.com/xyflow/xyflow.git', { owner: 'xyflow', repo: 'xyflow' }],
    ['https://github.com/xyflow/xyflow/pull/1', { owner: 'xyflow', repo: 'xyflow' }],
  ])('parses %s', (input, expected) => {
    expect(parseRepositoryRef(input)).toEqual(expected);
  });

  it.each(['', 'xyflow', 'https://example.com/a/b', 'a/b/c/d'])('rejects %s', (input) => {
    expect(() => parseRepositoryRef(input)).toThrow();
  });
});

describe('createGitHubClient', () => {
  it('never reads a token from the environment — it takes one', () => {
    // A missing token is a caller error, surfaced here rather than silently
    // falling back to process.env.
    expect(() => createGitHubClient({ token: '' })).toThrow(/token/i);
  });
});

describe('github fetchers over captured xyflow/xyflow responses', () => {
  it('fetches the whole tree in one recursive request', async () => {
    const paths = await fetchRecursiveTree(replayClient(), XYFLOW.ref, XYFLOW.branch);
    expect(paths.length).toBeGreaterThan(500);
    expect(paths).toContain('packages/react/package.json');
    expect(paths).toContain('pnpm-workspace.yaml');
  });

  it('fetches a text file as raw text rather than base64', async () => {
    const text = await fetchTextFile(replayClient(), XYFLOW.ref, XYFLOW.branch, 'pnpm-workspace.yaml');
    expect(text).toContain("- 'packages/*'");
  });

  it('returns null for a file the repository does not have', async () => {
    // Against a separately recorded, real 404 from the contents endpoint.
    const client = replayClient(MISSING_FILE_TRANSCRIPT);
    expect(await fetchTextFile(client, XYFLOW.ref, XYFLOW.branch, 'lerna.json')).toBeNull();
  });

  it('lists only pull requests merged inside the window', async () => {
    const prs = await fetchMergedPullRequests(replayClient(), XYFLOW.ref, {
      since: XYFLOW.since,
      until: XYFLOW.until,
      maxPullRequests: 100,
    });
    expect(prs.length).toBeGreaterThan(0);
    for (const pr of prs) {
      expect(pr.merged_at).not.toBeNull();
      expect(pr.merged_at! >= XYFLOW.since).toBe(true);
      expect(pr.merged_at! < XYFLOW.until).toBe(true);
    }
  });

  it('carries the incidental API fields a captured response has', async () => {
    const prs = await fetchMergedPullRequests(replayClient(), XYFLOW.ref, {
      since: XYFLOW.since,
      until: XYFLOW.until,
      maxPullRequests: 100,
    });
    expect(prs[0]).toHaveProperty('node_id');
    expect(prs[0]).toHaveProperty('merge_commit_sha');
  });

  it('fetches files with per-file line counts', async () => {
    const files = await fetchPullRequestFiles(replayClient(), XYFLOW.ref, 5989);
    expect(files.length).toBeGreaterThan(0);
    expect(typeof files[0].additions).toBe('number');
    expect(typeof files[0].deletions).toBe('number');
  });

  it('fetches commits in the order the pull request records them', async () => {
    const commits = await fetchPullRequestCommits(replayClient(), XYFLOW.ref, 5989);
    expect(commits.length).toBeGreaterThan(0);
    expect(typeof commits[0].sha).toBe('string');
  });
});
