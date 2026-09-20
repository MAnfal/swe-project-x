'use client';

import { TriangleAlertIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ANALYSIS_STEPS, type AnalysisFailure } from '@/lib/live/protocol';

/**
 * Design page 8: why the analysis stopped, the raw upstream line, and a way back.
 *
 * The page's layout is followed; three pieces of its copy are not, and this is the
 * contradiction recorded in the completion report:
 *
 *  - "42 of 100 were already fetched and are kept — retrying resumes from there rather
 *    than starting over." Nothing is kept. There is no job and no store; the work lived
 *    inside the request that ended.
 *  - "Retry from step 3". A retry restarts the analysis, so the button says so.
 *  - "Add a token" on the rate-limit card. The token is the server's, read in the route
 *    handler (Principle 1); there is nothing for a visitor to add.
 *
 * Page 8's three cards are one component because they differ only in their sentence —
 * the layout, the actions and the detail block are identical, and three copies would
 * drift.
 */

/**
 * `cancelled` never reaches this surface — the workspace returns to where the reader was
 * instead of telling them what they just did — so it is not listed and not branched on.
 */
const RETRYABLE = new Set<AnalysisFailure['kind']>(['rate-limit', 'failed']);

type AnalysisErrorViewProps = {
  repository: string;
  failure: AnalysisFailure;
  onRetry: () => void;
  /** Back to the dropdown, which stays usable so a baked repository is one click away. */
  onChooseAnother: () => void;
};

const resetTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

export function AnalysisErrorView({ repository, failure, onRetry, onChooseAnother }: AnalysisErrorViewProps) {
  const stepIndex = ANALYSIS_STEPS.findIndex((step) => step.id === failure.step);
  const heading =
    failure.kind === 'not-found'
      ? 'Repository not found'
      : failure.kind === 'rate-limit'
        ? 'GitHub rate limit spent'
        : `Analysis stopped at step ${stepIndex + 1} of ${ANALYSIS_STEPS.length}`;

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">Grain</span>
          <span className="font-mono text-sm text-muted-foreground">{repository}</span>
        </div>
        <Button variant="outline" size="sm" onClick={onChooseAnother}>
          Choose another repository
        </Button>
      </header>

      <div className="flex flex-1 items-start justify-center p-8">
        <div className="w-full max-w-2xl rounded-xl border border-destructive/50 bg-card p-6 shadow-sm">
          <h1 className="flex items-center gap-2.5 text-lg font-semibold">
            <TriangleAlertIcon aria-hidden className="size-5 shrink-0 text-destructive" />
            {heading}
          </h1>

          <p className="mt-3 text-sm" role="alert">
            {failure.message}
            {failure.resetAt === undefined ? null : (
              <> The limit resets at {resetTime.format(Date.parse(failure.resetAt))}.</>
            )}
          </p>

          {failure.detail === undefined ? null : (
            <pre className="mt-4 overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] text-muted-foreground">
              {failure.detail}
            </pre>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {RETRYABLE.has(failure.kind) ? <Button onClick={onRetry}>Retry the analysis</Button> : null}
            <Button variant="outline" onClick={onChooseAnother}>
              Choose another repository
            </Button>
            <p className="text-xs text-muted-foreground">
              Nothing was written to your repository. A retry starts the analysis over — Grain keeps no
              partial work.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
