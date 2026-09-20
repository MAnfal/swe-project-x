'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleHelpIcon } from 'lucide-react';

import { ChangesLevel } from '@/components/canvas/changes-level';
import { EmptyWindow } from '@/components/canvas/empty-window';
import { LevelBreadcrumb, type BreadcrumbSegment } from '@/components/canvas/level-breadcrumb';
import { OnboardingTour } from '@/components/canvas/onboarding-tour';
import { RepositoryPicker } from '@/components/canvas/repository-picker';
import { StepsLevel } from '@/components/canvas/steps-level';
import { TimeSlider } from '@/components/canvas/time-slider';
import { TopologyCanvas } from '@/components/canvas/topology-canvas';
import { Button } from '@/components/ui/button';
import type { SnapshotEntry } from '@/lib/view/catalog';
import {
  activityOf,
  changeOf,
  deriveWindow,
  historyBounds,
  nearestActivity,
  packageChanges,
  stepChain,
  volumeSeries,
  type DateRange,
} from '@/lib/view/derive';
import type { Snapshot } from '@/lib/snapshot';

/**
 * The canvas, at all three levels: the topology, the changes that reached one package, and
 * how one of those changes was built.
 *
 * **Levels replace the view rather than nesting inside it.** dagre does not lay out
 * sub-flows, and nesting would force a second layout engine for no gain the reader can
 * see. The breadcrumb carries the depth instead, and the time slider stays mounted at the
 * bottom of all three levels and keeps driving everything above it.
 *
 * The selected repository, range and expansion all live in component state rather than in
 * the URL — chunk 04's reasoning, unchanged and now also covering expansion: the URL is
 * chunk 06's surface, and keeping this route free of query parameters keeps it statically
 * prerenderable, which is what makes the committed snapshots provably part of the deployed
 * bundle. The cost is that an expanded view cannot be shared as a link.
 */

type GrainWorkspaceProps = {
  entries: SnapshotEntry[];
  /** Every committed snapshot, already schema-validated, keyed by catalog id. */
  snapshots: Record<string, Snapshot>;
};

