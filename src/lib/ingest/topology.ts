import { assertSafeKey, type PackageEdge, type PackageNode } from '../snapshot.ts';

/**
 * Workspace topology for a TypeScript monorepo: one node per workspace package, one edge
 * per declared dependency on another package in the same repository.
 *
 * Deliberately one function body rather than a provider interface. A second ecosystem
 * replaces the body; it does not need a plugin system to do so.
 */

export type Topology = { nodes: PackageNode[]; edges: PackageEdge[] };

/** Used only when the repository declares no workspace of its own. */
export const DEFAULT_WORKSPACE_PATTERNS: readonly string[] = ['apps/*', 'packages/*'];

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const satisfies readonly PackageEdge['kind'][];

/**
 * The workspace globs the repository actually declares, preferring pnpm's workspace file
 * and falling back to `workspaces` in the root manifest, then to the conventional pair.
 */
export function workspacePatterns(input: {
  pnpmWorkspace: string | null;
  rootManifest: string | null;
}): string[] {
  const fromPnpm = input.pnpmWorkspace ? parsePnpmWorkspacePackages(input.pnpmWorkspace) : [];
  if (fromPnpm.length > 0) return fromPnpm;

  const fromManifest = input.rootManifest ? parseManifestWorkspaces(input.rootManifest) : [];
  if (fromManifest.length > 0) return fromManifest;

  return [...DEFAULT_WORKSPACE_PATTERNS];
}

/**
 * Reads the `packages:` list out of a pnpm workspace file.
 *
 * This is a list-of-strings reader rather than a YAML parser: `pnpm-workspace.yaml` is a
 * top-level `packages:` key followed by `- 'glob'` items, and the project has no YAML
 * dependency. A workspace file using anchors, flow sequences or multi-line scalars for
 * that key would not be read, and the caller falls back to the root manifest.
 */
function parsePnpmWorkspacePackages(text: string): string[] {
  const globs: string[] = [];
  let inPackages = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trimEnd();
    if (line.trim().length === 0) continue;

    if (/^packages\s*:/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;

    const item = /^\s+-\s*(.+)$/.exec(line);
    if (!item) break; // a new top-level key ends the list
    globs.push(item[1].trim().replace(/^['"]|['"]$/g, ''));
  }

  return globs.filter((glob) => glob.length > 0);
}

function parseManifestWorkspaces(text: string): string[] {
  const manifest = parseJson(text, 'root package.json');
  const workspaces = (manifest as { workspaces?: unknown }).workspaces;
  if (Array.isArray(workspaces)) return workspaces.filter((w): w is string => typeof w === 'string');
  if (workspaces && typeof workspaces === 'object') {
    const packages = (workspaces as { packages?: unknown }).packages;
    if (Array.isArray(packages)) return packages.filter((p): p is string => typeof p === 'string');
  }
  return [];
}

/**
 * The manifest paths in `treePaths` that sit inside a declared workspace directory,
 * sorted. `node_modules` is never a workspace, whatever the globs say.
 */
export function workspaceManifestPaths(treePaths: readonly string[], patterns: readonly string[]): string[] {
  const matchers = patterns.map(globToRegExp);
  const matched = treePaths.filter((path) => {
    if (!path.endsWith('/package.json')) return false;
    if (path.split('/').includes('node_modules')) return false;
    const directory = path.slice(0, -'/package.json'.length);
    return matchers.some((matcher) => matcher.test(directory));
  });
  return [...new Set(matched)].sort();
}

/** `packages/*` matches one segment; `packages/**` matches one or more. */
function globToRegExp(glob: string): RegExp {
  const source = glob
    .replace(/\/+$/, '')
    .split('/')
    .map((segment) => {
      if (segment === '**') return '.+';
      if (segment === '*') return '[^/]+';
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return new RegExp(`^${source}$`);
}

/**
 * One node per manifest and one edge per declared dependency on another node.
 *
 * Declared dependencies only — import statements are never scanned. All four dependency
 * fields count, and the field is kept on the edge so a consumer can distinguish a runtime
 * dependency from a build-time one without re-reading manifests.
 */
export function discoverTopology(input: {
  manifests: readonly { path: string; text: string }[];
}): Topology {
  const nodes: PackageNode[] = [];
  const seen = new Set<string>();

  for (const manifest of input.manifests) {
    const parsed = parseJson(manifest.text, manifest.path) as { name?: unknown };
    if (typeof parsed.name !== 'string' || parsed.name.length === 0) continue; // a private, unnamed manifest is not a package

    // Package names come from repository content and become record keys downstream.
    assertSafeKey(parsed.name, 'package name');
    if (seen.has(parsed.name)) {
      throw new Error(`duplicate package name "${parsed.name}" declared by ${manifest.path}`);
    }
    seen.add(parsed.name);

    nodes.push({
      name: parsed.name,
      path: manifest.path.slice(0, -'/package.json'.length),
      manifestPath: manifest.path,
    });
  }

  const edges: PackageEdge[] = [];
  for (const manifest of input.manifests) {
    const parsed = parseJson(manifest.text, manifest.path) as Record<string, unknown>;
    const from = parsed.name;
    if (typeof from !== 'string' || !seen.has(from)) continue;

    for (const kind of DEPENDENCY_FIELDS) {
      const declared = parsed[kind];
      if (!declared || typeof declared !== 'object') continue;
      for (const to of Object.keys(declared)) {
        if (to === from || !seen.has(to)) continue; // only edges between packages in this repository
        edges.push({ from, to, kind });
      }
    }
  }

  nodes.sort((a, b) => a.name.localeCompare(b.name));
  edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.kind.localeCompare(b.kind));
  return { nodes, edges };
}

function parseJson(text: string, what: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`${what} is not valid JSON: ${(error as Error).message}`);
  }
}
