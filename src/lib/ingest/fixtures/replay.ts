import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createGitHubClient, type GitHubClient } from '../github.ts';
import { ingestRepository } from '../ingest.ts';
import { isPullRequestListUrl, replayFetch, type Transcript } from '../transcript.ts';
import type { Snapshot } from '../../snapshot.ts';

/**
 * Test support: drives a real Octokit from the committed transcript of a real ingest run,
 * so specs exercise the live client, its pagination and its parsing without a network.
 *
 * Not shipped library code and so not separately spec'd — every fixture-backed test in
 * this directory exercises it, and the record/replay mechanism it wraps is covered by
 * `transcript.test.ts`.
 */

/** The window the committed transcript was captured over. */
export const XYFLOW = {
  ref: { owner: 'xyflow', repo: 'xyflow' },
  branch: 'main',
  since: '2026-08-31T00:00:00Z',
  until: '2026-09-02T00:00:00Z',
  transcript: 'xyflow-xyflow-2026-08-31.transcript.json',
} as const;

/** A real 404 from the contents endpoint, recorded separately for the missing-file path. */
export const MISSING_FILE_TRANSCRIPT = 'github-missing-file.transcript.json';

export function loadTranscript(name: string = XYFLOW.transcript): Transcript {
  return JSON.parse(readFileSync(join(import.meta.dirname, name), 'utf8')) as Transcript;
}

export function replayClient(name: string = XYFLOW.transcript): GitHubClient {
  return createGitHubClient({ token: 'replay-token', fetch: replayFetch(loadTranscript(name)) });
}

/**
 * The committed transcript with every pull-request listing page's items reversed.
 *
 * The captured listing happens to arrive already newest-merge-first, so a test run
 * against it cannot tell a working sort from a missing one. The pull requests here are
 * the same real captured objects; only their order within the page is permuted, which is
 * exactly the variable under test.
 */
export function transcriptWithReversedListing(): Transcript {
  const transcript = loadTranscript();
  return {
    entries: transcript.entries.map((entry) =>
      isPullRequestListUrl(entry.url) && Array.isArray(entry.json)
        ? { ...entry, json: [...entry.json].reverse() }
        : entry,
    ),
  };
}

export function clientFor(transcript: Transcript): GitHubClient {
  return createGitHubClient({ token: 'replay-token', fetch: replayFetch(transcript) });
}

export function ingestFromFixture(overrides: { analyzedAt?: string } = {}): Promise<Snapshot> {
  return ingestRepository(replayClient(), {
    repository: XYFLOW.ref,
    since: XYFLOW.since,
    until: XYFLOW.until,
    branch: XYFLOW.branch,
    analyzedAt: overrides.analyzedAt ?? '2026-09-20T00:00:00.000Z',
  });
}
