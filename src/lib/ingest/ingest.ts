import {
  DEFAULT_MAX_PULL_REQUESTS,
  MAX_PACKAGES,
  MAX_PULL_REQUESTS,
  type ChangedFile,
  type Snapshot,
  snapshotSchema,
} from '../snapshot.ts';
import { attributePullRequest, buildReverseClosure, ownerOfFile } from './attribution.ts';
import {
  fetchDefaultBranch,
  fetchMergedPullRequests,
  fetchPullRequestCommits,
  fetchPullRequestFiles,
  fetchRecursiveTree,
  fetchTextFile,
  type GitHubClient,
  type RepositoryRef,
} from './github.ts';
import { discoverTopology, workspaceManifestPaths, workspacePatterns, type Topology } from './topology.ts';

/**
 * The deterministic half of a snapshot: topology, merged pull requests, and which
 * packages each one reached. No model calls, no judgment.
 *
 * Every I/O sequence lives here; topology, attribution and the schema are pure functions
 * over data. The analysis clock is an argument rather than a call to `Date.now()`, so the
 * whole pipeline is a pure function of its inputs and `metadata` is the only part of the
 * result that varies between runs.
 */

export type IngestOptions = {
  repository: RepositoryRef;
  /** Inclusive ISO 8601 lower bound on the merge date. */
  since: string;
  /** Exclusive ISO 8601 upper bound on the merge date. */
  until: string;
  /** Supplied by the caller — this module never reads a clock. */
  analyzedAt: string;
  /** Bounded before the walk starts (Principle 6). */
  maxPullRequests?: number;
  /** Defaults to the repository's default branch. */
  branch?: string;
};

export type RepositoryTopology = {
  topology: Topology;
  patterns: string[];
  manifestPaths: string[];
};

/** Discovers the workspace layout: one tree request, then one read per workspace manifest. */
export async function discoverRepositoryTopology(
  client: GitHubClient,
  ref: RepositoryRef,
  branch: string,
): Promise<RepositoryTopology> {
  const [treePaths, pnpmWorkspace, rootManifest] = await Promise.all([
    fetchRecursiveTree(client, ref, branch),
    fetchTextFile(client, ref, branch, 'pnpm-workspace.yaml'),
    fetchTextFile(client, ref, branch, 'package.json'),
  ]);

  const patterns = workspacePatterns({ pnpmWorkspace, rootManifest });
  const manifestPaths = workspaceManifestPaths(treePaths, patterns);
  if (manifestPaths.length > MAX_PACKAGES) {
    throw new Error(
      `${ref.owner}/${ref.repo} declares ${manifestPaths.length} workspace packages, above the limit of ${MAX_PACKAGES}`,
    );
  }

  const manifests = await Promise.all(
    manifestPaths.map(async (path) => ({ path, text: (await fetchTextFile(client, ref, branch, path)) ?? '' })),
  );

  return {
    topology: discoverTopology({ manifests: manifests.filter((m) => m.text.length > 0) }),
    patterns,
    manifestPaths,
  };
}

export async function ingestRepository(client: GitHubClient, options: IngestOptions): Promise<Snapshot> {
  const maxPullRequests = options.maxPullRequests ?? DEFAULT_MAX_PULL_REQUESTS;
  if (!Number.isInteger(maxPullRequests) || maxPullRequests < 1) {
    throw new Error(`maxPullRequests must be a positive integer, received ${String(options.maxPullRequests)}`);
  }
  if (maxPullRequests > MAX_PULL_REQUESTS) {
    throw new Error(
      `maxPullRequests ${maxPullRequests} is above the snapshot limit of ${MAX_PULL_REQUESTS} — lower the ceiling or narrow the window`,
    );
  }
  if (!(options.since < options.until)) {
    throw new Error(`the window ${options.since}..${options.until} is empty — since must be before until`);
  }

  const ref = options.repository;
  const branch = options.branch ?? (await fetchDefaultBranch(client, ref));
  const { topology } = await discoverRepositoryTopology(client, ref, branch);

  const merged = await fetchMergedPullRequests(client, ref, {
    since: options.since,
    until: options.until,
    maxPullRequests,
  });

  const detailed = await Promise.all(
    merged.map(async (pr) => ({
      pr,
      files: await fetchPullRequestFiles(client, ref, pr.number),
      commits: await fetchPullRequestCommits(client, ref, pr.number),
    })),
  );

  // One closure for the whole snapshot, over every package any pull request touched.
  const touched = detailed.flatMap(({ files }) =>
    files.flatMap((file) => {
      const owner = ownerOfFile(file.filename, topology.nodes);
      return owner ? [owner] : [];
    }),
  );
  const closure = buildReverseClosure(topology, touched);

  const pullRequests = detailed.map(({ pr, files, commits }) => {
    const changedFiles: ChangedFile[] = files
      .map((file) => ({
        path: file.filename,
        additions: file.additions,
        deletions: file.deletions,
        status: file.status,
        package: ownerOfFile(file.filename, topology.nodes),
      }))
      .sort((a, b) => a.path.localeCompare(b.path));

    const { direct, indirect } = attributePullRequest(changedFiles, topology.nodes, closure);

    return {
      number: pr.number,
      title: pr.title,
      body: pr.body ?? null,
      author: pr.user?.login ?? null,
      mergedAt: pr.merged_at as string,
      mergeCommitSha: pr.merge_commit_sha ?? null,
      url: pr.html_url,
      // Commit order is the order the pull request records, which is the order the work
      // happened — the canvas renders it as a left-to-right chain.
      commits: commits.map((commit) => ({ sha: commit.sha, message: commit.commit.message })),
      files: changedFiles,
      directPackages: direct,
      indirectPackages: indirect,
    };
  });

  const snapshot = {
    metadata: {
      repository: { owner: ref.owner, name: ref.repo },
      window: { since: options.since, until: options.until },
      analyzedAt: options.analyzedAt,
      packageCount: topology.nodes.length,
      pullRequestCount: pullRequests.length,
    },
    packages: topology,
    pullRequests,
  };

  return snapshotSchema.parse(snapshot);
}

