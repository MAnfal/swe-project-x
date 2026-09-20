/**
 * Regenerates `src/lib/view/catalog.generated.ts` from the snapshots committed under
 * `src/lib/snapshots/`.
 *
 * Why a generated module of static imports rather than a directory read:
 *
 * - The picker must list the snapshots *present*, so a hand-maintained array is out — it
 *   goes stale the moment another chunk bakes a repository in.
 * - A `readdir` at request time would satisfy that under `pnpm dev` and list nothing in
 *   production: the deploy target bundles the traced module graph, and a source directory
 *   nothing imports is not traced into it.
 *
 * Static imports put the JSON in the module graph, so the bundler carries it. This script
 * runs as `prebuild`, and the file it writes is committed so `pnpm dev` and `pnpm test`
 * work without it; `catalog.test.ts` fails if the committed copy has drifted.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const snapshotDir = join(root, 'src', 'lib', 'snapshots');
const outputFile = join(root, 'src', 'lib', 'view', 'catalog.generated.ts');

const files = readdirSync(snapshotDir)
  .filter((name) => name.endsWith('.json'))
  .sort();

/** A JS identifier for the import binding. The id itself stays the filename stem. */
function bindingFor(file: string, index: number): string {
  const stem = file.replace(/\.json$/, '').replace(/[^a-zA-Z0-9]+/g, '_');
  return `snapshot_${index}_${stem}`;
}

const lines = [
  '// GENERATED FILE — do not edit by hand.',
  '// Written by `scripts/build-snapshot-index.mts`, which runs as the `prebuild` script.',
  '// Regenerate with: node scripts/build-snapshot-index.mts',
  '',
  ...files.map((file, index) => `import ${bindingFor(file, index)} from '../snapshots/${file}';`),
  '',
  '/** Every snapshot committed under `src/lib/snapshots/`, keyed by its filename stem. */',
  'export const SNAPSHOT_SOURCES: ReadonlyArray<{ id: string; file: string; source: unknown }> = [',
  ...files.map(
    (file, index) =>
      `  { id: ${JSON.stringify(file.replace(/\.json$/, ''))}, file: ${JSON.stringify(file)}, source: ${bindingFor(file, index)} },`,
  ),
  '];',
  '',
].join('\n');

const previous = (() => {
  try {
    return readFileSync(outputFile, 'utf8');
  } catch {
    return null;
  }
})();

if (previous === lines) {
  console.log(`${outputFile}: already current (${files.length} snapshots)`);
} else {
  writeFileSync(outputFile, lines);
  console.log(`${outputFile}: wrote ${files.length} snapshots`);
}
