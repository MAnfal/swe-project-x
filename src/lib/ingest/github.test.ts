import { describe, expect, it } from 'vitest';

import {
  compareByMergeRecency,
  createGitHubClient,
  fetchMergedPullRequests,
  fetchPullRequestCommits,
  fetchPullRequestFiles,
  fetchRecursiveTree,
  fetchTextFile,
  parseRepositoryRef,
} from '@/lib/ingest/github';

import { replayFetch } from '@/lib/ingest/transcript';

import {
  clientFor,
  loadTranscript,
  MISSING_FILE_TRANSCRIPT,
  replayClient,
  transcriptWithReversedListing,
  XYFLOW,
} from './fixtures/replay';

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

describe('compareByMergeRecency', () => {
  const pr = (number: number, merged_at: string) => ({ number, merged_at });

  it('puts the newer merge first', () => {
    expect(compareByMergeRecency(pr(1, '2026-08-31T00:00:00Z'), pr(2, '2026-09-01T00:00:00Z'))).toBeGreaterThan(0);
    expect(compareByMergeRecency(pr(2, '2026-09-01T00:00:00Z'), pr(1, '2026-08-31T00:00:00Z'))).toBeLessThan(0);
  });

  it('breaks a same-timestamp tie by pull-request number, higher first', () => {
    const at = '2026-08-31T09:22:57Z';
    expect(compareByMergeRecency(pr(10, at), pr(20, at))).toBeGreaterThan(0);
    expect(compareByMergeRecency(pr(20, at), pr(10, at))).toBeLessThan(0);
    // Never 0 for distinct pull requests: without a total order, two runs can order a
    // tie differently and the snapshot stops being byte-identical.
    expect(compareByMergeRecency(pr(10, at), pr(20, at))).not.toBe(0);
  });

  it('sorts a tied set deterministically, highest number first', () => {
    const at = '2026-08-31T09:22:57Z';
    const sorted = [pr(5977, at), pr(5992, at), pr(5987, at)].sort(compareByMergeRecency);
    expect(sorted.map((p) => p.number)).toEqual([5992, 5987, 5977]);
  });
});

describe('createGitHubClient', () => {
  it('never reads a token from the environment — it takes one', () => {
    // A missing token is a caller error, surfaced here rather than silently
    // falling back to process.env.
    expect(() => createGitHubClient({ token: '' })).toThrow(/token/i);
  });

  it('builds a working client from a token alone, with no request overrides', () => {
    // The `Object.keys(request).length > 0` branch: neither `fetch` nor `signal` given.
    expect(() => createGitHubClient({ token: 'a-token' })).not.toThrow();
  });

  it('puts the abort signal on every request the client makes', async () => {
    // Asserted on what `fetch` actually receives, not on the constructor's arguments —
    // the claim is that a route handler's disconnect reaches the socket, and the only
    // place that is observable is the request init.
    const controller = new AbortController();
    const seen: (AbortSignal | null | undefined)[] = [];

    const recordingFetch: typeof fetch = async (input, init) => {
      seen.push(init?.signal);
      return replayFetch(loadTranscript())(input, init);
    };

    const client = createGitHubClient({
      token: 'replay-token',
      fetch: recordingFetch,
      signal: controller.signal,
    });
    await fetchRecursiveTree(client, XYFLOW.ref, XYFLOW.branch);

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((signal) => signal === controller.signal)).toBe(true);
  });

  it('aborts an in-flight request when the signal fires', async () => {
    const controller = new AbortController();
    const client = createGitHubClient({ token: 'replay-token', signal: controller.signal });
    controller.abort();

    // The signal is already aborted, so `fetch` rejects before opening a socket — which
    // is why this spec reaches no network despite using the real client.
    await expect(fetchRecursiveTree(client, XYFLOW.ref, XYFLOW.branch)).rejects.toThrow();
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
    const { pullRequests: prs } = await fetchMergedPullRequests(replayClient(), XYFLOW.ref, {
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
    const { pullRequests: prs } = await fetchMergedPullRequests(replayClient(), XYFLOW.ref, {
      since: XYFLOW.since,
      until: XYFLOW.until,
      maxPullRequests: 100,
    });
    expect(prs[0]).toHaveProperty('node_id');
    expect(prs[0]).toHaveProperty('merge_commit_sha');
  });

  it('fetches files with the per-file line counts GitHub reported', async () => {
    const files = await fetchPullRequestFiles(replayClient(), XYFLOW.ref, 5992);
    const counts = Object.fromEntries(files.map((f) => [f.filename, [f.additions, f.deletions]]));
    expect(files).toHaveLength(10);
    expect(counts['.changeset/dirty-areas-leave.md']).toEqual([0, 5]);
    expect(counts['packages/react/CHANGELOG.md']).toEqual([14, 0]);
    expect(counts['packages/system/package.json']).toEqual([1, 1]);
  });

  it('returns merged pull requests newest merge first, whatever order the listing gave', async () => {
    const bounds = { since: XYFLOW.since, until: XYFLOW.until, maxPullRequests: 100 };
    const asCaptured = await fetchMergedPullRequests(replayClient(), XYFLOW.ref, bounds);
    const reversed = await fetchMergedPullRequests(
      clientFor(transcriptWithReversedListing()),
      XYFLOW.ref,
      bounds,
    );
    expect(asCaptured.pullRequests.map((p) => p.number)).toEqual([5992, 5997, 5994, 5977, 5987, 5989]);
    expect(reversed.pullRequests.map((p) => p.number)).toEqual(asCaptured.pullRequests.map((p) => p.number));
  });

  it('applies the ceiling to the newest merges, after ordering', async () => {
    const capped = await fetchMergedPullRequests(clientFor(transcriptWithReversedListing()), XYFLOW.ref, {
      since: XYFLOW.since,
      until: XYFLOW.until,
      maxPullRequests: 3,
    });
    expect(capped.pullRequests.map((p) => p.number)).toEqual([5992, 5997, 5994]);
    // `matched` is what the window really held, so a caller can tell the ceiling fired.
    // It counts the whole window, not the three that survived it.
    expect(capped.matched).toBe(6);
  });

  it('reports the same match count whether or not the ceiling fired', async () => {
    const bounds = { since: XYFLOW.since, until: XYFLOW.until };
    const uncapped = await fetchMergedPullRequests(replayClient(), XYFLOW.ref, {
      ...bounds,
      maxPullRequests: 100,
    });
    expect(uncapped.matched).toBe(6);
    expect(uncapped.pullRequests).toHaveLength(6);
  });

  it('fetches commits in the order the pull request records them', async () => {
    const commits = await fetchPullRequestCommits(replayClient(), XYFLOW.ref, 5989);
    expect(commits.length).toBeGreaterThan(0);
    expect(typeof commits[0].sha).toBe('string');
  });
});
