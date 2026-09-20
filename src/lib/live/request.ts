import type { RepositoryRef } from '../ingest/github.ts';
import { DEFAULT_MAX_PULL_REQUESTS, MAX_PULL_REQUESTS, RESERVED_KEYS } from '../snapshot.ts';

/**
 * What a live analysis request is allowed to be: which repository, over what window, up
 * to how many pull requests.
 *
 * This is the boundary `sops/planning/boundary-validation.md` governs. The submitted
 * string becomes a GitHub API path *and* part of an enrichment cache key, so it is parsed
 * against GitHub's own grammar here and nothing downstream re-checks it.
 *
 * Deliberately free of runtime imports beyond the schema's constants: the repository
 * picker validates on submit in the browser, so this module sits on a client path.
 * `RepositoryRef` is a type-only import — it is erased, and the Octokit client
 * `ingest/github.ts` builds never reaches the client bundle.
 */

/**
 * GitHub's own login grammar: alphanumerics and hyphens, no leading or trailing hyphen,
 * at most 39 characters. A dot is not allowed, which is what makes a bare `owner/repo`
 * distinguishable from an unqualified `some.host/path`.
 */
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

/** GitHub's repository-name grammar: alphanumerics, dot, underscore, hyphen; ≤100. */
const REPO = /^[A-Za-z0-9._-]{1,100}$/;

/** Every rejection names one form the field will accept, so the error can be acted on. */
const EXAMPLE = 'github.com/acme/monorepo';

export type ParsedRepositoryUrl = { ok: true; ref: RepositoryRef } | { ok: false; message: string };

function reject(message: string): ParsedRepositoryUrl {
  return { ok: false, message };
}

/**
 * Parses a submitted repository URL, returning either a reference or a message to render
 * against the field.
 *
 * A result rather than a throw: the message is shown to whoever typed it, and both the
 * browser (on submit and on blur) and the route handler (on every request) need the same
 * text. `ingest/github.ts`'s `parseRepositoryRef` is deliberately *not* reused — it is the
 * CLI's parser and accepts a trailing path (`…/pull/42` resolves to the repository), which
 * is right for an operator typing a flag and wrong for a public request that becomes an
 * API path.
 */
export function parseRepositoryUrl(input: string): ParsedRepositoryUrl {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return reject(`Enter a GitHub repository URL — Grain needs an owner and a repo, like ${EXAMPLE}.`);
  }

  // Query and fragment first: a URL copied out of the browser carries `?tab=…`, and the
  // path segments have to be counted without it.
  const withoutQuery = trimmed.split(/[?#]/, 1)[0];
  const withoutScheme = withoutQuery.replace(/^https?:\/\//i, '');
  const hostless = withoutScheme.replace(/^www\./i, '');

  const [first, ...rest] = hostless.split('/');
  const onGitHub = first.toLowerCase() === 'github.com';
  if (!onGitHub && first.includes('.')) {
    return reject(`Grain only analyzes repositories on github.com, like ${EXAMPLE}.`);
  }

  const segments = onGitHub ? [...rest] : [first, ...rest];
  // Exactly one trailing empty segment, which is a trailing slash. Any *other* empty
  // segment is left in place and fails the owner or repository grammar below — so
  // `github.com//xyflow` is rejected rather than quietly resolving to `/xyflow`, and
  // `github.com/xyflow//xyflow` is three segments rather than two.
  if (segments.length > 0 && segments[segments.length - 1] === '') segments.pop();

  if (segments.length < 2) {
    return reject(`That isn't a repository URL — Grain needs an owner and a repo, like ${EXAMPLE}.`);
  }
  if (segments.length > 2) {
    return reject(`That URL points inside a repository — Grain needs just the owner and the repo, like ${EXAMPLE}.`);
  }

  const owner = segments[0];
  // One trailing `.git`, so a repository genuinely named `thing.git` survives a clone URL.
  const repo = segments[1].replace(/\.git$/, '');

  if (!OWNER.test(owner)) {
    return reject(`"${owner}" isn't a GitHub owner — Grain needs an owner and a repo, like ${EXAMPLE}.`);
  }
  // `.` and `..` satisfy the character class but are path traversal, not repositories —
  // and this string is about to be interpolated into a GitHub API path.
  if (!REPO.test(repo) || repo === '.' || repo === '..') {
    return reject(`"${repo}" isn't a GitHub repository name — Grain needs one like ${EXAMPLE}.`);
  }
  // `__proto__`, `constructor` and `prototype` all pass GitHub's repository grammar and
  // would go on to key the enrichment cache. `assertSafeKey` would throw at that point;
  // rejecting here turns it into a message the field can show.
  if (RESERVED_KEYS.includes(repo) || RESERVED_KEYS.includes(owner)) {
    return reject(`"${owner}/${repo}" uses a reserved name Grain cannot key on — try one like ${EXAMPLE}.`);
  }

  return { ok: true, ref: { owner, repo } };
}

/** The window a live analysis looks back over when nothing is configured. */
export const DEFAULT_WINDOW_DAYS = 90;

/**
 * The widest window an operator may configure. A year of a busy monorepo is far more than
 * `MAX_PULL_REQUESTS` worth of merges, and the listing walk pages until an entire page
 * falls below `since` — so the window, not just the count, has to have a ceiling.
 */
export const MAX_WINDOW_DAYS = 365;

export type AnalysisBounds = {
  /** Inclusive ISO 8601 lower bound on the merge date. */
  since: string;
  /** Exclusive ISO 8601 upper bound on the merge date. */
  until: string;
  maxPullRequests: number;
  windowDays: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1_000;

/**
 * Reads a bound from the environment. Absent or empty takes the default; present but
 * unusable throws, because an operator's typo silently becoming 90 days is exactly the
 * failure a configured ceiling exists to prevent.
 */
function readBound(
  env: Record<string, string | undefined>,
  name: string,
  fallback: number,
  max: number,
): number {
  const raw = env[name]?.trim();
  if (raw === undefined || raw.length === 0) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`${name}="${raw}" is not usable — it must be a whole number between 1 and ${max}`);
  }
  return value;
}

/**
 * The window and the ceiling a live analysis runs under, resolved before any fetch starts
 * (Principle 6).
 *
 * `now` is a parameter rather than a call to `Date.now()`, for the same reason
 * `ingestRepository` takes `analyzedAt`: the bounds are then a pure function of their
 * inputs and can be asserted exactly.
 */
export function resolveAnalysisBounds(options: {
  now: Date;
  env: Record<string, string | undefined>;
}): AnalysisBounds {
  const windowDays = readBound(options.env, 'GRAIN_ANALYSIS_WINDOW_DAYS', DEFAULT_WINDOW_DAYS, MAX_WINDOW_DAYS);
  const maxPullRequests = readBound(
    options.env,
    'GRAIN_MAX_PULL_REQUESTS',
    DEFAULT_MAX_PULL_REQUESTS,
    MAX_PULL_REQUESTS,
  );

  const until = options.now.toISOString();
  const since = new Date(options.now.getTime() - windowDays * MS_PER_DAY).toISOString();

  return { since, until, maxPullRequests, windowDays };
}
