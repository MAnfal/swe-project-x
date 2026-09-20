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
import type { AnalysisProgress } from '../live/protocol.ts';

/**
 * The deterministic half of a snapshot: topology, merged pull requests, and which
 * packages each one reached. No model calls, no judgment.
 *
 * Every I/O sequence lives here; topology, attribution and the schema are pure functions
 * over data. The analysis clock is an argument rather than a call to `Date.now()`, so the
 * whole pipeline is a pure function of its inputs and `metadata` is the only part of the
 * result that varies between runs.
 *
 * There is one pipeline and two entry points onto it (Principle 5): `analyzeRepository`,
 * which a route handler calls and which reports progress and what the ceiling did, and
 * `ingestRepository`, which the CLI calls and which wants neither. The second delegates
 * to the first, so a live analysis and a baked snapshot cannot diverge.
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
  /**
   * Called as each step completes, and once per pull request through the volumetric
   * step. Synchronous and never awaited: a slow consumer must not pace the pipeline.
   */
  onProgress?: (progress: AnalysisProgress) => void;
};

/** What the pull-request ceiling did to this run. */
export type PullRequestBound = {
  maxPullRequests: number;
  /** Merged pull requests the window held. */
  matched: number;
  /** How many were analyzed — `min(matched, maxPullRequests)`. */
  kept: number;
  truncated: boolean;
};

export type AnalysisResult = {
  snapshot: Snapshot;
  bound: PullRequestBound;
  /** The branch the topology was read from, resolved when the caller named none. */
  branch: string;
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

/** The CLI's entry point: the snapshot alone, from the same pipeline. */
export async function ingestRepository(client: GitHubClient, options: IngestOptions): Promise<Snapshot> {
  return (await analyzeRepository(client, options)).snapshot;
}

export async function analyzeRepository(client: GitHubClient, options: IngestOptions): Promise<AnalysisResult> {
  const report = options.onProgress ?? (() => {});
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
  report({ step: 'resolve', done: 1, total: 1, branch });

  const { topology } = await discoverRepositoryTopology(client, ref, branch);
  report({
    step: 'topology',
    done: 1,
    total: 1,
    packageCount: topology.nodes.length,
    edgeCount: topology.edges.length,
  });

  // The ceiling is applied here, before a single per-pull-request request is made, which
  // is what Principle 6 means by bounded before it starts: the volumetric cost is the
  // files and commits calls below, and they only ever run over `merged.pullRequests`.
  const merged = await fetchMergedPullRequests(client, ref, {
    since: options.since,
    until: options.until,
    maxPullRequests,
  });
  const bound: PullRequestBound = {
    maxPullRequests,
    matched: merged.matched,
    kept: merged.pullRequests.length,
    truncated: merged.matched > merged.pullRequests.length,
  };
  report({
    step: 'pull-requests',
    done: bound.kept,
    total: bound.kept,
    matched: bound.matched,
    truncated: bound.truncated,
  });

  let read = 0;
  const detailed = await Promise.all(
    merged.pullRequests.map(async (pr) => {
      const files = await fetchPullRequestFiles(client, ref, pr.number);
      const commits = await fetchPullRequestCommits(client, ref, pr.number);

      read += 1;
      report({
        step: 'details',
        done: read,
        total: bound.kept,
        read: {
          number: pr.number,
          title: pr.title,
          packages: [
            ...new Set(files.flatMap((file) => ownerOfFile(file.filename, topology.nodes) ?? [])),
          ].sort((a, b) => a.localeCompare(b)),
        },
      });

      return { pr, files, commits };
    }),
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

  const parsed = snapshotSchema.parse(snapshot);
  report({
    step: 'attribute',
    done: 1,
    total: 1,
    packageCount: parsed.metadata.packageCount,
  });

  return { snapshot: parsed, bound, branch };
}

