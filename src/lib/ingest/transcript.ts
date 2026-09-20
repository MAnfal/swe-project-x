/**
 * An HTTP transcript of a real ingest run.
 *
 * Fixtures for this project are captured GitHub responses, not hand-authored JSON. The
 * recorder tees every response the real API returned into a transcript; the replayer
 * serves that transcript back to a real Octokit instance, so tests and the determinism
 * gate exercise the same client, pagination and parsing the live path uses.
 *
 * Only response data is recorded. Request headers are deliberately never captured — the
 * `Authorization` header is on every request the recorder sees — and the response headers
 * that describe the caller's credential rather than the response are dropped, because a
 * transcript is committed and those would publish the token's configuration.
 */

export type TranscriptEntry = {
  method: string;
  url: string;
  status: number;
  headers: Record<string, string>;
  body: string;
};

export type Transcript = { entries: TranscriptEntry[] };

/**
 * Response headers that describe the credential the request was made with. None is a
 * secret on its own, but a committed fixture should not carry the OAuth client id or the
 * scope list of whoever recorded it.
 */
const CREDENTIAL_HEADERS: readonly string[] = [
  'x-oauth-client-id',
  'x-oauth-scopes',
  'x-accepted-oauth-scopes',
  'set-cookie',
];

function keyOf(method: string, url: string): string {
  return `${method.toUpperCase()} ${url}`;
}

function requestKey(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): string {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET');
  return keyOf(method ?? 'GET', url);
}

/**
 * Wraps a fetch implementation so every response it returns is appended to `sink`. The
 * response handed back to the caller is a fresh one over the same bytes, because a body
 * can only be read once.
 */
export function recordingFetch(upstream: typeof fetch, sink: TranscriptEntry[]): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const response = await upstream(input, init);
    const body = await response.text();
    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      if (CREDENTIAL_HEADERS.includes(name.toLowerCase())) return;
      headers[name] = value;
    });

    const [method, url] = splitKey(requestKey(input, init));
    sink.push({ method, url, status: response.status, headers, body });

    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  }) as typeof fetch;
}

/**
 * Serves a recorded transcript. Repeatable: the same request returns the same bytes every
 * time, which is what lets the determinism gate run the pipeline twice offline.
 */
export function replayFetch(transcript: Transcript): typeof fetch {
  const byKey = new Map<string, TranscriptEntry>();
  for (const entry of transcript.entries) {
    // First write wins, so a re-recorded duplicate cannot change replay behaviour.
    if (!byKey.has(keyOf(entry.method, entry.url))) byKey.set(keyOf(entry.method, entry.url), entry);
  }

  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const key = requestKey(input, init);
    const entry = byKey.get(key);
    if (!entry) {
      throw new Error(`no recorded response in transcript for ${key}`);
    }
    return new Response(entry.body, { status: entry.status, headers: entry.headers });
  }) as typeof fetch;
}

function splitKey(key: string): [string, string] {
  const at = key.indexOf(' ');
  return [key.slice(0, at), key.slice(at + 1)];
}

/**
 * Matches the pull-request *list* endpoint only. The `link` header GitHub returns for
 * page two addresses the repository by numeric id, so both spellings are accepted, and
 * the per-pull-request sub-resources (`/pulls/{n}/files`, `/pulls/{n}/commits`) are
 * deliberately excluded — they must be kept whole.
 */
const PULL_REQUEST_LIST = /\/(?:repos\/[^/]+\/[^/]+|repositories\/\d+)\/pulls(?:\?|$)/;

/**
 * Shrinks a recorded transcript to a size worth committing.
 *
 * Listing 200 pull requests to find the handful merged inside a two-day window is what
 * the real endpoint costs, and the raw transcript of that is megabytes of pull requests
 * no assertion looks at. This keeps every listed pull request the run actually matched,
 * plus the first `sample` others on each page, and touches nothing else: each retained
 * object is the bytes GitHub returned, the pages keep their `link` headers, and so replay
 * still exercises pagination and the end-of-window stop.
 */
export function sampleTranscript(
  transcript: Transcript,
  options: { keep: ReadonlySet<number>; sample: number },
): Transcript {
  return {
    entries: transcript.entries.map((entry) => {
      if (!PULL_REQUEST_LIST.test(entry.url)) return entry;

      const parsed: unknown = JSON.parse(entry.body);
      if (!Array.isArray(parsed)) return entry;

      let others = 0;
      const kept = parsed.filter((item) => {
        const number = (item as { number?: unknown }).number;
        if (typeof number === 'number' && options.keep.has(number)) return true;
        others += 1;
        return others <= options.sample;
      });

      return { ...entry, body: JSON.stringify(kept) };
    }),
  };
}
