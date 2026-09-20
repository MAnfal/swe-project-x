'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeftIcon, SearchIcon, TriangleAlertIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SnapshotEntry } from '@/lib/view/catalog';
import { parseRepositoryUrl } from '@/lib/live/request';
import { cn } from 'cn';

/**
 * The repository field (design pages 1 and 2), in three states: the dropdown, the URL
 * input it is swapped for when `Other…` is chosen, and that input carrying an error.
 *
 * The rows come from the snapshot catalog, which is generated from the snapshots present
 * in `src/lib/snapshots/`, so a repository baked in by another chunk appears here without
 * this file changing. Nothing here names a repository.
 *
 * The swap happens **in this one slot** — the select is replaced, nothing else on the page
 * moves — which is why the mode lives here rather than in the workspace. `parseRepositoryUrl`
 * is the same function the route runs, so the message shown against the field is the
 * message the server would have given.
 */

/** The `Other…` row's value. A colon cannot appear in a snapshot's filename stem. */
const OTHER = 'grain:other';

type RepositoryPickerProps = {
  entries: SnapshotEntry[];
  selected: string;
  onSelect: (id: string) => void;
  /**
   * Given a repository reference this component has already validated. Omit it and the
   * `Other…` row is not offered — the header picker does offer it, so an evaluator can
   * switch repositories without going back to the landing card.
   */
  onAnalyze?: (url: string) => void;
  /** A rejection from the last submitted analysis, rendered against the field. */
  error?: string | null;
  /** Called when the reader edits or leaves the field, so a stale rejection clears. */
  onErrorClear?: () => void;
  disabled?: boolean;
  className?: string;
};

export function RepositoryPicker({
  entries,
  selected,
  onSelect,
  onAnalyze,
  error = null,
  onErrorClear,
  disabled = false,
  className,
}: RepositoryPickerProps) {
  const [mode, setMode] = useState<'select' | 'url'>('select');
  const [url, setUrl] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  // Focus lands in the field when the select is swapped for it (design page 2, state B).
  // No state is set here, which is what keeps it clear of `react-hooks/set-state-in-effect`.
  useEffect(() => {
    if (mode === 'url') inputRef.current?.focus();
  }, [mode]);

  const labelFor = (id: string) => entries.find((entry) => entry.id === id)?.repository ?? id;
  const shown = invalid ?? error;

  function leaveUrlMode() {
    // The back arrow restores the select with its previous selection intact and discards
    // what was typed (design page 2).
    setMode('select');
    setUrl('');
    setInvalid(null);
    onErrorClear?.();
  }

  function validate(): boolean {
    const parsed = parseRepositoryUrl(url);
    setInvalid(parsed.ok ? null : parsed.message);
    return parsed.ok;
  }

  function submit() {
    if (!validate()) return;
    onErrorClear?.();
    onAnalyze?.(url);
  }

  if (mode === 'url') {
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <div className="flex items-start gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Back to the repository list"
            title="Back to the repository list"
            onClick={leaveUrlMode}
            disabled={disabled}
          >
            <ArrowLeftIcon aria-hidden />
          </Button>

          <Input
            ref={inputRef}
            value={url}
            disabled={disabled}
            placeholder="https://github.com/owner/repo"
            aria-label="GitHub repository URL"
            aria-invalid={shown !== null}
            {...(shown === null ? {} : { 'aria-describedby': errorId })}
            className="h-8 flex-1 font-mono"
            onChange={(event) => {
              setUrl(event.target.value);
              // Validation runs on submit and on blur, never per keystroke — but a
              // message about text that no longer exists is worse than none.
              if (invalid !== null) setInvalid(null);
              if (error !== null) onErrorClear?.();
            }}
            onBlur={() => {
              if (url.trim().length > 0) validate();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                leaveUrlMode();
              }
            }}
          />

          <Button onClick={submit} disabled={disabled}>
            Analyze
          </Button>
        </div>

        {shown === null ? null : (
          <p id={errorId} className="flex items-start gap-1.5 pl-12 text-xs text-destructive">
            <TriangleAlertIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {shown}
          </p>
        )}
      </div>
    );
  }

  return (
    <Select
      value={selected}
      disabled={disabled}
      onValueChange={(value) => {
        if (typeof value !== 'string') return;
        if (value === OTHER) {
          setMode('url');
          return;
        }
        onSelect(value);
      }}
    >
      <SelectTrigger className={cn('min-w-64 font-mono', className)} aria-label="Repository">
        <SelectValue>{(value) => <span className="truncate">{labelFor(String(value))}</span>}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {entries.map((entry) => (
          <SelectItem key={entry.id} value={entry.id}>
            <span className="flex flex-col gap-0.5 py-0.5">
              <span className="font-mono text-sm">{entry.repository}</span>
              <span className="text-xs text-muted-foreground">
                {entry.packageCount} packages · {entry.pullRequestCount} pull requests
                {entry.enriched ? '' : ' · not enriched'}
              </span>
            </span>
          </SelectItem>
        ))}

        {onAnalyze === undefined ? null : (
          <>
            <SelectSeparator />
            <SelectItem value={OTHER}>
              <span className="flex w-full items-center gap-2 py-0.5">
                <SearchIcon aria-hidden className="size-3.5 text-muted-foreground" />
                <span className="flex-1 text-sm">Other…</span>
                <span className="text-xs text-muted-foreground">analyze a GitHub repository</span>
              </span>
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
