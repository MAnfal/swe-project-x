import { buildRecord, type IndirectReach, type PackageNode } from '../snapshot.ts';
import type { Topology } from './topology.ts';

/**
 * Which packages a pull request reached.
 *
 * Direct    — the pull request changed a file inside the package.
 * Indirect  — the package's dependency closure contains a directly-touched package. The
 *             chain that reached it is recorded so the canvas can say "2 via Package 2".
 *
 * A package that is both is direct.
 */

export type Attribution = { direct: string[]; indirect: IndirectReach[] };

/** Everything the attribution needs from a changed file. */
export type AttributableFile = { path: string };

/**
 * The package that owns a file, by longest matching package path, or null when the file
 * sits outside every package. The match is on path segments, so `packages/b` does not
 * claim `packages/beta/...`.
 */
export function ownerOfFile(filePath: string, nodes: readonly PackageNode[]): string | null {
  let best: PackageNode | null = null;
  for (const node of nodes) {
    if (!filePath.startsWith(`${node.path}/`)) continue;
    if (best === null || node.path.length > best.path.length) best = node;
  }
  return best?.name ?? null;
}

/**
 * For each package in `roots`, every package that transitively depends on it, with the
 * shortest dependency chain that reaches it.
 *
 * Computed once per snapshot over the touched packages, not once per pull request. The
 * returned record is keyed by repository-derived package names, so it is built on a null
 * prototype with the reserved-key and duplicate checks applied.
 */
export function buildReverseClosure(
  topology: Topology,
  roots: readonly string[],
): Record<string, IndirectReach[]> {
  const dependents = new Map<string, string[]>();
  for (const edge of topology.edges) {
    // edge.from depends on edge.to, so edge.from is a dependent of edge.to.
    const list = dependents.get(edge.to);
    if (list) {
      if (!list.includes(edge.from)) list.push(edge.from);
    } else {
      dependents.set(edge.to, [edge.from]);
    }
  }
  // Sorting the adjacency makes the breadth-first walk — and so every recorded path —
  // independent of the order the edges happened to be discovered in.
  for (const list of dependents.values()) list.sort((a, b) => a.localeCompare(b));

  const unique = [...new Set(roots)].sort((a, b) => a.localeCompare(b));
  return buildRecord(
    unique.map((root) => [root, reachDependents(root, dependents)] as const),
    'package name',
  );
}

/** Breadth-first over reverse edges: shortest chain wins, ties broken by sorted adjacency. */
function reachDependents(root: string, dependents: Map<string, string[]>): IndirectReach[] {
  const paths = new Map<string, string[]>([[root, [root]]]);
  const queue: string[] = [root];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const currentPath = paths.get(current) as string[];
    for (const dependent of dependents.get(current) ?? []) {
      if (paths.has(dependent)) continue; // a shorter chain already reached it
      paths.set(dependent, [dependent, ...currentPath]);
      queue.push(dependent);
    }
  }

  paths.delete(root);
  return [...paths.entries()]
    .map(([name, path]) => ({ package: name, through: root, path }))
    .sort((a, b) => a.package.localeCompare(b.package));
}

/**
 * The packages one pull request reached, given its changed files and the closure built
 * for the snapshot.
 */
export function attributePullRequest(
  files: readonly AttributableFile[],
  nodes: readonly PackageNode[],
  closure: Record<string, IndirectReach[]>,
): Attribution {
  const direct = [...new Set(files.flatMap((file) => ownerOfFile(file.path, nodes) ?? []))].sort((a, b) =>
    a.localeCompare(b),
  );
  const directSet = new Set(direct);

  // One entry per indirectly-reached package, so `indirectPackages.length` is the number
  // of packages reached indirectly — which is what the node badge counts. When several
  // touched packages reach the same one, the shortest chain represents it, ties broken by
  // the name of the package it came through so the choice does not depend on edge order.
  const best = new Map<string, IndirectReach>();
  for (const touched of direct) {
    for (const reach of closure[touched] ?? []) {
      if (directSet.has(reach.package)) continue; // direct wins
      const incumbent = best.get(reach.package);
      if (incumbent === undefined || isShorterChain(reach, incumbent)) best.set(reach.package, reach);
    }
  }

  const indirect = [...best.values()].sort((a, b) => a.package.localeCompare(b.package));
  return { direct, indirect };
}

function isShorterChain(candidate: IndirectReach, incumbent: IndirectReach): boolean {
  if (candidate.path.length !== incumbent.path.length) return candidate.path.length < incumbent.path.length;
  return candidate.through.localeCompare(incumbent.through) < 0;
}
