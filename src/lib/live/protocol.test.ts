import { describe, expect, it } from 'vitest';

import {
  ANALYSIS_STEPS,
  classifyFailure,
  decodeEvents,
  encodeEvent,
  type AnalysisEvent,
} from '@/lib/live/protocol';

/** A GitHub error as `@octokit/request-error` 7.1.2 shapes it: status, message, response. */
function requestError(status: number, message: string, headers: Record<string, string> = {}) {
  return Object.assign(new Error(message), { status, response: { status, headers, url: '', data: {} } });
}

describe('ANALYSIS_STEPS', () => {
  it('names the five steps the progress view draws, in pipeline order', () => {
    expect(ANALYSIS_STEPS.map((step) => step.id)).toEqual([
      'resolve',
      'topology',
      'pull-requests',
      'details',
      'attribute',
    ]);
    expect(ANALYSIS_STEPS.every((step) => step.label.length > 0)).toBe(true);
  });

  it('promises nothing about work continuing after the request ends', () => {
    // The designs' page 3 says analysis keeps running with the tab closed. It does not —
    // this prototype analyzes inside the request — so no label may imply that it does.
    for (const step of ANALYSIS_STEPS) {
      expect(step.label).not.toMatch(/background|resume|keeps? running|come back/i);
    }
  });
});

describe('NDJSON framing', () => {
  const progress: AnalysisEvent = {
    type: 'progress',
    progress: { step: 'details', done: 3, total: 6 },
  };
  const failed: AnalysisEvent = { type: 'failed', kind: 'rate-limit', message: 'spent', step: 'details' };

  it('round-trips a whole event', () => {
    const { events, rest } = decodeEvents(encodeEvent(progress), '');
    expect(events).toEqual([progress]);
    expect(rest).toBe('');
  });

  it('holds a partial line back until its newline arrives', () => {
    const wire = encodeEvent(progress) + encodeEvent(failed);
    const split = wire.length - 10;

    const first = decodeEvents(wire.slice(0, split), '');
    expect(first.events).toEqual([progress]);
    expect(first.rest.length).toBeGreaterThan(0);

    const second = decodeEvents(wire.slice(split), first.rest);
    expect(second.events).toEqual([failed]);
    expect(second.rest).toBe('');
  });

  it('never emits a newline inside a frame, so a line is always one event', () => {
    const wire = encodeEvent({
      type: 'failed',
      kind: 'failed',
      message: 'line one\nline two',
      step: 'resolve',
    });
    expect(wire.split('\n').filter((line) => line.length > 0)).toHaveLength(1);
    expect(decodeEvents(wire, '').events[0]).toMatchObject({ message: 'line one\nline two' });
  });

  it('skips a blank line rather than reporting it as a malformed event', () => {
    expect(decodeEvents(`\n${encodeEvent(progress)}\n`, '').events).toEqual([progress]);
  });
});

describe('classifyFailure', () => {
  it('reads a missing repository as not-found', () => {
    const failure = classifyFailure(requestError(404, 'Not Found'), 'resolve');
    expect(failure.kind).toBe('not-found');
    expect(failure.message).toMatch(/can't see|cannot see|not found/i);
  });

  it('reads an exhausted primary rate limit as rate-limit, with the reset time', () => {
    const failure = classifyFailure(
      requestError(403, 'API rate limit exceeded', {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1789000000',
      }),
      'details',
    );
    expect(failure.kind).toBe('rate-limit');
    expect(failure.resetAt).toBe(new Date(1_789_000_000_000).toISOString());
  });

  it('reads a secondary rate limit as rate-limit even with quota remaining', () => {
    const failure = classifyFailure(
      requestError(403, 'You have exceeded a secondary rate limit', { 'x-ratelimit-remaining': '4211' }),
      'details',
    );
    expect(failure.kind).toBe('rate-limit');
    expect(failure.resetAt).toBeUndefined();
  });

  it('reads a 429 as rate-limit', () => {
    expect(classifyFailure(requestError(429, 'Too Many Requests'), 'details').kind).toBe('rate-limit');
  });

  it('reads a rejected token as a configuration failure, without echoing the token', () => {
    const failure = classifyFailure(requestError(401, 'Bad credentials'), 'resolve');
    expect(failure.kind).toBe('failed');
    expect(failure.message).toMatch(/token/i);
  });

  it('reads a 403 that is not about quota as a plain failure', () => {
    const failure = classifyFailure(requestError(403, 'Resource not accessible by integration'), 'topology');
    expect(failure.kind).toBe('failed');
  });

  it('reads an upstream 502 as a plain failure and keeps the status in the detail', () => {
    const failure = classifyFailure(requestError(502, 'Bad gateway'), 'details');
    expect(failure.kind).toBe('failed');
    expect(failure.detail).toContain('502');
  });

  it('reads an aborted request as cancelled', () => {
    const failure = classifyFailure(new DOMException('The operation was aborted.', 'AbortError'), 'details');
    expect(failure.kind).toBe('cancelled');
  });

  it('reads a fetch timeout as cancelled, the same as an explicit abort', () => {
    // undici raises `TimeoutError` rather than `AbortError` when a request times out;
    // both mean the request ended without an answer and neither is worth a red screen.
    const timeout = new Error('fetch timed out');
    timeout.name = 'TimeoutError';
    expect(classifyFailure(timeout, 'details').kind).toBe('cancelled');
  });

  it('omits the reset time when GitHub sends one that is not a number', () => {
    const failure = classifyFailure(
      requestError(429, 'Too Many Requests', { 'x-ratelimit-reset': 'soon' }),
      'details',
    );
    expect(failure.kind).toBe('rate-limit');
    expect(failure.resetAt).toBeUndefined();
  });

  it('reads an error whose response carries no headers', () => {
    const bare = Object.assign(new Error('Not Found'), { status: 404, response: { status: 404 } });
    expect(classifyFailure(bare, 'resolve').kind).toBe('not-found');
  });

  it('reads a non-Error throw without crashing', () => {
    const failure = classifyFailure('something went sideways', 'attribute');
    expect(failure.kind).toBe('failed');
    expect(failure.message.length).toBeGreaterThan(0);
  });

  it('carries the step it failed on, so the surface can say where it stopped', () => {
    expect(classifyFailure(requestError(404, 'Not Found'), 'topology').step).toBe('topology');
  });

  it('never promises that partial progress was kept', () => {
    const messages = [
      classifyFailure(requestError(404, 'Not Found'), 'resolve'),
      classifyFailure(requestError(502, 'Bad gateway'), 'details'),
      classifyFailure(requestError(403, 'API rate limit exceeded', { 'x-ratelimit-remaining': '0' }), 'details'),
    ].map((failure) => failure.message);

    for (const message of messages) {
      expect(message).not.toMatch(/resum|already fetched|kept|from step|continue/i);
    }
  });
});
