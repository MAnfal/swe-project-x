'use client';

import { ArrowRightIcon, TriangleAlertIcon } from 'lucide-react';

import { InclusionBadge, PackageChips } from '@/components/canvas/change-card';
import { StepCard } from '@/components/canvas/step-card';
import { Button } from '@/components/ui/button';
import type { StepChain } from '@/lib/view/derive';

/**
 * Level 3 (design page 6): the ordered chain that produced one change, left to right.
 *
 * The line beneath the chain is the sharpest thing on the screen — it answers *where did
 * this reach me* without reading a diff. It is derived, not model output: the entry point
 * is the step carrying files the expanded package owns.
 *
 * Plain DOM, for the same reason as Level 2: the design draws a row of cards with arrows
 * between them, which is a flex row.
 */

const mergedOn = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

type StepsLevelProps = {
  chain: StepChain;
  packageName: string;
  /** The next change under the same package, if there is one. */
  nextChange: { number: number; label: string } | null;
  onOpenChange: (number: number) => void;
};

export function StepsLevel({ chain, packageName, nextChange, onOpenChange }: StepsLevelProps) {
  const { change, steps } = chain;

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-auto bg-muted/30 p-6">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
              {change.label}
              <InclusionBadge change={change} />
            </h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 font-mono text-xs text-muted-foreground">
              <span>#{change.number}</span>
              <span aria-hidden>·</span>
              <span>{change.author ?? 'unknown author'}</span>
              <span aria-hidden>·</span>
              <span>merged {mergedOn.format(Date.parse(change.mergedAt))}</span>
            </p>
            <div className="mt-2.5">
              <PackageChips packages={change.packages} packageName={packageName} />
            </div>
          </div>

          <p className="max-w-md flex-1 text-sm">
            {change.approach === null ? (
              <span className="text-muted-foreground italic">
                No approach note — enrichment has not run for this change, so the heading above is the pull
                request&apos;s own title.
              </span>
            ) : (
              <>
                <span className="mr-2 align-[1px] text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
                  Approach
                </span>
                {change.approach}
              </>
            )}
          </p>
        </div>
      </div>

      <div>
        <p className="flex flex-wrap items-baseline gap-3">
          <span className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            How it was built
          </span>
          <span className="text-xs text-muted-foreground">
            {steps.length === 0
              ? 'No step chain — enrichment has not run for this change.'
              : `${steps.length} ${steps.length === 1 ? 'step' : 'steps'}, in the order they were built — not
                 commit order. Files are attributed to steps by package: the snapshot records changed files per
                 change, not per commit.`}
          </span>
        </p>

        {steps.length === 0 ? (
          <ul className="mt-4 rounded-xl border bg-card p-4 shadow-sm">
            <li className="mb-2 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Files this change touched
            </li>
            {chain.files.map((file) => (
              <li key={file.path} className="font-mono text-[11px] text-muted-foreground">
                · {file.path}{' '}
                <span className="text-emerald-700 dark:text-emerald-400">+{file.additions}</span>{' '}
                <span className="text-rose-700 dark:text-rose-400">&minus;{file.deletions}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ol className="mt-4 flex items-stretch gap-0 overflow-x-auto pb-2">
            {steps.map((step, index) => (
              <div key={`${step.commitSha}-${step.position}`} className="flex items-stretch">
                {index > 0 ? (
                  <span aria-hidden className="flex w-10 shrink-0 items-center justify-center">
                    <ArrowRightIcon className="size-4 text-muted-foreground" />
                  </span>
                ) : null}
                <StepCard step={step} packageName={packageName} />
              </div>
            ))}
          </ol>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <p className="flex items-start gap-2 text-sm">
          <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          {chain.entryStep !== null ? (
            <span>
              Step {chain.entryStep} is where this change entered <span className="font-mono">{packageName}</span>
              . Grain shows what happened and stops there — no review, no score, no gate.
            </span>
          ) : steps.length === 0 ? (
            <span>
              There is no step chain for this change, so there is no entry point to mark. Grain shows what
              happened and stops there — no review, no score, no gate.
            </span>
          ) : (
            // `directPackages` is derived from the files' owners (`attributePullRequest`) and
            // every file group lands on exactly one step, so a *direct* change with a chain
            // always has an entry point. Reaching here means the change arrived through the
            // dependency graph — which the `via` badge at the top of this screen already says,
            // so this line does not repeat it.
            <span>
              No step here carries a file <span className="font-mono">{packageName}</span> owns, so Grain marks
              no entry point for this change.
            </span>
          )}
        </p>

        {nextChange === null ? null : (
          <Button variant="outline" size="sm" onClick={() => onOpenChange(nextChange.number)}>
            Next change
            <ArrowRightIcon aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
