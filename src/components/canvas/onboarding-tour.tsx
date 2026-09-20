'use client';

import { useState, useSyncExternalStore } from 'react';
import { CheckIcon } from 'lucide-react';
import { cn } from 'cn';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

/**
 * The first-visit walkthrough (design page 9): four steps covering the slider and the
 * three levels, with a progress rail beside the card and a replay control in the header.
 *
 * The dismissal is persisted in `localStorage` — it is a convenience, not state anyone
 * else needs, and nothing else in the app reads it. Every access is wrapped: a private
 * window, cleared site data or a blocked-storage policy makes the accessor throw, and a
 * tour that crashes the canvas is worse than a tour that shows twice.
 *
 * Storage is read through `useSyncExternalStore`, which is what makes this safe on a
 * statically prerendered route: the server snapshot reports "already dismissed", so the
 * prerendered HTML carries no dialog and the client decides after hydration. Reading
 * storage during render would make the two disagree; reading it in an effect and calling
 * `setState` there is a cascading render the project's lint rules reject.
 */

export const TOUR_STORAGE_KEY = 'grain:tour-dismissed';

export type TourStep = { title: string; rail: string; body: string };

export const TOUR_STEPS: TourStep[] = [
  {
    title: 'Your packages, dimmed and lit',
    rail: 'what the map shows',
    body:
      'Every package in the repository is on the map. The lit ones were touched in the window you have ' +
      'selected — amber for a change that named them, violet for one that arrived through a dependency. ' +
      'The dimmed, dashed ones were not touched at all.',
  },
  {
    title: 'Scrub to a window',
    rail: 'the time slider',
    body:
      'Drag either handle to set a range — the two weeks you were away, a sprint you were not on. The ' +
      'histogram behind the track is change volume across the whole life of the repository, so you can see ' +
      'where activity clustered before you scrub. Everything above the slider is driven by this range.',
  },
  {
    title: 'Open a package',
    rail: 'changes, not commits',
    body:
      'Open a package to see the changes that reached it, one card each, grouped by change rather than by ' +
      'commit. Each card carries the approach note: one sentence on how the work was done.',
  },
  {
    title: 'Open a change',
    rail: 'how it was built',
    body:
      'Open a change to see the ordered chain of steps that produced it, the files each step covers, and the ' +
      'step where the change entered your package. Grain shows what happened and stops there.',
  },
];

/** Reads the dismissal flag. Never throws: storage can be unavailable or blocked. */
function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, 'true');
  } catch {
    // A viewer with storage blocked simply sees the tour again next visit.
  }
  for (const listener of [...listeners]) listener();
}

/**
 * The store half of `useSyncExternalStore`. Nothing outside this module writes the key, so
 * the only notification that matters is this component's own dismissal.
 */
let listeners: (() => void)[] = [];

function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((candidate) => candidate !== listener);
  };
}

/** What the server renders: dismissed, so the prerendered HTML carries no dialog. */
function serverDismissed(): boolean {
  return true;
}

type OnboardingTourProps = {
  /** Set by the replay control. Null means "show it only if it has never been dismissed". */
  replayToken: number | null;
};

export function OnboardingTour({ replayToken }: OnboardingTourProps) {
  const dismissed = useSyncExternalStore(subscribe, readDismissed, serverDismissed);
  const [index, setIndex] = useState(0);
  /** `null` follows the stored flag; a session decision overrides it either way. */
  const [session, setSession] = useState<'open' | 'closed' | null>(null);
  const [seenToken, setSeenToken] = useState(replayToken);

  // Replay: a new token means the control was pressed again, even after a dismissal.
  // Adjusted during render — React's own pattern for derived-from-props state, and the one
  // the lint rules leave open, since an effect doing this is a cascading render.
  if (replayToken !== seenToken) {
    setSeenToken(replayToken);
    setIndex(0);
    setSession('open');
  }

  const open = session === null ? !dismissed : session === 'open';

  function dismiss() {
    setSession('closed');
    writeDismissed();
  }

  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setSession('open') : dismiss())}>
      <DialogContent className="sm:max-w-lg" data-slot="onboarding-tour">
        <DialogTitle className="flex items-baseline gap-3">
          <span className="font-mono text-xs text-muted-foreground">
            {index + 1} of {TOUR_STEPS.length}
          </span>
          {step.title}
        </DialogTitle>
        <DialogDescription className="text-sm leading-relaxed">{step.body}</DialogDescription>

        <ol className="rounded-lg bg-muted/60 p-3 text-xs">
          <li className="mb-2 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            The tour
          </li>
          {TOUR_STEPS.map((entry, position) => (
            <li key={entry.title} className="flex items-start gap-2 py-0.5">
              <span aria-hidden className="mt-0.5 flex size-3 shrink-0 items-center justify-center">
                {position < index ? (
                  <CheckIcon className="size-3 text-muted-foreground" />
                ) : (
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      position === index ? 'bg-amber-500' : 'bg-muted-foreground/40',
                    )}
                  />
                )}
              </span>
              <span className={cn(position === index ? 'font-medium' : 'text-muted-foreground')}>
                {entry.title} <span className="text-muted-foreground">— {entry.rail}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="flex items-center justify-between gap-3">
          <div aria-hidden className="flex items-center gap-1.5">
            {TOUR_STEPS.map((entry, position) => (
              <span
                key={entry.title}
                className={cn(
                  'h-1.5 rounded-full',
                  position === index ? 'w-5 bg-amber-500' : 'w-1.5 bg-muted-foreground/40',
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={dismiss}>
              Skip tour
            </Button>
            <Button variant="outline" size="sm" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              Back
            </Button>
            <Button size="sm" onClick={() => (last ? dismiss() : setIndex(index + 1))}>
              {last ? 'Done' : 'Next'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
