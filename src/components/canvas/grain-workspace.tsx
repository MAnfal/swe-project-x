'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleHelpIcon } from 'lucide-react';

import { AnalysisErrorView } from '@/components/canvas/analysis-error';
import { AnalysisProgressView } from '@/components/canvas/analysis-progress';
import { ChangesLevel } from '@/components/canvas/changes-level';
import { EmptyWindow } from '@/components/canvas/empty-window';
import { LevelBreadcrumb, type BreadcrumbSegment } from '@/components/canvas/level-breadcrumb';
import { OnboardingTour } from '@/components/canvas/onboarding-tour';
import { RepositoryPicker } from '@/components/canvas/repository-picker';
import { StepsLevel } from '@/components/canvas/steps-level';
import { TimeSlider } from '@/components/canvas/time-slider';
import { TopologyCanvas } from '@/components/canvas/topology-canvas';
import { Button } from '@/components/ui/button';
import { enrichmentKey } from '@/lib/ai/enrichment-record';
import type { PullRequestBound } from '@/lib/ingest/ingest';
import { requestAnalysis, requestEnrichment } from '@/lib/live/client';
import type { AnalysisFailure, AnalysisProgress } from '@/lib/live/protocol';
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
import { buildRecord, type Snapshot } from '@/lib/snapshot';

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
 * the URL — chunk 04's reasoning, unchanged and now also covering expansion and the live
 * analysis: keeping this route free of query parameters keeps it statically prerenderable,
 * which is what makes the committed snapshots provably part of the deployed bundle. The
 * cost is that neither an expanded view nor a live analysis can be shared as a link.
 *
 * **A live analysis is a snapshot like any other** (Principle 5). It arrives from
 * `/api/analysis` already validated against the one schema, goes into the same
 * `deriveWindow`, and renders through the same components — nothing below this file can
 * tell a live snapshot from a baked one, and nothing branches on provenance. The only
 * differences live here: the entry is added to the picker, and enrichment is fetched when
 * a change is first expanded rather than read out of a committed file.
 */

type GrainWorkspaceProps = {
  entries: SnapshotEntry[];
  /** Every committed snapshot, already schema-validated, keyed by catalog id. */
  snapshots: Record<string, Snapshot>;
};

type LiveAnalysis = {
  /** Namespaced so it can never collide with a committed snapshot's filename stem. */
  id: string;
  entry: SnapshotEntry;
  snapshot: Snapshot;
  bound: PullRequestBound;
  /** What the reader typed, kept so a retry can restart the same analysis. */
  url: string;
};

/** How many "just read" lines the progress view keeps, as design page 3 draws it. */
const JUST_READ_LINES = 4;

