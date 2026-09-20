'use client';

import { ExternalLinkIcon } from 'lucide-react';
import { cn } from 'cn';

import { Badge } from '@/components/ui/badge';
import type { StepDetail } from '@/lib/view/derive';

/**
 * One step on Level 3 (design page 6): what was done, the files it covers, the lines it
 * added and removed, and a link to that commit on GitHub.
 *
 * The entry-point step — where the change reached the package the reader owns — carries a
 * `your package` badge and a heavier border. The badge spells it out, so the amber is a
 * second encoding of something already in the text. The same rule holds inside the file
 * list: a file the expanded package owns gets a filled marker, a heavier weight and a
 * spoken suffix, never colour alone.
 *
 * **A step with no files is not a bug.** The snapshot records changed files per pull
 * request, not per commit, so `stepChain` attributes them by package and a chain longer
 * than the packages it touched leaves its leading steps unattributed. The card says that
 * rather than showing an empty list.
 */

type StepCardProps = {
  step: StepDetail;
  packageName: string;
};

export function StepCard({ step, packageName }: StepCardProps) {
  return (
    <li
      data-slot="step-card"
      data-entry-point={step.entryPoint}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl border bg-card p-4 shadow-sm',
        step.entryPoint && 'border-2 border-amber-500/70',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex size-6 items-center justify-center rounded-md bg-muted font-mono text-xs font-medium">
          {step.position}
        </span>
        {step.entryPoint ? (
          <Badge variant="outline" className="gap-1.5 border-amber-500/60 text-amber-700 dark:text-amber-300">
            <span aria-hidden className="size-1.5 rounded-full bg-amber-500" />
            your package
          </Badge>
        ) : null}
      </div>

      <h3 className="mt-3 text-sm font-semibold">{step.summary}</h3>

      <p className="mt-3 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Files</p>
      {step.files.length === 0 ? (
        <p className="mt-1.5 text-xs text-muted-foreground italic">
          No files attributed to this step — the snapshot records changed files per change, not per commit.
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {step.files.map((file) => {
            // A file the expanded package owns is what the reader came for, so it is
            // marked three ways and not one: a filled marker rather than a hollow one, a
            // heavier weight, and a spoken suffix. The colour change rides along with
            // those rather than carrying the distinction by itself.
            const owned = file.package === packageName;

            return (
              <li
                key={file.path}
                className={cn(
                  'flex items-start gap-1.5 font-mono text-[11px] break-all',
                  owned ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-[5px] size-1.5 shrink-0 rounded-[2px]',
                    owned ? 'bg-amber-500' : 'border border-muted-foreground/70 bg-transparent',
                  )}
                />
                <span>{file.path}</span>
                {owned ? <span className="sr-only">— owned by {packageName}</span> : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex items-end justify-between gap-2 pt-1">
        <p className="font-mono text-xs">
          <span className="text-emerald-700 dark:text-emerald-400">+{step.additions}</span>{' '}
          <span className="text-rose-700 dark:text-rose-400">&minus;{step.deletions}</span>
        </p>
        <a
          href={step.url}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'flex items-center gap-1 rounded-md text-xs text-muted-foreground underline underline-offset-4',
            'hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          )}
        >
          Open on GitHub
          <ExternalLinkIcon aria-hidden className="size-3" />
        </a>
      </div>
    </li>
  );
}
