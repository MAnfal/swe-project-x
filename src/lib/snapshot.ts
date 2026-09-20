import { z } from 'zod';

/**
 * The snapshot is the contract between ingest and every consumer: the canvas, the
 * enrichment pass, and the live-analysis route all read this one shape.
 *
 * Two rules the rest of the codebase depends on:
 *
 * 1. `metadata` is the only place a value derived from the analysis clock may appear.
 *    Everything outside it is a pure function of the repository and the window, so two
 *    runs over the same inputs serialize identically.
 * 2. `enrichment` is optional. It is written by the enrichment pass; every renderer must
 *    draw a snapshot that does not have it.
 */

/**
 * Keys that would reach `Object.prototype` if written onto an ordinary object literal.
 * Package names and enrichment keys come from repository content, so they are checked
 * against this list before they are used as keys.
 */
export const RESERVED_KEYS: readonly string[] = ['__proto__', 'constructor', 'prototype'];

/** Upper bounds enforced at the schema boundary, so a hostile repository cannot unbound us. */
export const MAX_PACKAGES = 2_000;
export const MAX_PULL_REQUESTS = 500;
export const MAX_FILES_PER_PULL_REQUEST = 3_000;
export const MAX_COMMITS_PER_PULL_REQUEST = 1_000;

/** What a caller gets if it does not choose a ceiling. Never "everything". */
export const DEFAULT_MAX_PULL_REQUESTS = 100;

/**
 * Rejects a repository-derived string that must not be used as an object key.
 *
 * The schema cannot do this job. Measured against zod 4.6.5 on 2026-09-20: `z.record()`
 * parses `{"__proto__": …}` successfully and the key is simply absent from the result —
 * silent loss, not rejection. So the check happens here, before parsing.
 */
export function assertSafeKey(key: string, kind: string): void {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error(`${kind} must be a non-empty string`);
  }
  if (RESERVED_KEYS.includes(key)) {
    throw new Error(`${kind} "${key}" is a reserved object key and cannot be used as a record key`);
  }
}

/**
 * Builds a keyed record from entries on a null prototype, rejecting reserved keys and
 * rejecting duplicates rather than letting the later write win.
 */
export function buildRecord<T>(entries: Iterable<readonly [string, T]>, kind: string): Record<string, T> {
  const record = Object.create(null) as Record<string, T>;
  for (const [key, value] of entries) {
    assertSafeKey(key, kind);
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      throw new Error(`duplicate ${kind} "${key}" — refusing to overwrite the earlier entry`);
    }
    record[key] = value;
  }
  return record;
}

export const packageNodeSchema = z.object({
  /** The name declared in the package's manifest. Unique within a snapshot. */
  name: z.string().min(1),
  /** Repository-relative directory, with no trailing slash, e.g. `packages/system`. */
  path: z.string().min(1),
  manifestPath: z.string().min(1),
});

export const packageEdgeSchema = z.object({
  /** `from` declares a dependency on `to`. Both name a node in the same snapshot. */
  from: z.string().min(1),
  to: z.string().min(1),
  kind: z.enum(['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']),
});

export const changedFileSchema = z.object({
  path: z.string().min(1),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  status: z.string().min(1),
  /** The package that owns this file, or null when it sits outside every package. */
  package: z.string().min(1).nullable(),
});

export const commitSchema = z.object({
  sha: z.string().min(1),
  message: z.string(),
});

/**
 * One package reached indirectly by a pull request, and the dependency chain that
 * reached it. `path[0]` is the reached package and the last element is the
 * directly-touched package the chain ends at, which is also `through`.
 */
export const indirectReachSchema = z
  .object({
    package: z.string().min(1),
    through: z.string().min(1),
    path: z.array(z.string().min(1)).min(2),
  })
  .refine((value) => value.path[0] === value.package && value.path[value.path.length - 1] === value.through, {
    message: 'path must start at the reached package and end at the directly touched package',
  });

export const pullRequestSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string().nullable(),
  author: z.string().nullable(),
  /** ISO 8601. Repository data, not the analysis clock. */
  mergedAt: z.string().min(1),
  /** Null only if GitHub reported none; present for squash, merge and rebase alike. */
  mergeCommitSha: z.string().min(1).nullable(),
  url: z.string().min(1),
  commits: z
    .array(commitSchema)
    .max(MAX_COMMITS_PER_PULL_REQUEST, `a pull request may carry at most ${MAX_COMMITS_PER_PULL_REQUEST} commits`),
  files: z
    .array(changedFileSchema)
    .max(MAX_FILES_PER_PULL_REQUEST, `a pull request may carry at most ${MAX_FILES_PER_PULL_REQUEST} changed files`),
  directPackages: z.array(z.string().min(1)),
  indirectPackages: z.array(indirectReachSchema),
});

/**
 * Written by the enrichment pass, keyed by merge commit SHA. Declared here so there is
 * one snapshot schema rather than a second one for enriched snapshots.
 */
export const enrichmentEntrySchema = z.object({
  label: z.string().min(1),
  approach: z.string().min(1),
  steps: z.array(z.object({ commitSha: z.string().min(1), summary: z.string().min(1) })).min(1),
});

export const enrichmentSchema = z.record(z.string().min(1), enrichmentEntrySchema);

export const snapshotMetadataSchema = z.object({
  repository: z.object({ owner: z.string().min(1), name: z.string().min(1) }),
  window: z.object({ since: z.string().min(1), until: z.string().min(1) }),
  /** The only value in a snapshot derived from the analysis clock. */
  analyzedAt: z.string().min(1),
  packageCount: z.number().int().nonnegative(),
  pullRequestCount: z.number().int().nonnegative(),
});

export const snapshotSchema = z.object({
  metadata: snapshotMetadataSchema,
  packages: z.object({
    nodes: z
      .array(packageNodeSchema)
      .max(MAX_PACKAGES, `a snapshot may contain at most ${MAX_PACKAGES} packages`),
    edges: z.array(packageEdgeSchema),
  }),
  pullRequests: z
    .array(pullRequestSchema)
    .max(MAX_PULL_REQUESTS, `a snapshot may contain at most ${MAX_PULL_REQUESTS} pull requests`),
  enrichment: enrichmentSchema.optional(),
});

export type PackageNode = z.infer<typeof packageNodeSchema>;
export type PackageEdge = z.infer<typeof packageEdgeSchema>;
export type ChangedFile = z.infer<typeof changedFileSchema>;
export type Commit = z.infer<typeof commitSchema>;
export type IndirectReach = z.infer<typeof indirectReachSchema>;
export type PullRequestRecord = z.infer<typeof pullRequestSchema>;
export type EnrichmentEntry = z.infer<typeof enrichmentEntrySchema>;
export type SnapshotMetadata = z.infer<typeof snapshotMetadataSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;

/**
 * Serializes a snapshot with object keys in a stable order, so two runs over the same
 * inputs produce the same bytes regardless of the order the ingester happened to insert
 * keys. Array order is meaningful and is left alone — the ingester sorts what needs it.
 */
export function serializeSnapshot(snapshot: Snapshot): string {
  return `${JSON.stringify(sortKeysDeep(snapshot), null, 2)}\n`;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value === null || typeof value !== 'object') return value;
  const source = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    sorted[key] = sortKeysDeep(source[key]);
  }
  return sorted;
}
