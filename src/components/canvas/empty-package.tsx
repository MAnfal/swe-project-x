'use client';

import { PackageOpenIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { DateRange, HistoryBounds } from '@/lib/view/derive';
import { presetRange } from '@/lib/view/derive';

/**
 * Level 2 with nothing in it: the package is real, the range is real, and no change
 * reached it.
 *
 * Distinct from `EmptyWindow`, which says nothing landed *anywhere* in the repository.
 * This one names the package and says the rest of the repository may well have been busy,
 * because those are different facts and conflating them sends the reader hunting for a
 * loading bug.
 */

type EmptyPackageProps = {
  packageName: string;
  path: string;
  range: DateRange;
  history: HistoryBounds;
  /** Changes that landed elsewhere in the repository in the same range. */
  changeCount: number;
  onRangeChange: (range: DateRange) => void;
  onCollapse: () => void;
};

const dayMonth = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dayMonthYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function EmptyPackage({
  packageName,
  path,
  range,
  history,
  changeCount,
  onRangeChange,
  onCollapse,
}: EmptyPackageProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div role="status" className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-lg">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <PackageOpenIcon aria-hidden className="size-5 text-muted-foreground" />
          Nothing reached <span className="font-mono">{packageName}</span>
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          No change touched <span className="font-mono text-foreground">{path}</span>, or reached it through a
          dependency, between{' '}
          <span className="font-mono text-foreground">{dayMonth.format(Date.parse(range.from))}</span> and{' '}
          <span className="font-mono text-foreground">{dayMonthYear.format(Date.parse(range.to))}</span>.
          {changeCount > 0
            ? ` ${changeCount} ${changeCount === 1 ? 'change' : 'changes'} landed elsewhere in the repository in
               the same window.`
            : ' Nothing landed anywhere in the repository in that window either.'}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
          <Button variant="outline" size="sm" onClick={onCollapse}>
            Back to the map
          </Button>
          <span className="text-muted-foreground">or widen:</span>
          <Button variant="outline" size="sm" onClick={() => onRangeChange(presetRange(history, '90d'))}>
            Last 90 days
          </Button>
          <Button variant="outline" size="sm" onClick={() => onRangeChange(presetRange(history, 'all'))}>
            All time
          </Button>
        </div>
      </div>
    </div>
  );
}
