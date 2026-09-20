'use client';

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { cn } from 'cn';

import type { IndirectVia, PackageState } from '@/lib/view/derive';

/**
 * One package on the Level 1 canvas.
 *
 * Three distinctions are drawn here, and none of them rests on hue:
 *
 * - touched vs untouched — an untouched node is dimmed (`opacity`) and its border is
 *   `dashed` rather than `solid`; the colour change rides along with those.
 * - direct vs indirect — the badge spells out "4 direct" and "2 via @xyflow/system", so
 *   the amber and violet dots are a second encoding of something already in the text.
 * - focused — a ring plus a heavier border, announced by `aria-pressed`.
 *
 * The node's body is a real `<button>`, which is what makes focus reachable from the
 * keyboard: Enter and Space fire a click natively. React Flow's own node focus ring is
 * turned off at the canvas (`nodesFocusable={false}`) so the tab order has one stop here.
 */

export type PackageNodeData = {
  label: string;
  path: string;
  state: PackageState;
  direct: number;
  indirectVia: IndirectVia[];
  focused: boolean;
  onToggleFocus: (packageName: string) => void;
};

export type PackageFlowNode = Node<PackageNodeData, 'package'>;

/** The square swatch beside the name. Matches the legend. */
function StateSwatch({ state }: { state: PackageState }) {
  return (
    <span
      aria-hidden
      className={cn(
        'size-3 shrink-0 rounded-[3px] border',
        state === 'direct' && 'border-amber-500 bg-amber-500',
        state === 'indirect' && 'border-violet-500 bg-violet-500',
        state === 'untouched' && 'border-dashed border-muted-foreground bg-transparent',
      )}
    />
  );
}

/** What a screen reader hears, and what the badge row spells out for everyone else. */
function reachSummary(data: PackageNodeData): string {
  if (data.state === 'untouched') return 'untouched in this window';
  const parts: string[] = [];
  if (data.direct > 0) parts.push(`${data.direct} direct`);
  for (const via of data.indirectVia) parts.push(`${via.count} via ${via.through}`);
  return parts.join(', ');
}

export function PackageNode({ data }: NodeProps<PackageFlowNode>) {
  const untouched = data.state === 'untouched';

  return (
    <button
      type="button"
      data-slot="package-node"
      data-state={data.state}
      aria-pressed={data.focused}
      aria-label={`${data.label} — ${reachSummary(data)}`}
      onClick={() => data.onToggleFocus(data.label)}
      className={cn(
        'flex h-24 w-54 cursor-pointer flex-col justify-center gap-1 rounded-xl border px-3 py-2 text-left transition-all',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        untouched
          ? // Non-colour carriers of "untouched": a dashed border and reduced opacity.
            'border-dashed border-muted-foreground/50 bg-transparent opacity-45'
          : 'border-solid bg-card shadow-sm',
        !untouched && data.state === 'direct' && 'border-amber-500/60',
        !untouched && data.state === 'indirect' && 'border-violet-500/60',
        data.focused && 'border-2 ring-2 ring-amber-500/70',
      )}
    >
      <Handle type="target" position={Position.Left} className="!size-1 !border-0 !bg-transparent" />

      <div className="flex items-center gap-2">
        <StateSwatch state={data.state} />
        <span className={cn('truncate text-sm font-semibold', untouched && 'font-normal text-muted-foreground')}>
          {data.label}
        </span>
      </div>
      <span className="truncate pl-5 font-mono text-[11px] text-muted-foreground">{data.path}</span>

      {untouched ? null : (
        <div aria-hidden className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-5 text-[11px]">
          {data.direct > 0 ? (
            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
              <span className="size-1.5 rounded-full bg-amber-500" />
              {data.direct} direct
            </span>
          ) : null}
          {data.indirectVia.map((via) => (
            <span key={via.through} className="flex items-center gap-1 text-violet-700 dark:text-violet-300">
              <span className="size-1.5 rounded-full bg-violet-500" />
              {via.count} via {via.through}
            </span>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!size-1 !border-0 !bg-transparent" />
    </button>
  );
}

/** Registered once at module scope; a new object each render remounts every node. */
export const packageNodeTypes = { package: PackageNode };
