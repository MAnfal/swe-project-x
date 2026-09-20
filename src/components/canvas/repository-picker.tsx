'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SnapshotEntry } from '@/lib/view/catalog';
import { cn } from 'cn';

/**
 * The repository dropdown.
 *
 * The rows come from the snapshot catalog, which is generated from the snapshots present
 * in `src/lib/snapshots/`, so a repository baked in by another chunk appears here without
 * this file changing. Nothing here names a repository.
 *
 * Chunk 06 adds the `Other…` row, the URL input and the back arrow. The trigger is sized
 * for them; they are not built here.
 */

type RepositoryPickerProps = {
  entries: SnapshotEntry[];
  selected: string;
  onSelect: (id: string) => void;
  className?: string;
};

export function RepositoryPicker({ entries, selected, onSelect, className }: RepositoryPickerProps) {
  const labelFor = (id: string) => entries.find((entry) => entry.id === id)?.repository ?? id;

  return (
    <Select
      value={selected}
      onValueChange={(value) => {
        if (typeof value === 'string') onSelect(value);
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
      </SelectContent>
    </Select>
  );
}
