import { describe, expect, it } from 'vitest';

import {
  MAX_PACKAGES,
  MAX_PULL_REQUESTS,
  assertSafeKey,
  buildRecord,
  serializeSnapshot,
  snapshotSchema,
} from '@/lib/snapshot';

/** A snapshot that satisfies every required field, used as the base for negative cases. */
function validSnapshot() {
  return {
    metadata: {
      repository: { owner: 'xyflow', name: 'xyflow' },
      window: { since: '2026-08-31T00:00:00Z', until: '2026-09-02T00:00:00Z' },
      analyzedAt: '2026-09-20T00:00:00Z',
      packageCount: 1,
      pullRequestCount: 1,
    },
    packages: {
      nodes: [{ name: '@xyflow/system', path: 'packages/system', manifestPath: 'packages/system/package.json' }],
      edges: [],
    },
    pullRequests: [
      {
        number: 5989,
        title: 'fix(system): prevent jumping of nodes',
        body: null,
        author: 'moklick',
        mergedAt: '2026-08-31T09:22:57Z',
        mergeCommitSha: 'deadbeef',
        url: 'https://github.com/xyflow/xyflow/pull/5989',
        commits: [{ sha: 'c0ffee', message: 'fix it' }],
        files: [
          { path: 'packages/system/src/x.ts', additions: 41, deletions: 0, status: 'modified', package: '@xyflow/system' },
        ],
        directPackages: ['@xyflow/system'],
        indirectPackages: [],
      },
    ],
  };
}

describe('snapshotSchema', () => {
  it('validates a snapshot with no enrichment block', () => {
    const parsed = snapshotSchema.parse(validSnapshot());
    expect(parsed.enrichment).toBeUndefined();
    expect(parsed.pullRequests[0].files[0].additions).toBe(41);
  });

  it('rejects a pull request missing a required field', () => {
    const snapshot = validSnapshot();
    delete (snapshot.pullRequests[0] as Partial<(typeof snapshot.pullRequests)[0]>).mergedAt;
    const result = snapshotSchema.safeParse(snapshot);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('mergedAt');
  });

  it('rejects an indirect reach whose path does not end at the package it came through', () => {
    const snapshot = validSnapshot();
    snapshot.pullRequests[0].indirectPackages = [
      // path ends at "@xyflow/other" but claims to have come through "@xyflow/system"
      { package: '@xyflow/react', through: '@xyflow/system', path: ['@xyflow/react', '@xyflow/other'] },
    ] as never;
    expect(snapshotSchema.safeParse(snapshot).success).toBe(false);
  });

  it('caps the package count and names the limit in the failure', () => {
    const snapshot = validSnapshot();
    snapshot.packages.nodes = Array.from({ length: MAX_PACKAGES + 1 }, (_, i) => ({
      name: `p${i}`,
      path: `packages/p${i}`,
      manifestPath: `packages/p${i}/package.json`,
    }));
    const result = snapshotSchema.safeParse(snapshot);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain(String(MAX_PACKAGES));
  });

  it('caps the pull-request count and names the limit in the failure', () => {
    const snapshot = validSnapshot();
    const one = snapshot.pullRequests[0];
    snapshot.pullRequests = Array.from({ length: MAX_PULL_REQUESTS + 1 }, (_, i) => ({ ...one, number: i + 1 }));
    const result = snapshotSchema.safeParse(snapshot);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain(String(MAX_PULL_REQUESTS));
  });
});

describe('assertSafeKey', () => {
  it.each(['__proto__', 'constructor', 'prototype'])('rejects the reserved key %s', (key) => {
    expect(() => assertSafeKey(key, 'package name')).toThrow(/reserved/i);
  });

  it('accepts an ordinary scoped package name', () => {
    expect(() => assertSafeKey('@xyflow/system', 'package name')).not.toThrow();
  });

  it('rejects an empty key', () => {
    expect(() => assertSafeKey('', 'package name')).toThrow();
  });
});

