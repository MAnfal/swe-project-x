'use client';

import { cn } from 'cn';

/**
 * The depth indicator that runs across every canvas screen: repository → package → change.
 *
 * Levels replace the view rather than nesting inside it, so this is the only thing that
 * carries where the reader is. Every segment except the current one is a button that
 * returns to that level, which is what makes the depth navigable rather than decorative.
 * The trailing `<span aria-current="page">` is the level you are on.
 */

export type BreadcrumbSegment = {
  label: string;
  /** Omitted on the current segment, which is rendered as text rather than a control. */
  onSelect?: () => void;
  mono?: boolean;
};

type LevelBreadcrumbProps = {
  segments: BreadcrumbSegment[];
  /** "Level 2 · Changes" — the level indicator the designs put opposite the trail. */
  level: string;
  /** The keyboard affordances for this level, spelled out rather than implied. */
  hint: string;
};

export function LevelBreadcrumb({ segments, level, hint }: LevelBreadcrumbProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-4 py-1.5 text-xs">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5">
          {segments.map((segment, index) => (
            <li key={`${segment.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? (
                <span aria-hidden className="text-muted-foreground/60">
                  /
                </span>
              ) : null}
              {segment.onSelect === undefined ? (
                <span aria-current="page" className={cn('font-medium', segment.mono && 'font-mono')}>
                  {segment.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={segment.onSelect}
                  className={cn(
                    'cursor-pointer rounded-sm text-muted-foreground underline underline-offset-4',
                    'hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                    segment.mono && 'font-mono',
                  )}
                >
                  {segment.label}
                </button>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <span className="flex items-center gap-3">
        <span className="font-medium tracking-wide text-amber-700 uppercase dark:text-amber-300">{level}</span>
        <span className="font-mono text-muted-foreground">{hint}</span>
      </span>
    </div>
  );
}