export function GrainWorkspace({ entries, snapshots }: GrainWorkspaceProps) {
  const [selectedId, setSelectedId] = useState(entries[0]?.id ?? '');
  const [opened, setOpened] = useState(false);
  const [range, setRange] = useState<DateRange | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openChange, setOpenChange] = useState<number | null>(null);
  const [replayToken, setReplayToken] = useState<number | null>(null);

  // Live analysis. `phase` is what the screen shows; `live` is the result, which outlives
  // the run and stays selectable in the picker.
  const [phase, setPhase] = useState<'idle' | 'running' | 'failed'>('idle');
  const [live, setLive] = useState<LiveAnalysis | null>(null);
  const [reports, setReports] = useState<Partial<Record<AnalysisProgress['step'], AnalysisProgress>>>({});
  const [justRead, setJustRead] = useState<NonNullable<AnalysisProgress['read']>[]>([]);
  const [failure, setFailure] = useState<AnalysisFailure | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const [runningUrl, setRunningUrl] = useState('');
  const [pendingEnrichment, setPendingEnrichment] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  /** Enrichment keys already asked for this session, so a re-expand costs no model call. */
  const askedRef = useRef<Set<string>>(new Set());

  const allEntries = useMemo(
    () => (live === null ? entries : [...entries, live.entry]),
    [entries, live],
  );
  const snapshot = live !== null && live.id === selectedId ? live.snapshot : snapshots[selectedId];
  const isLive = live !== null && live.id === selectedId;

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
  // does the same. Neither fires while a text field has focus, so the URL input is not
  // hijacked by them — Escape there is the back arrow, handled by the picker.
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

  // An analysis in flight belongs to this mounted component. Unmounting ends it, which is
  // the whole contract: there is no job to leave behind.
  useEffect(() => () => abortRef.current?.abort(), []);

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

  /**
   * Opens a change, and — for a live snapshot only — generates its enrichment the first
   * time. A committed snapshot was enriched at bake time and costs nothing here.
   */
  function openChangeNode(number: number) {
    setOpenChange(number);
    if (live === null || live.id !== selectedId) return;

    const pullRequest = live.snapshot.pullRequests.find((candidate) => candidate.number === number);
    if (pullRequest === undefined) return;

    const key = enrichmentKey(pullRequest);
    const stored = live.snapshot.enrichment;
    if (askedRef.current.has(key)) return;
    if (stored !== undefined && Object.prototype.hasOwnProperty.call(stored, key)) return;
    askedRef.current.add(key);
    setPendingEnrichment(number);

    const liveId = live.id;
    void requestEnrichment({
      repository: live.snapshot.metadata.repository,
      pullRequest,
    }).then((result) => {
      setPendingEnrichment((current) => (current === number ? null : current));

      // A degraded record is a failure receipt, not a result (chunk 03's rule), so it is
      // not merged and the key is released — re-expanding retries rather than freezing
      // the failure into the session.
      if (result.fallback) {
        askedRef.current.delete(key);
        return;
      }

      setLive((current) => {
        if (current === null || current.id !== liveId) return current;
        const existing = current.snapshot.enrichment ?? {};
        if (Object.prototype.hasOwnProperty.call(existing, key)) return current;
        return {
          ...current,
          snapshot: {
            ...current.snapshot,
            // `buildRecord` rather than a spread: the keys are repository-derived, and
            // zod 4.6.5 drops `__proto__` from a record silently rather than rejecting it.
            enrichment: buildRecord([...Object.entries(existing), [key, result.entry]], 'enrichment key'),
          },
        };
      });
    });
  }

  function cancelAnalysis() {
    abortRef.current?.abort();
    setPhase('idle');
  }

  async function startAnalysis(url: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunningUrl(url);
    setPhase('running');
    setReports({});
    setJustRead([]);
    setFailure(null);
    setRejected(null);

    const terminal = await requestAnalysis({
      url,
      signal: controller.signal,
      onEvent: (event) => {
        if (event.type !== 'progress') return;
        const progress = event.progress;
        setReports((current) => ({ ...current, [progress.step]: progress }));
        if (progress.read !== undefined) {
          const read = progress.read;
          setJustRead((current) => [read, ...current].slice(0, JUST_READ_LINES));
        }
      },
    });

    // A run superseded by a newer one must not write over it.
    if (abortRef.current !== controller) return;

    if (terminal.type === 'complete') {
      const id = `live:${terminal.repository}`;
      askedRef.current = new Set();
      setLive({
        id,
        url,
        snapshot: terminal.snapshot,
        bound: terminal.bound,
        entry: {
          id,
          // No file: this snapshot was analyzed in this session and is not committed.
          file: '',
          repository: terminal.repository,
          packageCount: terminal.snapshot.metadata.packageCount,
          pullRequestCount: terminal.snapshot.metadata.pullRequestCount,
          window: { ...terminal.snapshot.metadata.window },
          enriched: false,
        },
      });
      setSelectedId(id);
      setRange(null);
      setFocused(null);
      collapsePackage();
      setOpened(true);
      setPhase('idle');
      return;
    }

    if (terminal.kind === 'cancelled') {
      setPhase('idle');
      return;
    }
    if (terminal.kind === 'invalid-url') {
      // The dropdown stays usable and the message renders against the field, so the
      // reader can correct a typo without losing where they were.
      setPhase('idle');
      setRejected(terminal.message);
      return;
    }
    setFailure(terminal);
    setPhase('failed');
  }

  const analyze = (url: string) => void startAnalysis(url);

  if (phase === 'running') {
    return (
      <AnalysisProgressView
        repository={runningUrl}
        reports={reports}
        justRead={justRead}
        onCancel={cancelAnalysis}
      />
    );
  }

  if (phase === 'failed' && failure !== null) {
    return (
      <AnalysisErrorView
        repository={runningUrl}
        failure={failure}
        onRetry={() => analyze(runningUrl)}
        onChooseAnother={() => {
          setFailure(null);
          setPhase('idle');
        }}
      />
    );
  }

  if (allEntries.length === 0) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-lg text-center">
          <p className="text-sm text-muted-foreground">
            No snapshots are committed under <code className="font-mono">src/lib/snapshots/</code> yet. Run
            the ingester and rebuild to populate the picker, or analyze a repository now.
          </p>
          <div className="mt-6 text-left">
            <RepositoryPicker
              entries={allEntries}
              selected={selectedId}
              onSelect={selectRepository}
              onAnalyze={analyze}
              error={rejected}
              onErrorClear={() => setRejected(null)}
              className="w-full"
            />
          </div>
        </div>
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
            entries={allEntries}
            selected={selectedId}
            onSelect={selectRepository}
            onAnalyze={analyze}
            error={rejected}
            onErrorClear={() => setRejected(null)}
            className="h-11 w-full"
          />

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button onClick={() => setOpened(true)}>Open canvas</Button>
            <p className="max-w-xs text-sm text-muted-foreground">
              Pre-analyzed repositories open instantly, with no network request and no model call. Anything
              else is analyzed on demand.
            </p>
          </div>

          <p className="mt-10 border-t pt-5 text-sm text-muted-foreground">
            Reviewing this as a take-home?{' '}
            <a href="/submission" className="font-medium text-foreground underline underline-offset-4">
              Resources and execution history
            </a>{' '}
            — the design rationale, the brainstorm it came from, and all eight build transcripts.
          </p>
        </div>
      </main>
    );
  }

  const entry = allEntries.find((candidate) => candidate.id === selectedId);
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
          <RepositoryPicker
            entries={allEntries}
            selected={selectedId}
            onSelect={selectRepository}
            onAnalyze={analyze}
            error={rejected}
            onErrorClear={() => setRejected(null)}
          />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {view.changeCount} {view.changeCount === 1 ? 'change' : 'changes'} · {view.touchedCount} of{' '}
            {view.packageCount} packages touched
          </p>
          <a
            href="/submission"
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Submission
          </a>
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

      {isLive && live.bound.truncated ? (
        <p className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-800 dark:text-amber-200">
          {live.bound.matched} pull requests merged in this window and Grain stopped at {live.bound.kept} — the
          newest ones. The rest were never fetched.
        </p>
      ) : null}

      <LevelBreadcrumb segments={segments} level={level} hint={hint} />

      {level3 !== null && level2 !== null ? (
        <StepsLevel
          chain={level3.chain}
          packageName={level2.activity.package}
          nextChange={level3.nextChange}
          onOpenChange={openChangeNode}
          enriching={pendingEnrichment === level3.chain.change.number}
        />
      ) : level2 !== null ? (
        <ChangesLevel
          view={view}
          activity={level2.activity}
          changes={level2.changes}
          range={effectiveRange}
          history={history}
          onOpenChange={openChangeNode}
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
