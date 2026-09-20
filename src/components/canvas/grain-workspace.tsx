'use client';

import { useMemo, useState } from 'react';

import { EmptyWindow } from '@/components/canvas/empty-window';
import { RepositoryPicker } from '@/components/canvas/repository-picker';
import { TimeSlider } from '@/components/canvas/time-slider';
import { TopologyCanvas } from '@/components/canvas/topology-canvas';
import { Button } from '@/components/ui/button';
import type { SnapshotEntry } from '@/lib/view/catalog';
import {
  deriveWindow,
  historyBounds,
  nearestActivity,
  volumeSeries,
  type DateRange,
} from '@/lib/view/derive';
import type { Snapshot } from '@/lib/snapshot';

/**
 * The Level 1 screen: landing card, then the canvas with the persistent time slider.
 *
 * The selected repository and range live in component state rather than in the URL. Two
 * reasons: the URL is chunk 06's surface — it owns `Other…`, the repository URL input and
 * the back arrow, and a query parameter added here would be rewritten there — and keeping
 * the range out of the URL keeps this route statically prerenderable, which is what makes
 * the committed snapshots provably part of the deployed bundle rather than files the
 * server hopes to find. The cost is that a scrubbed view cannot be shared as a link.
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

  function selectRepository(id: string) {
    setSelectedId(id);
    setRange(null); // each repository opens on its own full history
    setFocused(null);
  }

  // Focus narrows the canvas to one package's neighbourhood; the empty state says every
  // package in the repository is dimmed. Held at once they describe different pictures, so
  // changing the range drops focus — the same thing switching repository already does.
  function changeRange(next: DateRange) {
    setRange(next);
    setFocused(null);
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

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">Grain</span>
          <RepositoryPicker entries={entries} selected={selectedId} onSelect={selectRepository} />
        </div>
        <p className="text-xs text-muted-foreground">
          {view.changeCount} {view.changeCount === 1 ? 'change' : 'changes'} · {view.touchedCount} of{' '}
          {view.packageCount} packages touched
        </p>
      </header>

      <div className="flex items-center justify-between gap-3 border-b px-4 py-1.5 text-xs">
        <span className="font-mono text-muted-foreground">{repository}</span>
        <span className="flex items-center gap-3">
          <span className="font-medium tracking-wide text-amber-700 uppercase dark:text-amber-300">
            Level 1 · Topology
          </span>
          <span className="font-mono text-muted-foreground">↹ focus · Esc clear</span>
        </span>
      </div>

      <div className="relative flex-1">
        <TopologyCanvas view={view} focused={focused} onFocus={setFocused} />
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

      <TimeSlider
        history={history}
        range={effectiveRange}
        volume={volume}
        changeCount={view.changeCount}
        touchedCount={view.touchedCount}
        onRangeChange={changeRange}
      />
    </main>
  );
}
