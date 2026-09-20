'use client';

import { ChevronRightIcon, TriangleAlertIcon } from 'lucide-react';
import { cn } from 'cn';

import { Badge } from '@/components/ui/badge';
import type { ChangeSummary } from '@/lib/view/derive';

/**
 * One change on Level 2 (design page 5).
 *
 * A card, not a graph node: the approach note is a sentence and this card exists to give
 * it room. It is rendered in full — never clipped to a chip — because it is the only thing
 * on the screen that says *how* the work was done rather than what changed.
 *
 * The whole card is one `<button>`, so Enter and Space open Level 3 natively and the tab
 * order has one stop per change. Nothing interactive is nested inside it.
 *
 * **The fallback treatment is carried by three things, none of them hue**: the word
 * `Unenriched` in an outline badge, the label set in the mono face the pull request title
 * is written in rather than the prose face a model label gets, and an explicit sentence
 * where the approach note would be. A reader cannot mistake one for the other.
 */

const mergedOn = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

type ChangeCardProps = {
  change: ChangeSummary;
  /** The package this level is anchored to — its chip is outlined among the others. */
  packageName: string;
  onOpen: (number: number) => void;
};

/** The packages a change spanned. The anchored one is outlined, so it reads at a glance. */
export function PackageChips({ packages, packageName }: { packages: string[]; packageName: string }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {packages.map((name) => (
        <span
          key={name}
          className={cn(
            'rounded-md border px-1.5 py-0.5 font-mono text-[11px]',
            name === packageName
              ? 'border-amber-500/70 font-medium text-amber-700 dark:text-amber-300'
              : 'border-transparent bg-muted text-muted-foreground',
          )}
        >
          {name}
        </span>
      ))}
    </span>
  );
}

/** Direct, or through a named dependency. The dot repeats what the words already say. */
export function InclusionBadge({ change }: { change: ChangeSummary }) {
  const indirect = change.inclusion.kind === 'indirect';

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 font-mono',
        indirect
          ? 'border-violet-500/60 text-violet-700 dark:text-violet-300'
          : 'border-amber-500/60 text-amber-700 dark:text-amber-300',
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', indirect ? 'bg-violet-500' : 'bg-amber-500')} />
      {change.inclusion.kind === 'indirect' ? `via ${change.inclusion.through}` : 'direct'}
    </Badge>
  );
}

export function ChangeCard({ change, packageName, onOpen }: ChangeCardProps) {
  return (
    <button
      type="button"
      data-slot="change-card"
      data-fallback={change.fallback}
      aria-expanded={false}
      aria-label={`${change.label} — pull request ${change.number}, ${
        change.inclusion.kind === 'indirect'
          ? `reached ${packageName} via ${change.inclusion.through}`
          : `touched ${packageName} directly`
      }. Open its steps.`}
      onClick={() => onOpen(change.number)}
      className={cn(
        'w-full cursor-pointer rounded-xl border bg-card p-4 text-left shadow-sm transition-all',
        'hover:border-amber-500/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn('text-[15px] font-semibold', change.fallback && 'font-mono text-sm font-medium')}>
            {change.label}
          </span>
          {change.fallback ? (
            <Badge variant="outline" className="gap-1 border-dashed">
              <TriangleAlertIcon aria-hidden />
              Unenriched
            </Badge>
          ) : null}
        </span>
        <InclusionBadge change={change} />
      </div>

      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted-foreground">
        <span>#{change.number}</span>
        <span aria-hidden>·</span>
        <span>{change.author ?? 'unknown author'}</span>
        <span aria-hidden>·</span>
        <span>merged {mergedOn.format(Date.parse(change.mergedAt))}</span>
      </p>

      <div className="mt-2.5">
        <PackageChips packages={change.packages} packageName={packageName} />
      </div>

      <div className="mt-3 flex items-start justify-between gap-4 rounded-lg bg-muted/60 p-3">
        {change.fallback ? (
          <p className="text-sm text-muted-foreground italic">
            No approach note — enrichment has not run for this change, so this is the pull request&apos;s own
            title rather than a summary of how the work was done.
          </p>
        ) : (
          <p className="text-sm">
            <span className="mr-2 align-[1px] text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Approach
            </span>
            {change.approach}
          </p>
        )}

        <span className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs text-muted-foreground">
          {change.stepCount === 0 ? 'no steps' : `${change.stepCount} ${change.stepCount === 1 ? 'step' : 'steps'}`}
          <ChevronRightIcon aria-hidden className="size-3" />
        </span>
      </div>
    </button>
  );
}