export function GrainWorkspace({ entries, snapshots }: GrainWorkspaceProps) {
  const [selectedId, setSelectedId] = useState(entries[0]?.id ?? '');
  const [opened, setOpened] = useState(false);
  const [range, setRange] = useState<DateRange | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openChange, setOpenChange] = useState<number | null>(null);
  const [replayToken, setReplayToken] = useState<number | null>(null);

  const snapshot = snapshots[selectedId];
  const history = useMemo(() => (snapshot ? historyBounds(snapshot) : null), [snapshot]);
  const effectiveRange = range ?? history;

  const view = useMemo(
    () => (snapshot && effectiveRange ? deriveWindow(snapshot, effectiveRange) : null),
    [snapshot, effectiveRange],
  );
  const volume = useMemo(() => (snapshot ? volumeSeries(snapshot) : []), [snapshot]);
  const nearest = useMemo(() => {
    if (!snapshot || !effectiveRange || view === null || view.changeCount > 0) return null;
    const candidate = nearestActivity(snapshot, effectiveRange);
    if (candidate === null) return null;
    return { range: candidate, changeCount: deriveWindow(snapshot, candidate).changeCount };
  }, [snapshot, effectiveRange, view]);

  // The expanded package's activity and its changes. `activityOf` throws for a name the
  // snapshot does not have, so a package that disappears between snapshots collapses the
  // level rather than crashing it.
  const level2 = useMemo(() => {
    if (!snapshot || view === null || expanded === null) return null;
    if (!view.activity.some((entry) => entry.package === expanded)) return null;
    return { activity: activityOf(view, expanded), changes: packageChanges(snapshot, view, expanded) };
  }, [snapshot, view, expanded]);

  // The open change, if it is still inside the selected range. Scrubbing away from it
  // drops back to Level 2 rather than showing a change the window no longer contains.
  const level3 = useMemo(() => {
    if (!snapshot || view === null || expanded === null || openChange === null || level2 === null) return null;
    const index = level2.changes.findIndex((change) => change.number === openChange);
    if (index === -1) return null;
    const next = level2.changes[index + 1];
    return {
      chain: stepChain(snapshot, changeOf(view, openChange), expanded),
      nextChange: next === undefined ? null : { number: next.number, label: next.label },
    };
  }, [snapshot, view, expanded, openChange, level2]);

  const collapseChange = useCallback(() => setOpenChange(null), []);
  const collapsePackage = useCallback(() => {
    setOpenChange(null);
    setExpanded(null);
  }, []);

  // `←` steps back out a level, as the level indicator on each screen promises, and Escape
  // does the same. Neither fires while a text field has focus, so chunk 06's URL input is
  // not hijacked by them.
  useEffect(() => {
    if (expanded === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'ArrowLeft') return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(target.tagName))) {
        return;
      }
      event.preventDefault();
      if (openChange !== null) collapseChange();
      else collapsePackage();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded, openChange, collapseChange, collapsePackage]);

  function selectRepository(id: string) {
    setSelectedId(id);
    setRange(null); // each repository opens on its own full history
    setFocused(null);
    collapsePackage();
  }

  // Focus narrows the canvas to one package's neighbourhood; the empty state says every
  // package in the repository is dimmed. Held at once they describe different pictures, so
  // changing the range drops focus — the same thing switching repository already does.
  function changeRange(next: DateRange) {
    setRange(next);
    setFocused(null);
  }

  function openPackage(packageName: string) {
    setOpenChange(null);
    setExpanded(packageName);
  }

  if (entries.length === 0) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <p className="max-w-md text-center text-sm text-muted-foreground">
          No snapshots are committed under <code className="font-mono">src/lib/snapshots/</code> yet. Run the
          ingester and rebuild to populate the picker.
        </p>
      </main>
    );
  }

  if (!opened || snapshot === undefined || view === null || history === null || effectiveRange === null) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-lg">
          <h1 className="text-3xl font-semibold tracking-tight">Grain</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            See what happened in your packages while you weren&apos;t looking — and how each change was built.
          </p>

          <p className="mt-8 mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Repository</p>
          <RepositoryPicker
            entries={entries}
            selected={selectedId}
            onSelect={selectRepository}
            className="h-11 w-full"
          />

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button onClick={() => setOpened(true)}>Open canvas</Button>
            <p className="max-w-xs text-sm text-muted-foreground">
              Pre-analyzed repositories open instantly, with no network request and no model call.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const entry = entries.find((candidate) => candidate.id === selectedId);
  const repository = entry?.repository ?? selectedId;

  const segments: BreadcrumbSegment[] = [
    { label: repository, mono: true, ...(expanded === null ? {} : { onSelect: collapsePackage }) },
    ...(level2 === null
      ? []
      : [
          {
            label: level2.activity.package,
            mono: true,
            ...(level3 === null ? {} : { onSelect: collapseChange }),
          },
        ]),
    ...(level3 === null ? [] : [{ label: level3.chain.change.label }]),
  ];

  const level =
    level3 !== null ? 'Level 3 · Steps' : level2 !== null ? 'Level 2 · Changes' : 'Level 1 · Topology';
  const hint =
    level3 !== null
      ? '← back to changes'
      : level2 !== null
        ? '→ open a change · ← collapse package'
        : '↹ focus · → expand · ← collapse';

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">Grain</span>
          <RepositoryPicker entries={entries} selected={selectedId} onSelect={selectRepository} />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {view.changeCount} {view.changeCount === 1 ? 'change' : 'changes'} · {view.touchedCount} of{' '}
            {view.packageCount} packages touched
          </p>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Replay tour"
            title="Replay tour"
            onClick={() => setReplayToken(Date.now())}
          >
            <CircleHelpIcon aria-hidden />
          </Button>
        </div>
      </header>

      <LevelBreadcrumb segments={segments} level={level} hint={hint} />

      {level3 !== null && level2 !== null ? (
        <StepsLevel
          chain={level3.chain}
          packageName={level2.activity.package}
          nextChange={level3.nextChange}
          onOpenChange={setOpenChange}
        />
      ) : level2 !== null ? (
        <ChangesLevel
          view={view}
          activity={level2.activity}
          changes={level2.changes}
          range={effectiveRange}
          history={history}
          onOpenChange={setOpenChange}
          onOpenPackage={openPackage}
          onCollapse={collapsePackage}
          onRangeChange={changeRange}
        />
      ) : (
        <div className="relative flex-1">
          <TopologyCanvas view={view} focused={focused} onFocus={setFocused} onExpand={openPackage} />
          {view.changeCount === 0 ? (
            <EmptyWindow
              repository={repository}
              range={effectiveRange}
              history={history}
              packageCount={view.packageCount}
              nearest={nearest}
              onRangeChange={changeRange}
            />
          ) : null}
        </div>
      )}

      <TimeSlider
        history={history}
        range={effectiveRange}
        volume={volume}
        changeCount={view.changeCount}
        touchedCount={view.touchedCount}
        onRangeChange={changeRange}
      />

      <OnboardingTour replayToken={replayToken} />
    </main>
  );
}
