import { describe, expect, it } from 'vitest';

import { deriveWindow } from '@/lib/view/derive';
import { NODE_HEIGHT, NODE_WIDTH, layoutGraph } from '@/lib/view/layout';

import { loadSnapshot } from './fixture';

const snapshot = loadSnapshot();
const WHOLE = { from: '2026-08-31T00:00:00Z', to: '2026-09-02T00:00:00Z' };

/** The graph the canvas hands the layout: one entry per package, plus the drawn edges. */
function graphForWholeWindow() {
  const view = deriveWindow(snapshot, WHOLE);
  return {
    nodes: view.activity.map((entry) => ({ id: entry.package })),
    edges: [
      ...view.dependencyEdges.map((edge) => ({ from: edge.from, to: edge.to })),
      ...view.reachEdges.map((edge) => ({ from: edge.from, to: edge.to })),
    ],
  };
}

describe('layoutGraph (T004)', () => {
  it('returns one positioned node per input node', () => {
    const { nodes, edges } = graphForWholeWindow();
    const positioned = layoutGraph(nodes, edges);

    expect(positioned.map((node) => node.id).sort()).toEqual(nodes.map((node) => node.id).sort());
    for (const node of positioned) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.width).toBe(NODE_WIDTH);
      expect(node.height).toBe(NODE_HEIGHT);
    }
  });

  it('separates a dependent from its dependency along the flow axis', () => {
    const positioned = layoutGraph(
      [{ id: 'app' }, { id: 'lib' }],
      [{ from: 'app', to: 'lib' }],
    );
    const app = positioned.find((node) => node.id === 'app');
    const lib = positioned.find((node) => node.id === 'lib');

    expect(app).toBeDefined();
    expect(lib).toBeDefined();
    expect((lib?.x ?? 0) - (app?.x ?? 0)).toBeGreaterThanOrEqual(NODE_WIDTH);
  });

  it('positions an isolated node rather than dropping it', () => {
    const positioned = layoutGraph([{ id: 'app' }, { id: 'lib' }, { id: 'alone' }], [{ from: 'app', to: 'lib' }]);

    expect(positioned.map((node) => node.id)).toContain('alone');
  });

  it('returns the same positions for the same input', () => {
    const { nodes, edges } = graphForWholeWindow();

    expect(layoutGraph(nodes, edges)).toEqual(layoutGraph(nodes, edges));
  });

  it('does not mutate the nodes or the edges it was given', () => {
    const { nodes, edges } = graphForWholeWindow();
    const nodesBefore = structuredClone(nodes);
    const edgesBefore = structuredClone(edges);

    layoutGraph(nodes, edges);

    expect(nodes).toEqual(nodesBefore);
    expect(edges).toEqual(edgesBefore);
  });

  it('ignores an edge whose endpoint is not in the node list', () => {
    const positioned = layoutGraph([{ id: 'app' }], [{ from: 'app', to: 'missing' }]);

    expect(positioned.map((node) => node.id)).toEqual(['app']);
  });

  it('does not let a dangling edge shift the nodes that are in the list', () => {
    // dagre's `setEdge` conjures a node for an unknown endpoint and ranks it. A phantom
    // *source* takes rank 0 and pushes the real graph a whole rank to the right, so the
    // returned ids alone cannot tell "phantom dropped" from "phantom created" — the
    // positions can.
    const nodes = [{ id: 'app' }, { id: 'lib' }];
    const real = [{ from: 'app', to: 'lib' }];

    expect(layoutGraph(nodes, [{ from: 'ghost', to: 'app' }, ...real])).toEqual(layoutGraph(nodes, real));
  });

  it('returns nothing for an empty graph', () => {
    expect(layoutGraph([], [])).toEqual([]);
  });
});
