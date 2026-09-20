import { describe, expect, it } from 'vitest';

import { discoverRepositoryTopology } from '@/lib/ingest/ingest';
import {
  DEFAULT_WORKSPACE_PATTERNS,
  discoverTopology,
  workspaceManifestPaths,
  workspacePatterns,
} from '@/lib/ingest/topology';

import { replayClient, XYFLOW } from './fixtures/replay';

const manifest = (name: string, deps: Record<string, string> = {}, devDeps: Record<string, string> = {}) =>
  JSON.stringify({ name, dependencies: deps, devDependencies: devDeps });

describe('workspacePatterns', () => {
  it('reads the globs out of a pnpm workspace file', () => {
    const text = ["packages:", "  - 'packages/*'", "  - 'examples/*'", '', '# a comment'].join('\n');
    expect(workspacePatterns({ pnpmWorkspace: text, rootManifest: null })).toEqual(['packages/*', 'examples/*']);
  });

  it('reads the globs out of a root package.json workspaces array', () => {
    expect(workspacePatterns({ pnpmWorkspace: null, rootManifest: '{"workspaces":["apps/*","libs/*"]}' }))
      .toEqual(['apps/*', 'libs/*']);
  });

  it('reads the globs out of a root package.json workspaces object', () => {
    expect(workspacePatterns({ pnpmWorkspace: null, rootManifest: '{"workspaces":{"packages":["a/*"]}}' }))
      .toEqual(['a/*']);
  });

  it('falls back to apps/* and packages/* when the repository declares no workspace', () => {
    expect(workspacePatterns({ pnpmWorkspace: null, rootManifest: '{"name":"x"}' }))
      .toEqual(DEFAULT_WORKSPACE_PATTERNS);
  });
});

describe('workspaceManifestPaths', () => {
  it('keeps only manifests that sit directly inside a declared workspace directory', () => {
    const tree = [
      'package.json',
      'packages/a/package.json',
      'packages/a/src/nested/package.json',
      'apps/web/package.json',
      'docs/package.json',
      'node_modules/dep/package.json',
    ];
    expect(workspaceManifestPaths(tree, ['packages/*', 'apps/*'])).toEqual([
      'apps/web/package.json',
      'packages/a/package.json',
    ]);
  });

  it('matches a ** glob across nested directories but never inside node_modules', () => {
    const tree = ['packages/a/b/package.json', 'packages/a/node_modules/x/package.json'];
    expect(workspaceManifestPaths(tree, ['packages/**'])).toEqual(['packages/a/b/package.json']);
  });
});

describe('discoverTopology', () => {
  it('creates a node per manifest and an edge for a declared workspace dependency', () => {
    const topology = discoverTopology({
      manifests: [
        { path: 'packages/a/package.json', text: manifest('a', { b: 'workspace:*' }) },
        { path: 'packages/b/package.json', text: manifest('b') },
      ],
    });
    expect(topology.nodes).toEqual([
      { name: 'a', path: 'packages/a', manifestPath: 'packages/a/package.json' },
      { name: 'b', path: 'packages/b', manifestPath: 'packages/b/package.json' },
    ]);
    expect(topology.edges).toEqual([{ from: 'a', to: 'b', kind: 'dependencies' }]);
  });

  it('creates an edge for a workspace dependency declared under devDependencies', () => {
    const topology = discoverTopology({
      manifests: [
        { path: 'packages/a/package.json', text: manifest('a', {}, { b: 'workspace:*' }) },
        { path: 'packages/b/package.json', text: manifest('b') },
      ],
    });
    // The edge kind is kept so a consumer can tell build-time coupling from runtime,
    // but a devDependency on a workspace package is still an edge.
    expect(topology.edges).toEqual([{ from: 'a', to: 'b', kind: 'devDependencies' }]);
  });

  it('creates no edge for a dependency that is not another node in this repository', () => {
    const topology = discoverTopology({
      manifests: [{ path: 'packages/a/package.json', text: manifest('a', { react: '^19.0.0' }) }],
    });
    expect(topology.edges).toEqual([]);
  });

  it('rejects a manifest whose name is a reserved object key', () => {
    expect(() =>
      discoverTopology({ manifests: [{ path: 'packages/a/package.json', text: manifest('__proto__') }] }),
    ).toThrow(/reserved/i);
  });

  it('rejects two manifests declaring the same package name', () => {
    expect(() =>
      discoverTopology({
        manifests: [
          { path: 'packages/a/package.json', text: manifest('same') },
          { path: 'packages/b/package.json', text: manifest('same') },
        ],
      }),
    ).toThrow(/duplicate/i);
  });
});

describe('discoverRepositoryTopology over captured xyflow/xyflow responses', () => {
  it('discovers the real workspace packages and their real declared edges', async () => {
    const { topology, patterns } = await discoverRepositoryTopology(replayClient(), XYFLOW.ref, XYFLOW.branch);

    // The globs really declared in xyflow/xyflow's pnpm-workspace.yaml.
    expect(patterns).toEqual(['packages/*', 'examples/*', 'tooling/*', 'tests/*']);

    const names = topology.nodes.map((n) => n.name);
    expect(names).toContain('@xyflow/react');
    expect(names).toContain('@xyflow/svelte');
    expect(names).toContain('@xyflow/system');

    expect(topology.nodes.find((n) => n.name === '@xyflow/react')?.path).toBe('packages/react');

    // Real declared edge: packages/react depends on @xyflow/system.
    expect(topology.edges).toContainEqual({ from: '@xyflow/react', to: '@xyflow/system', kind: 'dependencies' });
    // Real declared edge two hops from system, via svelte.
    expect(topology.edges).toContainEqual({ from: 'svelte-examples', to: '@xyflow/svelte', kind: 'dependencies' });
    // `react` itself is an npm dependency of @xyflow/react, not a workspace package here.
    expect(topology.edges.filter((e) => e.to === 'react')).toEqual([]);

    // Nearly half the real graph comes from devDependencies — 6 of 13 edges — and the
    // canvas draws them. Dropping that field would silently halve the topology.
    expect(topology.edges).toContainEqual({
      from: '@xyflow/react',
      to: '@xyflow/tsconfig',
      kind: 'devDependencies',
    });
    const byKind = topology.edges.reduce<Record<string, number>>((acc, e) => {
      acc[e.kind] = (acc[e.kind] ?? 0) + 1;
      return acc;
    }, {});
    expect(byKind).toEqual({ dependencies: 7, devDependencies: 6 });
  });
});
