import { Graph, layout, type EdgeLabel, type GraphLabel, type NodeLabel } from '@dagrejs/dagre';

/**
 * Node positioning, kept out of the render path.
 *
 * dagre reports a node's centre; React Flow positions a node by its top-left corner, so
 * the conversion happens once, here, rather than in every component that reads a
 * position. dagre 3.1.1 does not lay out sub-flows — chunk 05 reveals deeper levels by
 * replacing the view rather than nesting inside a node, which is what keeps it viable.
 */

/** Fixed node dimensions. React Flow cannot measure a node it has not rendered yet, and
 * dagre needs a size before it can place one, so both read these. */
export const NODE_WIDTH = 216;
export const NODE_HEIGHT = 96;

export type GraphNode = { id: string };
export type GraphEdge = { from: string; to: string };

export type LayoutNode = { id: string; x: number; y: number; width: number; height: number };

export type LayoutOptions = {
  /** Left-to-right reads as flow: a dependency sits to the right of what depends on it. */
  rankdir?: 'TB' | 'BT' | 'LR' | 'RL';
  nodesep?: number;
  ranksep?: number;
};

/**
 * Positions `nodes` with dagre and returns them in the order they were given.
 *
 * Pure: the inputs are not mutated and the same inputs return the same positions. An edge
 * naming a node that is not in the list is dropped rather than conjuring a phantom node —
 * dagre's `setEdge` would otherwise create one and lay it out.
 */
export function layoutGraph(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  options: LayoutOptions = {},
): LayoutNode[] {
  if (nodes.length === 0) return [];

  // Measured against @dagrejs/dagre 3.1.1: the package's default export carries
  // `{graphlib, version, layout, debug, util}` and **not** `Graph`, so `dagre.Graph` is
  // undefined and only the named exports work.
  const graph = new Graph<GraphLabel, NodeLabel, EdgeLabel>({ multigraph: false, compound: false });
  graph.setGraph({
    rankdir: options.rankdir ?? 'LR',
    nodesep: options.nodesep ?? 48,
    ranksep: options.ranksep ?? 140,
    marginx: 48,
    marginy: 48,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  const known = new Set(nodes.map((node) => node.id));
  for (const node of nodes) graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const edge of edges) {
    if (edge.from === edge.to) continue; // a self-edge has no layout meaning here
    if (!known.has(edge.from) || !known.has(edge.to)) continue;
    graph.setEdge(edge.from, edge.to);
  }

  layout(graph);

  return nodes.map((node) => {
    const placed = graph.node(node.id);
    return {
      id: node.id,
      // dagre's x/y is the centre; React Flow's position is the top-left corner.
      x: (placed?.x ?? 0) - NODE_WIDTH / 2,
      y: (placed?.y ?? 0) - NODE_HEIGHT / 2,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
  });
}
