'use client';

import { ClockIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { DateRange, HistoryBounds } from '@/lib/view/derive';
import { presetRange } from '@/lib/view/derive';

/**
 * What the canvas says when the selected range contains nothing.
 *
 * Not an empty canvas: the packages stay dimmed behind this card, and the card says how
 * many of them there are, so "nothing landed" reads as a fact about the window rather
 * than as a failure to load.
 */

type EmptyWindowProps = {
  repository: string;
  range: DateRange;
  history: HistoryBounds;
  packageCount: number;
  /** The nearest range of the same width that does contain activity, if there is one. */
  nearest: { range: DateRange; changeCount: number } | null;
  onRangeChange: (range: DateRange) => void;
};

const dayMonth = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dayMonthYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function EmptyWindow({
  repository,
  range,
  history,
  packageCount,
  nearest,
  onRangeChange,
}: EmptyWindowProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
      <div
        role="status"
        className="pointer-events-auto w-full max-w-lg rounded-xl border bg-card p-6 shadow-lg"
      >
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ClockIcon aria-hidden className="size-5 text-muted-foreground" />
          Nothing landed in this window
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          No pull requests touched any package in <span className="font-mono text-foreground">{repository}</span>{' '}
          between <span className="font-mono text-foreground">{dayMonth.format(Date.parse(range.from))}</span> and{' '}
          <span className="font-mono text-foreground">{dayMonthYear.format(Date.parse(range.to))}</span>. All{' '}
          {packageCount} packages are dimmed because none were reached, directly or otherwise.
        </p>

        {nearest === null ? null : (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-4">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Nearest activity</p>
              <p className="mt-1 font-mono text-sm">
                {dayMonth.format(Date.parse(nearest.range.from))} –{' '}
                {dayMonth.format(Date.parse(nearest.range.to))} · {nearest.changeCount}{' '}
                {nearest.changeCount === 1 ? 'change' : 'changes'}
              </p>
            </div>
            <Button onClick={() => onRangeChange(nearest.range)}>Jump to that window</Button>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Or widen:</span>
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
