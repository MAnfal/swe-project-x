import { describe, expect, it } from 'vitest';

import { attributePullRequest, buildReverseClosure, ownerOfFile } from '@/lib/ingest/attribution';
import type { Topology } from '@/lib/ingest/topology';

import { ingestFromFixture } from './fixtures/replay';

const topology: Topology = {
  nodes: [
    { name: 'app', path: 'apps/app', manifestPath: 'apps/app/package.json' },
    { name: 'a', path: 'packages/a', manifestPath: 'packages/a/package.json' },
    { name: 'a-inner', path: 'packages/a/inner', manifestPath: 'packages/a/inner/package.json' },
    { name: 'b', path: 'packages/b', manifestPath: 'packages/b/package.json' },
  ],
  edges: [
    { from: 'a', to: 'b', kind: 'dependencies' },
    { from: 'app', to: 'a', kind: 'dependencies' },
  ],
};

const file = (path: string) => ({ path, additions: 1, deletions: 0, status: 'modified' });

describe('ownerOfFile', () => {
  it('attributes a file to the package that contains it', () => {
    expect(ownerOfFile('packages/b/src/index.ts', topology.nodes)).toBe('b');
  });

  it('attributes a file to the longest matching package path, not the shortest', () => {
    expect(ownerOfFile('packages/a/inner/src/x.ts', topology.nodes)).toBe('a-inner');
  });

  it('returns null for a file that sits outside every package', () => {
    expect(ownerOfFile('README.md', topology.nodes)).toBeNull();
    expect(ownerOfFile('.changeset/nice-name.md', topology.nodes)).toBeNull();
  });

  it('does not match a package path that is only a string prefix of the file path', () => {
    // "packages/b" must not claim "packages/beta/src/x.ts".
    expect(ownerOfFile('packages/beta/src/x.ts', topology.nodes)).toBeNull();
  });
});

describe('attributePullRequest', () => {
  const closure = () => buildReverseClosure(topology, ['a', 'b']);

  it('records a package whose file changed as reached directly', () => {
    const result = attributePullRequest([file('packages/b/src/x.ts')], topology.nodes, closure());
    expect(result.direct).toEqual(['b']);
  });

  it('records a dependent as reached indirectly, with the path that reached it', () => {
    const result = attributePullRequest([file('packages/b/src/x.ts')], topology.nodes, closure());
    expect(result.indirect).toEqual([
      { package: 'a', through: 'b', path: ['a', 'b'] },
      { package: 'app', through: 'b', path: ['app', 'a', 'b'] },
    ]);
  });

  it('records a package as direct, not indirect, when it is both', () => {
    const result = attributePullRequest(
      [file('packages/b/src/x.ts'), file('packages/a/src/y.ts')],
      topology.nodes,
      closure(),
    );
    expect(result.direct).toEqual(['a', 'b']);
    // `app` is reached from both touched packages; it is listed once, by the shorter chain.
    expect(result.indirect).toEqual([{ package: 'app', through: 'a', path: ['app', 'a'] }]);
  });

  it('attributes nothing when every changed file sits outside a package', () => {
    const result = attributePullRequest([file('README.md')], topology.nodes, closure());
    expect(result).toEqual({ direct: [], indirect: [] });
  });
});

describe('attribution over captured xyflow/xyflow responses', () => {
  it('reaches the real dependents of a package a real pull request touched', async () => {
    const snapshot = await ingestFromFixture();

    // #5989 "fix(system): prevent jumping of nodes" changed only files under packages/system.
    const pr = snapshot.pullRequests.find((p) => p.number === 5989);
    expect(pr, 'PR 5989 must be inside the captured window').toBeDefined();
    expect(pr!.directPackages).toEqual(['@xyflow/system']);

    const indirect = pr!.indirectPackages;
    // Real one-hop dependents declared in the real manifests.
    expect(indirect).toContainEqual({
      package: '@xyflow/react',
      through: '@xyflow/system',
      path: ['@xyflow/react', '@xyflow/system'],
    });
    // Real two-hop reach: svelte-examples -> @xyflow/svelte -> @xyflow/system.
    expect(indirect).toContainEqual({
      package: 'svelte-examples',
      through: '@xyflow/system',
      path: ['svelte-examples', '@xyflow/svelte', '@xyflow/system'],
    });
    // Nothing reached directly may also be listed as reached indirectly.
    for (const reach of indirect) {
      expect(pr!.directPackages).not.toContain(reach.package);
    }
  });

  it('records real per-file line counts and leaves out-of-package files unowned', async () => {
    const snapshot = await ingestFromFixture();
    const pr = snapshot.pullRequests.find((p) => p.number === 5992);
    expect(pr, 'PR 5992 must be inside the captured window').toBeDefined();

    // Every captured file carries the additions/deletions GitHub reported.
    for (const f of pr!.files) {
      expect(Number.isInteger(f.additions)).toBe(true);
      expect(Number.isInteger(f.deletions)).toBe(true);
    }
    // A release PR touches .changeset/ files, which belong to no package.
    expect(pr!.files.some((f) => f.package === null)).toBe(true);
    // …and package files, which do.
    expect(pr!.files.some((f) => f.package !== null)).toBe(true);
  });

  it('spans more than one package for a real cross-package pull request', async () => {
    const snapshot = await ingestFromFixture();
    const spanning = snapshot.pullRequests.filter((p) => p.directPackages.length > 1);
    expect(spanning.length).toBeGreaterThan(0);
  });
});
