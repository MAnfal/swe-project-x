/**
 * Writes a snapshot JSON file for a repository and a window.
 *
 * This is the one place besides a route handler where reading `GITHUB_TOKEN` and writing
 * a file is allowed: Principle 1 permits a credential in `scripts/`, and Principle 3
 * forbids filesystem writes only on paths reachable from a route handler.
 *
 * Run it with Node directly — Node 24 executes TypeScript without a transpiler:
 *
 *   node scripts/ingest.mts --repo xyflow/xyflow \
 *     --since 2026-08-31T00:00:00Z --until 2026-09-02T00:00:00Z --out snapshot.json
 *
 * `--record <file>` additionally writes the HTTP transcript of the run, which is how the
 * committed fixture is produced. `--replay <file>` runs the same pipeline against a
 * committed transcript with no network and no token, which is how the determinism gate
 * runs it twice.
 */

import { readFileSync, writeFileSync } from 'node:fs';

import { createGitHubClient, parseRepositoryRef } from '../src/lib/ingest/github.ts';
import { ingestRepository } from '../src/lib/ingest/ingest.ts';
import {
  recordingFetch,
  replayFetch,
  sampleTranscript,
  type Transcript,
  type TranscriptEntry,
} from '../src/lib/ingest/transcript.ts';
import { DEFAULT_MAX_PULL_REQUESTS, serializeSnapshot } from '../src/lib/snapshot.ts';

const USAGE = `Usage: node scripts/ingest.mts --repo <owner/repo> --since <iso> --until <iso> --out <file>
                              [--branch <name>] [--max-pull-requests <n>]
                              [--record <transcript.json>] [--record-sample <n>]
                              [--replay <transcript.json>]`;

function parseArgs(argv: string[]): Record<string, string> {
  // Flag names come from argv, so the record gets a null prototype.
  const args: Record<string, string> = Object.create(null) as Record<string, string>;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`unexpected argument "${token}"\n${USAGE}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${token.slice(2)} needs a value\n${USAGE}`);
    args[token.slice(2)] = value;
    i += 1;
  }
  return args;
}

function required(args: Record<string, string>, name: string): string {
  const value = args[name];
  if (!value) throw new Error(`--${name} is required\n${USAGE}`);
  return value;
}

/** Reads `.env.local` if present, so the script works the way the rest of the project does. */
function tokenFromEnvironment(): string {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const match = /^\s*GITHUB_TOKEN\s*=\s*(.*)$/.exec(line);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  } catch {
    // no .env.local — fall through to the error below
  }
  throw new Error('GITHUB_TOKEN is not set. Put it in .env.local or the environment.');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const repository = parseRepositoryRef(required(args, 'repo'));
  const since = required(args, 'since');
  const until = required(args, 'until');
  const out = required(args, 'out');
  const maxPullRequests = args['max-pull-requests']
    ? Number(args['max-pull-requests'])
    : DEFAULT_MAX_PULL_REQUESTS;

  const recorded: TranscriptEntry[] = [];
  const replayPath = args.replay;

  const client = replayPath
    ? createGitHubClient({
        token: 'replay-token',
        fetch: replayFetch(JSON.parse(readFileSync(replayPath, 'utf8')) as Transcript),
      })
    : createGitHubClient({
        token: tokenFromEnvironment(),
        ...(args.record ? { fetch: recordingFetch(globalThis.fetch, recorded) } : {}),
      });

  const snapshot = await ingestRepository(client, {
    repository,
    since,
    until,
    analyzedAt: new Date().toISOString(),
    maxPullRequests,
    ...(args.branch ? { branch: args.branch } : {}),
  });

  writeFileSync(out, serializeSnapshot(snapshot));
  if (args.record) {
    // Trim the pull-request listing down to something worth committing. Every retained
    // object is the bytes GitHub returned; see sampleTranscript for what it preserves.
    const transcript =
      args['record-sample'] === undefined
        ? { entries: recorded }
        : sampleTranscript(
            { entries: recorded },
            {
              keep: new Set(snapshot.pullRequests.map((pr) => pr.number)),
              sample: Number(args['record-sample']),
            },
          );
    writeFileSync(args.record, `${JSON.stringify(transcript, null, 2)}\n`);
  }

  process.stderr.write(
    `${repository.owner}/${repository.repo} ${since}..${until}: ` +
      `${snapshot.metadata.packageCount} packages, ${snapshot.metadata.pullRequestCount} pull requests -> ${out}\n`,
  );
  if (args.record) process.stderr.write(`recorded ${recorded.length} HTTP responses -> ${args.record}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
});
