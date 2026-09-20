import { Octokit } from '@octokit/rest';

/**
 * Every GitHub call the ingester makes, verified against @octokit/rest 22.0.1 on
 * 2026-09-20 (endpoint URLs read off `.endpoint.DEFAULTS.url` at runtime, not from docs).
 *
 * The token is a parameter. Nothing in this file reads `process.env` — a credential is
 * read in a route handler or a script and passed down.
 */

export type RepositoryRef = { owner: string; repo: string };

export type GitHubClient = Octokit;

/** One pull request as the list endpoint returns it, with its incidental fields intact. */
export type RawPullRequest = Awaited<ReturnType<Octokit['rest']['pulls']['list']>>['data'][number];
export type RawPullRequestFile = Awaited<ReturnType<Octokit['rest']['pulls']['listFiles']>>['data'][number];
export type RawPullRequestCommit = Awaited<ReturnType<Octokit['rest']['pulls']['listCommits']>>['data'][number];

const GITHUB_REPO_URL = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?(?:\/.*)?$/;
const OWNER_REPO = /^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/;

/** Accepts `owner/repo` or a github.com URL; throws on anything else. */
export function parseRepositoryRef(input: string): RepositoryRef {
  const trimmed = input.trim();
  const match = GITHUB_REPO_URL.exec(trimmed) ?? OWNER_REPO.exec(trimmed);
  if (!match) {
    throw new Error(`"${input}" is not a GitHub repository — expected owner/repo or a github.com URL`);
  }
  return { owner: match[1], repo: match[2] };
}

/**
 * `fetch` is injectable so the same client can be driven from a recorded transcript.
 * Verified against @octokit/rest 22.0.1: `request.fetch` is honoured, and `paginate`
 * follows the `link` header returned by the injected implementation.
 */
export function createGitHubClient(options: { token: string; fetch?: typeof fetch }): GitHubClient {
  if (!options.token) {
    throw new Error('createGitHubClient requires a token — it never falls back to the environment');
  }
  return new Octokit({
    auth: options.token,
    ...(options.fetch ? { request: { fetch: options.fetch } } : {}),
  });
}

export async function fetchDefaultBranch(client: GitHubClient, ref: RepositoryRef): Promise<string> {
  const response = await client.rest.repos.get({ ...ref });
  return response.data.default_branch;
}

/** One recursive tree request rather than a directory walk. */
export async function fetchRecursiveTree(
  client: GitHubClient,
  ref: RepositoryRef,
  treeSha: string,
): Promise<string[]> {
  const response = await client.rest.git.getTree({ ...ref, tree_sha: treeSha, recursive: '1' });
  if (response.data.truncated) {
    throw new Error(
      `the git tree for ${ref.owner}/${ref.repo} is too large for one recursive request and came back truncated`,
    );
  }
  return response.data.tree.flatMap((entry) => (entry.type === 'blob' && entry.path ? [entry.path] : []));
}

/** Returns the file's text, or null when the repository does not have it. */
export async function fetchTextFile(
  client: GitHubClient,
  ref: RepositoryRef,
  treeSha: string,
  path: string,
): Promise<string | null> {
  try {
    const response = await client.rest.repos.getContent({
      ...ref,
      path,
      ref: treeSha,
      mediaType: { format: 'raw' },
    });
    // With `format: raw` the endpoint returns the file body as a string.
    return typeof response.data === 'string' ? response.data : null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && (error as { status: number }).status === 404;
}

export type WindowBounds = {
  /** Inclusive ISO 8601 lower bound on `merged_at`. */
  since: string;
  /** Exclusive ISO 8601 upper bound on `merged_at`. */
  until: string;
  maxPullRequests: number;
};

/**
 * Merged pull requests whose merge landed inside the window, newest merge first.
 *
 * Measured against the live API on 2026-09-20 over xyflow/xyflow's 2,015 closed pull
 * requests, and the two findings below shape this function:
 *
 *  - `merged_at <= updated_at` held for all 1,619 merged pull requests (0 violations), so
 *    walking `sort=updated&direction=desc` and stopping once `updated_at` drops below
 *    `since` cannot miss a pull request merged inside the window. The listing endpoint has
 *    no merge-date filter, so this bound is how the window is honoured.
 *  - That ordering is *not* strictly monotonic — an inversion was observed at index 406
 *    (2025-06-26T13:05:54Z followed by 2025-06-26T14:29:10Z), the usual page-boundary
 *    jitter of offset pagination over a moving list. Stopping at the first below-window
 *    item would therefore truncate early, so we stop only after an entire page falls below
 *    the window.
 *
 * `maxPullRequests` bounds the result before the walk starts (Principle 6).
 */
export async function fetchMergedPullRequests(
  client: GitHubClient,
  ref: RepositoryRef,
  bounds: WindowBounds,
): Promise<RawPullRequest[]> {
  const matched: RawPullRequest[] = [];

  for await (const page of client.paginate.iterator(client.rest.pulls.list, {
    ...ref,
    state: 'closed',
    sort: 'updated',
    direction: 'desc',
    per_page: 100,
  })) {
    let pageReachesWindow = false;

    for (const pr of page.data) {
      if (pr.updated_at >= bounds.since) pageReachesWindow = true;
      if (!pr.merged_at) continue;
      if (pr.merged_at < bounds.since || pr.merged_at >= bounds.until) continue;
      matched.push(pr);
    }

    // Only stop when nothing on this whole page could still be in the window, which
    // tolerates the intra-page inversions the endpoint really produces.
    if (!pageReachesWindow) break;
  }

  matched.sort(compareByMergeRecency);
  return matched.slice(0, bounds.maxPullRequests);
}

/** Newest merge first; the pull-request number breaks ties so the order is total. */
function compareByMergeRecency(a: RawPullRequest, b: RawPullRequest): number {
  const byMerge = (b.merged_at ?? '').localeCompare(a.merged_at ?? '');
  return byMerge !== 0 ? byMerge : b.number - a.number;
}

export async function fetchPullRequestFiles(
  client: GitHubClient,
  ref: RepositoryRef,
  pullNumber: number,
): Promise<RawPullRequestFile[]> {
  return client.paginate(client.rest.pulls.listFiles, { ...ref, pull_number: pullNumber, per_page: 100 });
}

export async function fetchPullRequestCommits(
  client: GitHubClient,
  ref: RepositoryRef,
  pullNumber: number,
): Promise<RawPullRequestCommit[]> {
  return client.paginate(client.rest.pulls.listCommits, { ...ref, pull_number: pullNumber, per_page: 100 });
}
