'use client';

import { ClockIcon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { Slider } from '@/components/ui/slider';
import { cn } from 'cn';
import { presetRange, type DateRange, type HistoryBounds, type Preset, type VolumeBucket } from '@/lib/view/derive';

/**
 * The range control that drives everything above it.
 *
 * Two handles, always — there is no single-date mode — with the selected range spelled
 * out as dates rather than left to be read off a position, the change-volume histogram
 * behind the track, and presets for the last 7 / 30 / 90 days and all time.
 *
 * The primitive is the project's existing shadcn `Slider`: it already renders one thumb
 * per element of `value`, so a two-handle range needs no new dependency.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const PRESETS: { id: Preset; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'all', label: 'All time' },
];

type TimeSliderProps = {
  history: HistoryBounds;
  range: DateRange;
  volume: VolumeBucket[];
  changeCount: number;
  touchedCount: number;
  onRangeChange: (range: DateRange) => void;
};

const dayMonth = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dayMonthYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const withTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
});

/**
 * Bar heights on a square-root scale.
 *
 * One busy release week routinely carries ten times the merges of a quiet one, and on a
 * linear scale that single bar is full height while every other bar rounds to nothing —
 * the histogram stops showing where change clusters and shows only where it peaked. The
 * square root keeps the tall bar tallest while leaving the quiet weeks legible, and a
 * non-empty bucket never renders shorter than a visible sliver.
 */
function barHeight(count: number, max: number): string {
  if (count === 0) return '2%';
  const scaled = Math.sqrt(count) / Math.sqrt(Math.max(max, 1));
  return `${Math.max(8, Math.round(scaled * 100))}%`;
}

export function TimeSlider({
  history,
  range,
  volume,
  changeCount,
  touchedCount,
  onRangeChange,
}: TimeSliderProps) {
  const [hovered, setHovered] = useState<VolumeBucket | null>(null);

  const min = Date.parse(history.from);
  const max = Date.parse(history.to);
  const from = Date.parse(range.from);
  const to = Date.parse(range.to);

  // A day-sized nudge is meaningless on a two-day capture and essential on a three-year
  // one, so the arrow-key step follows the span the slider actually covers.
  const step = max - min >= 60 * DAY_MS ? DAY_MS : HOUR_MS;
  const stepLabel = step === DAY_MS ? 'a day' : 'an hour';

  const maxCount = useMemo(() => volume.reduce((peak, bucket) => Math.max(peak, bucket.count), 0), [volume]);
  // Several presets collapse to the same range on a short history — every rolling preset
  // clamps to the whole capture. Searching from the widest end means the pill that lights
  // up is the honest one ("All time"), not whichever preset happens to be listed first.
  // Compared as instants, not as strings: the range can arrive either as a history bound
  // ("2026-09-02T00:00:00Z", straight off the snapshot) or as a slider-derived timestamp
  // ("2026-09-02T00:00:00.000Z"). Those are the same moment and must light the same pill.
  const activePreset = useMemo(
    () =>
      [...PRESETS].reverse().find((preset) => {
        const candidate = presetRange(history, preset.id);
        return Date.parse(candidate.from) === from && Date.parse(candidate.to) === to;
      })?.id ?? null,
    [history, from, to],
  );

  const controlRef = useRef<HTMLDivElement>(null);

  /**
   * Home and End jump to the repository's start and end, as design page 10's keyboard
   * hint promises.
   *
   * The primitive only gets half of this right. Measured against the installed
   * `@base-ui/react` 1.8.0, in `SliderThumb`'s keydown switch (no line number: the
   * dependency is a caret range, so a line citation here would go stale unread): on a
   * range slider `END` resolves to `sliderValues[index + 1] - step * minStepsBetweenValues`
   * when a thumb follows, and `HOME` to `sliderValues[index - 1] + step *
   * minStepsBetweenValues` when one precedes — so End on the *left* handle and Home on the
   * *right* handle clamp against the other thumb instead of jumping to the track's bound.
   * Only Home-on-left and End-on-right fall through to `min`/`max`.
   *
   * So the keys are handled here in the capture phase, before the thumb sees them, and
   * mean the same thing whichever handle has focus: Home moves the range's start to the
   * repository start, End moves its end to the repository end.
   */
  function onKeyDownCapture(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Home' && event.key !== 'End') return;
    const control = controlRef.current;
    if (control === null || !(event.target instanceof Node) || !control.contains(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    onRangeChange(event.key === 'Home' ? { from: history.from, to: range.to } : { from: range.from, to: history.to });
  }

  const spanDays = Math.max(1, Math.round((to - from) / DAY_MS));
  const sameYear = new Date(from).getUTCFullYear() === new Date(to).getUTCFullYear();

  return (
    <section
      aria-label="Time range"
      className="flex flex-col gap-2 border-t bg-card/50 px-4 py-3 backdrop-blur"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <ClockIcon aria-hidden className="size-4 shrink-0 self-center text-muted-foreground" />
          <p className="font-mono text-sm font-medium">
            {sameYear ? dayMonth.format(from) : dayMonthYear.format(from)} – {dayMonthYear.format(to)}
          </p>
          <p className="text-xs text-muted-foreground">
            {spanDays} {spanDays === 1 ? 'day' : 'days'} ·{' '}
            {changeCount === 0
              ? 'no activity'
              : `${changeCount} ${changeCount === 1 ? 'change' : 'changes'} · ${touchedCount} ${
                  touchedCount === 1 ? 'package' : 'packages'
                } touched`}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={activePreset === preset.id}
              onClick={() => onRangeChange(presetRange(history, preset.id))}
              className={cn(
                'rounded-md border px-2 py-1 text-xs transition-colors',
                'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                activePreset === preset.id
                  ? 'border-amber-500 font-medium text-amber-700 dark:text-amber-300'
                  : 'border-transparent bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {preset.label}
            </button>
          ))}
          <span
            className={cn(
              'rounded-md border px-2 py-1 text-xs',
              activePreset === null
                ? 'border-amber-500 font-medium text-amber-700 dark:text-amber-300'
                : 'border-transparent text-muted-foreground/50',
            )}
          >
            Custom
          </span>
        </div>
      </div>

      <div ref={controlRef} onKeyDownCapture={onKeyDownCapture} className="relative h-16">
        {/* The histogram sits behind the track: bars inside the range are lit, the rest muted. */}
        <div aria-hidden className="absolute inset-x-0 bottom-4 flex h-12 items-end gap-px">
          {volume.map((bucket) => {
            const inside = Date.parse(bucket.to) > from && Date.parse(bucket.from) < to;
            return (
              <div
                key={bucket.from}
                onMouseEnter={() => setHovered(bucket)}
                onMouseLeave={() => setHovered((current) => (current === bucket ? null : current))}
                className="flex h-full flex-1 items-end"
              >
                <div
                  style={{ height: barHeight(bucket.count, maxCount) }}
                  className={cn('w-full rounded-t-[2px]', inside ? 'bg-amber-500' : 'bg-muted-foreground/25')}
                />
              </div>
            );
          })}
        </div>

        {hovered === null ? null : (
          <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs shadow-md">
            <p className="font-mono">
              {withTime.format(Date.parse(hovered.from))} – {withTime.format(Date.parse(hovered.to))}
            </p>
            <p className="text-muted-foreground">
              {hovered.count} {hovered.count === 1 ? 'change' : 'changes'}
            </p>
          </div>
        )}

        <Slider
          className="absolute inset-x-0 bottom-2"
          min={min}
          max={max}
          step={step}
          largeStep={step * 10}
          minStepsBetweenValues={1}
          value={[from, to]}
          onValueChange={(value) => {
            const [nextFrom, nextTo] = value as number[];
            onRangeChange({ from: new Date(nextFrom).toISOString(), to: new Date(nextTo).toISOString() });
          }}
        />
      </div>

      <p className="text-right font-mono text-[11px] text-muted-foreground">
        ← → nudge {stepLabel} · Home / End jump to repo start / end · Tab reaches each handle
      </p>
    </section>
  );
}
