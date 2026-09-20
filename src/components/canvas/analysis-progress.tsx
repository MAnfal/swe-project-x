'use client';

import { CheckIcon, LoaderCircleIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ANALYSIS_STEPS, type AnalysisProgress } from '@/lib/live/protocol';
import { cn } from 'cn';

/**
 * Design page 3: five named steps, per-step counts, the "just read" list, and a
 * percentage.
 *
 * Two departures from the page, both recorded in this chunk's completion report:
 *
 *  1. Its fifth step is "Summarizing how each change was built". A live analysis does not
 *     summarize — enrichment happens when a change is expanded, which is what keeps the
 *     work inside one request — so the fifth step is the attribution the pipeline ends on.
 *  2. Its footer reads "Analysis keeps running if you close this tab." It does not. The
 *     analysis lives inside the request; closing the tab ends it. The footer here says so.
 *
 * The percentage is a step-weighted estimate, not a time estimate: the page's "about 25
 * seconds left" would be a guess at GitHub's latency, and a wrong countdown reads worse
 * than none.
 */

type AnalysisProgressViewProps = {
  repository: string;
  /** The latest report for each step, in pipeline order. */
  reports: Partial<Record<AnalysisProgress['step'], AnalysisProgress>>;
  /** The most recent pull requests read, newest first — the design's "just read" list. */
  justRead: NonNullable<AnalysisProgress['read']>[];
  onCancel: () => void;
};

/**
 * Reading files and commits is the volumetric step — one request pair per pull request —
 * so it carries most of the weight. The others are a handful of requests each.
 */
const WEIGHTS: Record<AnalysisProgress['step'], number> = {
  resolve: 5,
  topology: 20,
  'pull-requests': 15,
  details: 55,
  attribute: 5,
};

function fractionOf(report: AnalysisProgress | undefined): number {
  if (report === undefined) return 0;
  if (report.total === null || report.total === 0) return 1;
  return Math.min(report.done / report.total, 1);
}

/** The right-hand detail a step shows once it has something to say. */
function detailOf(step: AnalysisProgress['step'], report: AnalysisProgress | undefined): string {
  if (report === undefined) return 'waiting';

  switch (step) {
    case 'resolve':
      return report.branch ?? 'resolved';
    case 'topology':
      return `${report.packageCount ?? 0} packages · ${report.edgeCount ?? 0} dependency edges`;
    case 'pull-requests':
      return report.truncated
        ? `${report.done} of ${report.matched ?? report.done} — stopped at the maximum`
        : `${report.done} in the window`;
    case 'details':
      return `${report.done} of ${report.total ?? report.done}`;
    case 'attribute':
      return `${report.packageCount ?? 0} packages`;
  }
}

export function AnalysisProgressView({ repository, reports, justRead, onCancel }: AnalysisProgressViewProps) {
  const percent = Math.round(
    ANALYSIS_STEPS.reduce((total, step) => total + WEIGHTS[step.id] * fractionOf(reports[step.id]), 0),
  );

  const activeIndex = ANALYSIS_STEPS.findIndex((step) => fractionOf(reports[step.id]) < 1);
  const stepNumber = activeIndex === -1 ? ANALYSIS_STEPS.length : activeIndex + 1;

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">Grain</span>
          <span className="font-mono text-sm text-muted-foreground">{repository}</span>
        </div>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel analysis
        </Button>
      </header>

      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-2xl rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold">
                Analyzing <span className="font-mono">{repository}</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Step {stepNumber} of {ANALYSIS_STEPS.length}
              </p>
            </div>
            <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400" aria-hidden>
              {percent}%
            </p>
          </div>

          <div
            className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Analyzing ${repository}`}
          >
            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${percent}%` }} />
          </div>

          <ol className="mt-6 space-y-3.5">
            {ANALYSIS_STEPS.map((step, index) => {
              const report = reports[step.id];
              const fraction = fractionOf(report);
              const done = fraction >= 1;
              const active = index === activeIndex;

              return (
                <li key={step.id} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                      done && 'border-transparent bg-muted text-foreground',
                      active && 'border-amber-500 text-amber-600 dark:text-amber-400',
                      !done && !active && 'border-dashed border-muted-foreground/50',
                    )}
                  >
                    {done ? (
                      <CheckIcon className="size-3" />
                    ) : active ? (
                      <LoaderCircleIcon className="size-3 animate-spin" />
                    ) : null}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <span className={cn('text-sm', done || active ? 'font-medium' : 'text-muted-foreground')}>
                        {step.label}
                      </span>
                      <span
                        className={cn(
                          'font-mono text-xs',
                          active ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
                        )}
                      >
                        {detailOf(step.id, report)}
                      </span>
                    </span>
                    {active && report !== undefined && report.total !== null && report.total > 1 ? (
                      <span className="mt-1.5 block h-0.5 w-full overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-amber-500 transition-all"
                          style={{ width: `${Math.round(fraction * 100)}%` }}
                        />
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>

          {justRead.length === 0 ? null : (
            <div className="mt-6 rounded-lg border bg-muted/40 p-3">
              <p className="mb-2 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
                Just read
              </p>
              <ul aria-live="polite">
                {justRead.map((entry) => (
                  <li key={entry.number} className="flex flex-wrap gap-x-3 font-mono text-[11px]">
                    <span className="text-muted-foreground">#{entry.number}</span>
                    <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                    <span className="text-muted-foreground">
                      {entry.packages.length === 0 ? 'no package' : `→ ${entry.packages.join(', ')}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-5 text-xs text-muted-foreground">
            Analysis runs inside this request. Closing the tab ends it, and retrying starts it over — Grain
            keeps no partial work and writes nothing to your repository.
          </p>
        </div>
      </div>
    </main>
  );
}
