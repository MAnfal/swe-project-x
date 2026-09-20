'use client';

import { ChevronRightIcon } from 'lucide-react';
import { cn } from 'cn';

import { ChangeCard } from '@/components/canvas/change-card';
import { EmptyPackage } from '@/components/canvas/empty-package';
import type { ChangeSummary, DateRange, HistoryBounds, PackageActivity, WindowView } from '@/lib/view/derive';

/**
 * Level 2 (design page 5): the changes that reached one package in the selected range.
 *
 * A card list anchored to the package, not a graph of pull-request nodes — the approach
 * note is a sentence and needs room to be read. The package card sits at the left, the
 * change cards run down the middle, and `Also touched` lists the other packages with
 * activity so the reader can move sideways without collapsing first.
 *
 * Plain DOM rather than React Flow: there is nothing to lay out here. A list, a sidebar
 * and a header are what the design draws, and a graph engine would cost a second layout
 * pass, a second focus model and a second scroll container for no gain a reader can see.
 */

const dayMonth = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

type ChangesLevelProps = {
  view: WindowView;
  activity: PackageActivity;
  changes: ChangeSummary[];
  range: DateRange;
  history: HistoryBounds;
  onOpenChange: (number: number) => void;
  onOpenPackage: (packageName: string) => void;
  onCollapse: () => void;
  onRangeChange: (range: DateRange) => void;
};

/** The swatch the legend and the Level 1 nodes already use, repeated in the sidebar. */
function StateSwatch({ state }: { state: PackageActivity['state'] }) {
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

export function ChangesLevel({
  view,
  activity,
  changes,
  range,
  history,
  onOpenChange,
  onOpenPackage,
  onCollapse,
  onRangeChange,
}: ChangesLevelProps) {
  if (changes.length === 0) {
    return (
      <EmptyPackage
        packageName={activity.package}
        path={activity.path}
        range={range}
        history={history}
        changeCount={view.changeCount}
        onRangeChange={onRangeChange}
        onCollapse={onCollapse}
      />
    );
  }

  const alsoTouched = view.activity.filter(
    (entry) => entry.state !== 'untouched' && entry.package !== activity.package,
  );
  const hidden = view.packageCount - view.touchedCount;
  const indirect = changes.filter((change) => change.inclusion.kind === 'indirect');

  return (
    <div className="grid flex-1 grid-cols-1 gap-6 overflow-auto bg-muted/30 p-6 lg:grid-cols-[18rem_minmax(0,1fr)_16rem]">
      <div>
        <div className="rounded-xl border-2 border-amber-500/60 bg-card p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <StateSwatch state={activity.state} />
            {activity.package}
          </h2>
          <p className="mt-1 pl-5 font-mono text-[11px] text-muted-foreground">{activity.path}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-5 text-[11px]">
            {activity.direct > 0 ? (
              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                <span aria-hidden className="size-1.5 rounded-full bg-amber-500" />
                {activity.direct} direct
              </span>
            ) : null}
            {activity.indirectVia.map((via) => (
              <span key={via.through} className="flex items-center gap-1 text-violet-700 dark:text-violet-300">
                <span aria-hidden className="size-1.5 rounded-full bg-violet-500" />
                {via.count} via {via.through}
              </span>
            ))}
          </div>

          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            {changes.length} {changes.length === 1 ? 'change' : 'changes'} landed here between{' '}
            {dayMonth.format(Date.parse(changes[0].mergedAt))} and{' '}
            {dayMonth.format(Date.parse(changes[changes.length - 1].mergedAt))} — grouped by change, not by
            commit.
          </p>
        </div>
      </div>

      {/* The rail stands in for the design's connectors back to the package card. */}
      <ul className="space-y-4 border-l border-dashed border-muted-foreground/30 pl-6">
        {changes.map((change) => (
          <li key={change.number} className="relative">
            <span
              aria-hidden
              className="absolute top-8 -left-6 h-px w-6 border-t border-dashed border-muted-foreground/30"
            />
            <ChangeCard change={change} packageName={activity.package} onOpen={onOpenChange} />
          </li>
        ))}
      </ul>

      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <p className="mb-2 px-1 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            Also touched
          </p>
          {alsoTouched.length === 0 ? (
            <p className="px-1 pb-1 text-xs text-muted-foreground">
              No other package was touched in this window.
            </p>
          ) : (
            <ul>
              {alsoTouched.map((entry) => (
                <li key={entry.package}>
                  <button
                    type="button"
                    onClick={() => onOpenPackage(entry.package)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left text-sm',
                      'hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                    )}
                  >
                    <StateSwatch state={entry.state} />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{entry.package}</span>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {entry.direct > 0 ? `${entry.direct} direct` : `${entry.indirect} indirect`}
                    </span>
                    <ChevronRightIcon aria-hidden className="size-3 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hidden > 0 ? (
            <p className="mt-2 border-t px-1 pt-2 text-[11px] text-muted-foreground">
              {hidden} untouched {hidden === 1 ? 'package is' : 'packages are'} hidden while a package is
              expanded.
            </p>
          ) : null}
        </div>

        {indirect.length === 0 ? null : (
          <div className="rounded-xl border border-violet-500/50 bg-card p-3 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span aria-hidden className="size-1.5 rounded-full bg-violet-500" />
              Reached indirectly
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {indirect.length} of these {indirect.length === 1 ? 'changes' : 'changes'} never named{' '}
              <span className="font-mono">{activity.package}</span> in their pull request. They arrived through{' '}
              {activity.indirectVia.map((via) => via.through).join(' and ')}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
