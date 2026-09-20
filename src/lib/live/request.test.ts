import { describe, expect, it } from 'vitest';

import {
  DEFAULT_WINDOW_DAYS,
  MAX_WINDOW_DAYS,
  parseRepositoryUrl,
  resolveAnalysisBounds,
} from '@/lib/live/request';
import { DEFAULT_MAX_PULL_REQUESTS, MAX_PULL_REQUESTS } from '@/lib/snapshot';

/**
 * The submitted repository becomes an API path and part of a cache key, so this is the
 * boundary `.claude/resources/sops/planning/boundary-validation.md` governs: everything a
 * request supplies is checked here, before anything downstream uses it.
 */

describe('parseRepositoryUrl', () => {
  const accepted: [string, { owner: string; repo: string }][] = [
    ['https://github.com/xyflow/xyflow', { owner: 'xyflow', repo: 'xyflow' }],
    ['http://github.com/xyflow/xyflow', { owner: 'xyflow', repo: 'xyflow' }],
    ['https://www.github.com/shadcn-ui/ui', { owner: 'shadcn-ui', repo: 'ui' }],
    ['github.com/trpc/trpc', { owner: 'trpc', repo: 'trpc' }],
    ['  https://github.com/xyflow/xyflow/  ', { owner: 'xyflow', repo: 'xyflow' }],
    ['https://github.com/xyflow/xyflow.git', { owner: 'xyflow', repo: 'xyflow' }],
    ['https://github.com/xyflow/xyflow?tab=readme-ov-file', { owner: 'xyflow', repo: 'xyflow' }],
    ['https://github.com/xyflow/xyflow#readme', { owner: 'xyflow', repo: 'xyflow' }],
    // A repository whose name really does end in `.git` survives, because only one
    // trailing `.git` is stripped.
    ['github.com/acme/thing.git.git', { owner: 'acme', repo: 'thing.git' }],
    // The bare form, unambiguous because an owner may not contain a dot.
    ['xyflow/xyflow', { owner: 'xyflow', repo: 'xyflow' }],
  ];

  it.each(accepted)('accepts %s', (input, ref) => {
    const result = parseRepositoryUrl(input);
    expect(result.ok && result.ref).toEqual(ref);
  });

  const rejected: [string, string, RegExp][] = [
    ['a blank value', '', /owner and a repo/i],
    ['whitespace only', '   ', /owner and a repo/i],
    ['a non-GitHub host', 'https://gitlab.com/acme/monorepo', /only analyzes repositories on github\.com/i],
    ['a non-GitHub host without a scheme', 'gitlab.com/acme/monorepo', /only analyzes repositories on github\.com/i],
    ['a non-GitHub host with two path segments', 'https://example.com/acme', /only analyzes repositories on github\.com/i],
    ['an owner with no repository', 'https://github.com/acme', /owner and a repo/i],
    ['a path with extra segments', 'https://github.com/acme/monorepo/pull/42', /inside a repository/i],
    ['a path with extra segments behind a query', 'github.com/acme/monorepo/pulls?q=is:open', /inside a repository/i],
    ['a traversal segment as the owner', 'github.com/../monorepo', /owner/i],
    ['a traversal segment as the repository', 'github.com/acme/..', /repository name/i],
    ['an owner containing a slash escape', 'github.com/ac%2fme/monorepo', /owner/i],
    ['an owner starting with a hyphen', 'github.com/-acme/monorepo', /owner/i],
    ['an owner longer than GitHub allows', `github.com/${'a'.repeat(40)}/monorepo`, /owner/i],
    ['a repository name longer than GitHub allows', `github.com/acme/${'r'.repeat(101)}`, /repository name/i],
    ['a repository name with a space', 'github.com/acme/mono repo', /repository name/i],
  ];

  it.each(rejected)('rejects %s', (_label, input, message) => {
    const result = parseRepositoryUrl(input);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toMatch(message);
  });

  it('names the example form in every rejection, so the field can show one message', () => {
    for (const [, input] of rejected) {
      const result = parseRepositoryUrl(input);
      expect(result.ok === false && result.message).toContain('github.com/acme/monorepo');
    }
  });

  // An empty path segment must never shift the parts along into `xyflow/xyflow`. The
  // expected messages differ on purpose: they pin *where* each one was rejected, so a
  // rule that dropped every empty segment instead of only a trailing one is caught.
  it.each([
    ['github.com//xyflow', /isn't a GitHub owner/i],
    ['github.com/xyflow/', /owner and a repo/i],
    ['github.com/xyflow//xyflow', /inside a repository/i],
  ])('rejects %s', (input, message) => {
    const result = parseRepositoryUrl(input);
    expect(result.ok, input).toBe(false);
    expect(result.ok === false && result.message).toMatch(message);
  });

  it('rejects a reserved object key as the owner, which GitHub would otherwise allow', () => {
    // `constructor` and `prototype` are valid GitHub logins — they pass the owner grammar
    // and only the reserved-key check stops them.
    for (const owner of ['constructor', 'prototype']) {
      const result = parseRepositoryUrl(`github.com/${owner}/monorepo`);
      expect(result.ok, owner).toBe(false);
      expect(result.ok === false && result.message).toMatch(/reserved/i);
    }
  });

  it('rejects a reserved object key as the repository, which would become a cache key', () => {
    // `__proto__` passes GitHub's own repository-name grammar, so the reserved-key check
    // has to be explicit rather than inherited from the character class.
    const result = parseRepositoryUrl('github.com/acme/__proto__');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toMatch(/reserved/i);
  });
});

describe('resolveAnalysisBounds', () => {
  const now = new Date('2026-09-20T12:00:00.000Z');

  it('defaults to the last 90 days and 100 pull requests', () => {
    const bounds = resolveAnalysisBounds({ now, env: {} });
    expect(bounds).toEqual({
      since: '2026-06-22T12:00:00.000Z',
      until: '2026-09-20T12:00:00.000Z',
      maxPullRequests: DEFAULT_MAX_PULL_REQUESTS,
      windowDays: DEFAULT_WINDOW_DAYS,
    });
  });

  it('reads the window and the ceiling from configuration', () => {
    const bounds = resolveAnalysisBounds({
      now,
      env: { GRAIN_ANALYSIS_WINDOW_DAYS: '7', GRAIN_MAX_PULL_REQUESTS: '25' },
    });
    expect(bounds.since).toBe('2026-09-13T12:00:00.000Z');
    expect(bounds.until).toBe('2026-09-20T12:00:00.000Z');
    expect(bounds.maxPullRequests).toBe(25);
    expect(bounds.windowDays).toBe(7);
  });

  const invalid: [string, Record<string, string>][] = [
    ['a non-numeric window', { GRAIN_ANALYSIS_WINDOW_DAYS: 'ninety' }],
    ['a zero window', { GRAIN_ANALYSIS_WINDOW_DAYS: '0' }],
    ['a fractional window', { GRAIN_ANALYSIS_WINDOW_DAYS: '1.5' }],
    ['a window above the ceiling', { GRAIN_ANALYSIS_WINDOW_DAYS: String(MAX_WINDOW_DAYS + 1) }],
    ['a non-numeric ceiling', { GRAIN_MAX_PULL_REQUESTS: 'lots' }],
    ['a zero ceiling', { GRAIN_MAX_PULL_REQUESTS: '0' }],
    ['a ceiling above the snapshot limit', { GRAIN_MAX_PULL_REQUESTS: String(MAX_PULL_REQUESTS + 1) }],
  ];

  it.each(invalid)('refuses to start on %s rather than silently defaulting', (_label, env) => {
    expect(() => resolveAnalysisBounds({ now, env })).toThrow(/GRAIN_/);
  });

  it('treats an empty string as unset, because that is what an unfilled .env line gives', () => {
    const bounds = resolveAnalysisBounds({
      now,
      env: { GRAIN_ANALYSIS_WINDOW_DAYS: '', GRAIN_MAX_PULL_REQUESTS: '' },
    });
    expect(bounds.windowDays).toBe(DEFAULT_WINDOW_DAYS);
    expect(bounds.maxPullRequests).toBe(DEFAULT_MAX_PULL_REQUESTS);
  });
});
