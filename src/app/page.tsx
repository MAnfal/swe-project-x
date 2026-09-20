import { GrainWorkspace } from '@/components/canvas/grain-workspace';
import { getSnapshot, listSnapshots } from '@/lib/view/catalog';
import type { Snapshot } from '@/lib/snapshot';

/**
 * Level 1.
 *
 * A server component whose only job is to hand the client the committed snapshots. The
 * catalog resolves them from static imports — nothing reads the filesystem here, at build
 * time or at request time — so what the picker lists is what the bundle carries.
 */
export default function Home() {
  const entries = listSnapshots();
  const snapshots: Record<string, Snapshot> = Object.fromEntries(
    entries.map((entry) => [entry.id, getSnapshot(entry.id)]),
  );

  return <GrainWorkspace entries={entries} snapshots={snapshots} />;
}