describe('buildRecord', () => {
  it('builds on a null prototype so a hostile key cannot reach Object.prototype', () => {
    const record = buildRecord([['ok', 1]], 'package name');
    expect(Object.getPrototypeOf(record)).toBeNull();
  });

  it('rejects a reserved key rather than writing it', () => {
    expect(() => buildRecord([['__proto__', 1]], 'package name')).toThrow(/reserved/i);
  });

  it('rejects a duplicate key rather than letting the later value win', () => {
    expect(() => buildRecord(
      [
        ['dup', 1],
        ['dup', 2],
      ],
      'package name',
    )).toThrow(/duplicate/i);
  });

  it('is what the schema cannot do: zod drops a reserved record key silently', () => {
    // Measured against zod 4.6.5 on 2026-09-20: z.record() parses {"__proto__": …}
    // successfully and the key is simply absent from the result. Silent loss, not
    // rejection — which is why the guard above exists and is applied before parsing.
    const hostile = JSON.parse(String.raw`{"__proto__":{"label":"x","approach":"y","steps":[{"commitSha":"a","summary":"s"}]}}`);
    const snapshot = { ...validSnapshot(), enrichment: hostile };
    const parsed = snapshotSchema.safeParse(snapshot);
    expect(parsed.success).toBe(true);
    expect(Object.keys(parsed.data?.enrichment ?? {})).toEqual([]);
    // …so the boundary guard, not the schema, is what rejects it.
    expect(() => buildRecord(Object.entries(hostile), 'enrichment key')).toThrow(/reserved/i);
  });
});

describe('serializeSnapshot', () => {
  const SHA_A = 'aaa1111111111111111111111111111111111111';
  const SHA_Z = 'zzz9999999999999999999999999999999999999';
  const entry = { label: 'l', approach: 'a', steps: [{ commitSha: 'c', summary: 's' }] };

  const withEnrichment = (keys: [string, string]) =>
    snapshotSchema.parse({
      ...validSnapshot(),
      enrichment: { [keys[0]]: entry, [keys[1]]: entry },
    });

  it('orders record keys stably regardless of insertion order', () => {
    const zFirst = withEnrichment([SHA_Z, SHA_A]);
    const aFirst = withEnrichment([SHA_A, SHA_Z]);

    // The premise: zod 4.6.5 normalises `z.object` fields to schema order but leaves
    // `z.record` keys in insertion order, so these two really do differ going in. If a
    // zod upgrade starts normalising records, this is the assertion that says so.
    expect(Object.keys(zFirst.enrichment ?? {})).toEqual([SHA_Z, SHA_A]);
    expect(Object.keys(aFirst.enrichment ?? {})).toEqual([SHA_A, SHA_Z]);

    // …so the equality below is the serializer's doing, not zod's. `enrichment` is keyed
    // by merge SHA and written by a later chunk; without this, two runs that enrich in a
    // different order serialize differently and determinism is lost.
    expect(serializeSnapshot(zFirst)).toBe(serializeSnapshot(aFirst));

    const serialized = serializeSnapshot(zFirst);
    expect(serialized.indexOf(SHA_A)).toBeLessThan(serialized.indexOf(SHA_Z));
  });

  it('sorts keys at every depth, not just the top level', () => {
    // A changed file is parsed into schema order (path, additions, deletions, status,
    // package); sorted order is different, so this fails if the sort is shallow or absent.
    const serialized = serializeSnapshot(snapshotSchema.parse(validSnapshot()));
    const file = serialized.slice(serialized.indexOf('"files"'));
    const keys = [...file.matchAll(/"(path|additions|deletions|status|package)":/g)].map((m) => m[1]);
    expect(keys.slice(0, 5)).toEqual(['additions', 'deletions', 'package', 'path', 'status']);
  });

  it('puts the top-level keys in sorted order', () => {
    const serialized = serializeSnapshot(withEnrichment([SHA_Z, SHA_A]));
    const top = [...serialized.matchAll(/^ {2}"(\w+)":/gm)].map((m) => m[1]);
    expect(top).toEqual(['enrichment', 'metadata', 'packages', 'pullRequests']);
  });
});
