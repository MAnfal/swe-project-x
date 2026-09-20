'use client';

import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  type Edge,
} from '@xyflow/react';
import { ArrowRightIcon } from 'lucide-react';
import { cn } from 'cn';
import { useCallback, useEffect, useMemo } from 'react';

import { neighbourhood, type WindowView } from '@/lib/view/derive';
import { layoutGraph } from '@/lib/view/layout';
import { packageNodeTypes, type PackageFlowNode } from '@/components/canvas/package-node';

import '@xyflow/react/dist/style.css';

/**
 * The Level 1 topology: every package as a node, edges only between touched ones.
 *
 * The graph is derived above and positioned by `layoutGraph`; this component owns the one
 * React Flow instance and nothing else. Positions are never computed during render — the
 * layout is memoized on the derived view and the focus.
 */

type TopologyCanvasProps = {
  view: WindowView;
  /** The package whose neighbourhood is shown alone, or null for the whole graph. */
  focused: string | null;
  onFocus: (packageName: string | null) => void;
  /** Opens Level 2 for a package. Design page 4: the focused node offers it, `→` fires it. */
  onExpand: (packageName: string) => void;
};

const EDGE_DEPENDENCY = 'oklch(0.6 0.02 260)';
const EDGE_REACH = 'oklch(0.55 0.21 295)';

/** The minimap repeats the legend's encoding rather than painting every node grey. */
const MINIMAP_COLORS = {
  direct: 'oklch(0.77 0.16 70)',
  indirect: 'oklch(0.6 0.21 295)',
  untouched: 'oklch(0.85 0 0)',
} as const;

export function TopologyCanvas({ view, focused, onFocus, onExpand }: TopologyCanvasProps) {
  const toggleFocus = useCallback(
    (packageName: string) => onFocus(packageName === focused ? null : packageName),
    [focused, onFocus],
  );

  // The keyboard model design page 4 prints in the level indicator: `→` expands the
  // focused package, `←` and Escape leave focus mode. Neither fires while a text field has
  // focus, so chunk 06's repository URL input is not hijacked by them.
  useEffect(() => {
    if (focused === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(target.tagName))) {
        return;
      }
      if (event.key === 'Escape' || event.key === 'ArrowLeft') onFocus(null);
      if (event.key === 'ArrowRight') onExpand(focused);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focused, onFocus, onExpand]);

  const focusedActivity = focused === null ? null : view.activity.find((entry) => entry.package === focused);
  const focusedChanges = (focusedActivity?.direct ?? 0) + (focusedActivity?.indirect ?? 0);

  const { nodes, edges } = useMemo(() => {
    const near = focused === null ? null : neighbourhood(view, focused);
    const visible = view.activity.filter((entry) => near === null || near.has(entry.package));

    const graphEdges = [
      ...view.dependencyEdges.map((edge) => ({ from: edge.from, to: edge.to, kind: 'dependency' as const, count: 0 })),
      ...view.reachEdges.map((edge) => ({ from: edge.from, to: edge.to, kind: 'reach' as const, count: edge.count })),
    ].filter((edge) => near === null || (near.has(edge.from) && near.has(edge.to)));

    const positions = layoutGraph(
      visible.map((entry) => ({ id: entry.package })),
      graphEdges,
    );

    const flowNodes: PackageFlowNode[] = positions.map((position, index) => {
      const entry = visible[index];
      return {
        id: entry.package,
        type: 'package',
        position: { x: position.x, y: position.y },
        // React Flow cannot measure a node it has not rendered, so the size dagre used is
        // declared here too — which is also what lets the first `fitView` frame the graph.
        width: position.width,
        height: position.height,
        draggable: false,
        data: {
          label: entry.package,
          path: entry.path,
          state: entry.state,
          direct: entry.direct,
          indirectVia: entry.indirectVia,
          focused: entry.package === focused,
          onToggleFocus: toggleFocus,
        },
      };
    });

    const flowEdges: Edge[] = graphEdges.map((edge) => ({
      id: `${edge.kind}:${edge.from}->${edge.to}`,
      source: edge.from,
      target: edge.to,
      // A reach is dashed and violet; a declared dependency is solid and grey. The count
      // and the package it came through are spelled out on the target node's badge rather
      // than on the edge — the designs leave the edges unlabelled, and a label per reach
      // makes the graph unreadable at anything but full zoom.
      ariaLabel:
        edge.kind === 'reach'
          ? `${edge.count} ${edge.count === 1 ? 'change' : 'changes'} reached ${edge.to} via ${edge.from}`
          : `${edge.from} depends on ${edge.to}`,
      style:
        edge.kind === 'reach'
          ? { stroke: EDGE_REACH, strokeWidth: 1.5, strokeDasharray: '6 4' }
          : { stroke: EDGE_DEPENDENCY, strokeWidth: 1.5 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: edge.kind === 'reach' ? EDGE_REACH : EDGE_DEPENDENCY,
      },
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [view, focused, toggleFocus]);

  return (
    <ReactFlow<PackageFlowNode>
      nodes={nodes}
      edges={edges}
      nodeTypes={packageNodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      // Each node body is its own <button>, so React Flow's wrapper must stay out of the
      // tab order — two stops per node would make the canvas twice as long to traverse.
      nodesFocusable={false}
      edgesFocusable={false}
      onPaneClick={() => onFocus(null)}
      className="bg-muted/30"
      aria-label="Package topology"
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        nodeStrokeWidth={2}
        nodeColor={(node) => MINIMAP_COLORS[(node.data as PackageFlowNode['data']).state]}
        className="!bg-card"
      />

      <Panel position="top-left">
        <div className="rounded-lg border bg-card/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
          <p className="mb-1.5 font-medium tracking-wide text-muted-foreground uppercase">Legend</p>
          <ul className="space-y-1">
            <li className="flex items-center gap-2">
              <span aria-hidden className="size-3 rounded-[3px] bg-amber-500" />
              Touched directly
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="size-3 rounded-[3px] bg-violet-500" />
              Touched via a dependency
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="size-3 rounded-[3px] border border-dashed border-muted-foreground" />
              Untouched in this window
            </li>
          </ul>
        </div>
      </Panel>

      {focused === null ? null : (
        <Panel position="top-center">
          <div className="flex flex-col items-center gap-2">
            <div
              role="status"
              className="flex items-center gap-2 rounded-full border border-amber-500/60 bg-card/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur"
            >
              <span aria-hidden className="size-1.5 rounded-full bg-amber-500" />
              Focused on <span className="font-medium">{focused}</span> — showing its neighbours only
              <kbd className="rounded border px-1 font-mono text-[10px] text-muted-foreground">Esc</kbd>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onExpand(focused)}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-medium shadow-sm',
                  'hover:border-amber-500/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                )}
              >
                Expand {focusedChanges} {focusedChanges === 1 ? 'change' : 'changes'}
                <ArrowRightIcon aria-hidden className="size-3" />
              </button>
              <span className="font-mono text-[11px] text-muted-foreground">or press →</span>
            </div>
          </div>
        </Panel>
      )}
    </ReactFlow>
  );
}
