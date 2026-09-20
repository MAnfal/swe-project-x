import { describe, expect, it } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';

import {
  DEFAULT_ENRICHMENT_MODEL,
  FALLBACK_APPROACH,
  MAX_APPROACH_CHARS,
  MAX_LABEL_CHARS,
  MAX_PROMPT_BODY_CHARS,
  MAX_PROMPT_COMMITS,
  MAX_PROMPT_FILES,
  MAX_STEPS,
  MAX_STEP_SUMMARY_CHARS,
  buildEnrichmentPrompt,
  enrichPullRequest,
  enrichSnapshot,
  fallbackEnrichment,
  enrichmentKey,
  isFallbackEnrichment,
  modelEnrichmentSchema,
} from '@/lib/ai/enrichment';
import { enrichmentEntrySchema, snapshotSchema, type PullRequestRecord, type Snapshot } from '@/lib/snapshot';

const MERGE_SHA = '1f0c2d3e4a5b6c7d8e9f0a1b2c3d4e5f60718293';
const COMMIT_A = 'aaaaaaaabbbbbbbbccccccccddddddddeeeeeeee';
const COMMIT_B = 'ffffffff11111111222222223333333344444444';

function pullRequest(overrides: Partial<PullRequestRecord> = {}): PullRequestRecord {
  return {
    number: 5989,
    title: 'feat(system): add global site settings',
    body: 'Adds a settings table and threads it into the render config.',
    author: 'moklick',
    mergedAt: '2026-08-31T09:22:57Z',
    mergeCommitSha: MERGE_SHA,
    url: 'https://github.com/xyflow/xyflow/pull/5989',
    commits: [
      { sha: COMMIT_A, message: 'add site_settings table' },
      { sha: COMMIT_B, message: 'read settings in render config' },
    ],
    files: [
      { path: 'migrations/0042_add_site_settings.sql', additions: 12, deletions: 0, status: 'added', package: null },
      {
        path: 'packages/system/src/render-config.ts',
        additions: 8,
        deletions: 2,
        status: 'modified',
        package: '@xyflow/system',
      },
    ],
    directPackages: ['@xyflow/system'],
    indirectPackages: [],
    ...overrides,
  };
}

function snapshot(pullRequests: PullRequestRecord[], enrichment?: Snapshot['enrichment']): Snapshot {
  return snapshotSchema.parse({
    metadata: {
      repository: { owner: 'xyflow', name: 'xyflow' },
      window: { since: '2026-08-31T00:00:00Z', until: '2026-09-02T00:00:00Z' },
      analyzedAt: '2026-09-20T00:00:00.000Z',
      packageCount: 1,
      pullRequestCount: pullRequests.length,
    },
    packages: {
      nodes: [{ name: '@xyflow/system', path: 'packages/system', manifestPath: 'packages/system/package.json' }],
      edges: [],
    },
    pullRequests,
    ...(enrichment ? { enrichment } : {}),
  });
}

/** A mock whose every call returns `object`, in the nested V4 usage shape the SDK reads. */
function modelReturning(object: unknown, usage = { input: 900, output: 120 }): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text: JSON.stringify(object) }],
      finishReason: { unified: 'stop' as const, raw: 'end_turn' },
      usage: {
        inputTokens: { total: usage.input, noCache: usage.input, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: usage.output, text: usage.output, reasoning: 0 },
      },
      warnings: [],
    }),
  });
}

function modelThrowing(message: string): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => {
      throw new Error(message);
    },
  });
}

const goodOutput = {
  label: 'Added global site settings',
  approach:
    'Wired site settings straight into the render config rather than routing them through the existing settings resolver.',
  steps: [
    { commitSha: COMMIT_A, summary: 'Added a DB column' },
    { commitSha: COMMIT_B, summary: 'Changed render config to accept settings' },
  ],
};

describe('modelEnrichmentSchema', () => {
  it('accepts a well-formed model response', () => {
    expect(modelEnrichmentSchema.parse(goodOutput).approach).toBe(goodOutput.approach);
  });

  it('rejects a response with no approach note', () => {
    const withoutApproach = { label: goodOutput.label, steps: goodOutput.steps };
    const result = modelEnrichmentSchema.safeParse(withoutApproach);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('approach');
  });

  it('rejects a step list longer than the renderable bound', () => {
    const tooMany = {
      ...goodOutput,
      steps: Array.from({ length: MAX_STEPS + 1 }, () => ({ commitSha: COMMIT_A, summary: 'did a thing' })),
    };
    const result = modelEnrichmentSchema.safeParse(tooMany);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('steps');
  });

  it('rejects an empty step list, which the snapshot schema also forbids', () => {
    expect(modelEnrichmentSchema.safeParse({ ...goodOutput, steps: [] }).success).toBe(false);
  });

  it('rejects a label or approach longer than the bound', () => {
    expect(modelEnrichmentSchema.safeParse({ ...goodOutput, label: 'x'.repeat(MAX_LABEL_CHARS + 1) }).success).toBe(
      false,
    );
    expect(
      modelEnrichmentSchema.safeParse({ ...goodOutput, approach: 'x'.repeat(MAX_APPROACH_CHARS + 1) }).success,
    ).toBe(false);
  });
});

describe('modelEnrichmentSchema field descriptions', () => {
  it('state the character budget in the description, not only as a maxLength the model never reads', () => {
    const shape = modelEnrichmentSchema.shape;
    const stepSummary = shape.steps.element.shape.summary;

    expect(shape.label.description).toContain(String(MAX_LABEL_CHARS));
    expect(shape.approach.description).toContain(String(MAX_APPROACH_CHARS));
    expect(stepSummary.description).toContain(String(MAX_STEP_SUMMARY_CHARS));
  });
});

describe('enrichmentKey', () => {
  it('is the merge commit SHA when GitHub reported one', () => {
    expect(enrichmentKey(pullRequest())).toBe(MERGE_SHA);
  });

  it('falls back to the pull request number when the merge SHA is null', () => {
    expect(enrichmentKey(pullRequest({ mergeCommitSha: null }))).toBe('5989');
  });
});

describe('enrichPullRequest', () => {
  it('returns the model label, approach and ordered steps', async () => {
    const model = modelReturning(goodOutput);
    const outcome = await enrichPullRequest({ model, pullRequest: pullRequest() });

    expect(outcome.failed).toBe(false);
    expect(outcome.entry.label).toBe('Added global site settings');
    expect(outcome.entry.approach).toBe(goodOutput.approach);
    expect(outcome.entry.steps.map((step) => step.summary)).toEqual([
      'Added a DB column',
      'Changed render config to accept settings',
    ]);
    expect(isFallbackEnrichment(outcome.entry)).toBe(false);
    expect(enrichmentEntrySchema.safeParse(outcome.entry).success).toBe(true);
  });

  it('resolves an abbreviated step SHA to the pull request commit it names', async () => {
    const model = modelReturning({
      ...goodOutput,
      steps: [{ commitSha: COMMIT_A.slice(0, 7), summary: 'Added a DB column' }],
    });
    const outcome = await enrichPullRequest({ model, pullRequest: pullRequest() });

    expect(outcome.entry.steps[0].commitSha).toBe(COMMIT_A);
  });

  it('resolves a SHA the model mistyped in its tail, seen in the real bake', async () => {
    // shadcn-ui/ui#11861 came back as a 37-character SHA: the model dropped characters
    // while copying. The leading prefix still identifies exactly one commit.
    const mangled = `${COMMIT_A.slice(0, 20)}${COMMIT_A.slice(22, 39)}`;
    expect(mangled).not.toBe(COMMIT_A);

    const outcome = await enrichPullRequest({
      model: modelReturning({ ...goodOutput, steps: [{ commitSha: mangled, summary: 'Added a DB column' }] }),
      pullRequest: pullRequest(),
    });

    expect(outcome.failed).toBe(false);
    expect(outcome.entry.steps[0].commitSha).toBe(COMMIT_A);
  });

  it('reports the tokens the call consumed', async () => {
    const model = modelReturning(goodOutput, { input: 1234, output: 56 });
    const outcome = await enrichPullRequest({ model, pullRequest: pullRequest() });

    expect(outcome.usage).toEqual({ inputTokens: 1234, outputTokens: 56 });
  });

  it('degrades to the pull request title when the model call throws', async () => {
    const outcome = await enrichPullRequest({
      model: modelThrowing('connection reset by peer'),
      pullRequest: pullRequest(),
    });

    expect(outcome.failed).toBe(true);
    expect(outcome.entry.label).toBe('feat(system): add global site settings');
    expect(outcome.entry.approach).toBe(FALLBACK_APPROACH);
    expect(isFallbackEnrichment(outcome.entry)).toBe(true);
    expect(enrichmentEntrySchema.safeParse(outcome.entry).success).toBe(true);
    expect(outcome.error).toContain('connection reset by peer');
  });

  it('degrades when the model returns output the schema rejects', async () => {
    const outcome = await enrichPullRequest({
      model: modelReturning({ label: 'Added global site settings' }),
      pullRequest: pullRequest(),
    });

    expect(outcome.failed).toBe(true);
    expect(outcome.entry.label).toBe('feat(system): add global site settings');
    expect(isFallbackEnrichment(outcome.entry)).toBe(true);
  });

  it('degrades when a step names a commit the pull request does not contain', async () => {
    const outcome = await enrichPullRequest({
      model: modelReturning({
        ...goodOutput,
        steps: [{ commitSha: '0000000000000000000000000000000000000000', summary: 'invented' }],
      }),
      pullRequest: pullRequest(),
    });

    expect(outcome.failed).toBe(true);
    expect(isFallbackEnrichment(outcome.entry)).toBe(true);
    expect(outcome.error).toContain('0000000');
  });

  it('never calls the model for a pull request with no commits, which can have no step chain', async () => {
    const model = modelReturning(goodOutput);
    const outcome = await enrichPullRequest({ model, pullRequest: pullRequest({ commits: [] }) });

    expect(model.doGenerateCalls).toHaveLength(0);
    expect(outcome.failed).toBe(true);
    expect(outcome.error).toContain('no commits');
    expect(outcome.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(isFallbackEnrichment(outcome.entry)).toBe(true);
    expect(enrichmentEntrySchema.safeParse(outcome.entry).success).toBe(true);
  });

  it('labels a titleless pull request by its number rather than an empty string', async () => {
    const outcome = await enrichPullRequest({
      model: modelThrowing('boom'),
      pullRequest: pullRequest({ title: '' }),
    });

    expect(outcome.entry.label).toBe('Pull request #5989');
    expect(enrichmentEntrySchema.safeParse(outcome.entry).success).toBe(true);
  });
});

describe('buildEnrichmentPrompt', () => {
  it('carries the title, the commit messages and the changed paths', () => {
    const prompt = buildEnrichmentPrompt(pullRequest());

    expect(prompt).toContain('feat(system): add global site settings');
    expect(prompt).toContain('add site_settings table');
    expect(prompt).toContain('migrations/0042_add_site_settings.sql');
    expect(prompt).toContain(COMMIT_A);
  });

  it('never carries a patch — only metadata', () => {
    const prompt = buildEnrichmentPrompt(pullRequest());

    expect(prompt).not.toContain('@@');
    expect(prompt).not.toContain('diff --git');
  });

  it('bounds a pathological pull request before the call', () => {
    const huge = pullRequest({
      body: `${'b'.repeat(MAX_PROMPT_BODY_CHARS * 3)}TAIL_MARKER`,
      commits: Array.from({ length: MAX_PROMPT_COMMITS + 25 }, (_, index) => ({
        sha: index.toString(16).padStart(40, '0'),
        message: `commit number ${index}`,
      })),
      files: Array.from({ length: MAX_PROMPT_FILES + 40 }, (_, index) => ({
        path: `packages/system/src/file-${index}.ts`,
        additions: 1,
        deletions: 0,
        status: 'modified',
        package: '@xyflow/system',
      })),
    });
    const prompt = buildEnrichmentPrompt(huge);

    expect(prompt).not.toContain('TAIL_MARKER');
    expect(prompt).not.toContain(`commit number ${MAX_PROMPT_COMMITS + 10}`);
    expect(prompt).not.toContain(`file-${MAX_PROMPT_FILES + 10}.ts`);
    expect(prompt).toContain('commit number 0');
    expect(prompt).toContain('file-0.ts');
  });
});

describe('enrichSnapshot', () => {
  it('writes an entry keyed by merge SHA for every pull request', async () => {
    const model = modelReturning(goodOutput);
    const result = await enrichSnapshot({ snapshot: snapshot([pullRequest()]), model });

    expect(result.snapshot.enrichment?.[MERGE_SHA]?.label).toBe('Added global site settings');
    expect(result.enriched).toBe(1);
    expect(result.reused).toBe(0);
    expect(result.failed).toBe(0);
    expect(snapshotSchema.safeParse(result.snapshot).success).toBe(true);
  });

  it('makes no model call for a pull request this snapshot already carries', async () => {
    const stored = {
      label: 'Stored label from an earlier bake',
      approach: 'Stored approach note.',
      steps: [{ commitSha: COMMIT_A, summary: 'stored step' }],
    };
    const model = modelReturning(goodOutput);
    const result = await enrichSnapshot({
      snapshot: snapshot([pullRequest()], { [MERGE_SHA]: stored }),
      model,
    });

    expect(model.doGenerateCalls).toHaveLength(0);
    expect(result.snapshot.enrichment?.[MERGE_SHA]).toEqual(stored);
    expect(result.reused).toBe(1);
    expect(result.enriched).toBe(0);
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it('retries a pull request whose stored entry is a degraded fallback', async () => {
    const model = modelReturning(goodOutput);
    const result = await enrichSnapshot({
      snapshot: snapshot([pullRequest()], { [MERGE_SHA]: fallbackEnrichment(pullRequest()) }),
      model,
    });

    expect(model.doGenerateCalls).toHaveLength(1);
    expect(result.reused).toBe(0);
    expect(result.enriched).toBe(1);
    expect(result.snapshot.enrichment?.[MERGE_SHA]?.label).toBe('Added global site settings');
  });

  it('still enriches the pull requests a stored entry does not cover', async () => {
    const other = pullRequest({ number: 6001, mergeCommitSha: COMMIT_B, title: 'chore: bump deps' });
    const stored = {
      label: 'Stored label',
      approach: 'Stored approach note.',
      steps: [{ commitSha: COMMIT_A, summary: 'stored step' }],
    };
    const model = modelReturning(goodOutput);
    const result = await enrichSnapshot({
      snapshot: snapshot([pullRequest(), other], { [MERGE_SHA]: stored }),
      model,
    });

    expect(model.doGenerateCalls).toHaveLength(1);
    expect(result.reused).toBe(1);
    expect(result.enriched).toBe(1);
    expect(result.snapshot.enrichment?.[COMMIT_B]?.label).toBe('Added global site settings');
  });

  it('surfaces a failure instead of swallowing it, and still labels the node', async () => {
    const result = await enrichSnapshot({
      snapshot: snapshot([pullRequest()]),
      model: modelThrowing('502 Bad Gateway'),
    });

    expect(result.failed).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].key).toBe(MERGE_SHA);
    expect(result.failures[0].number).toBe(5989);
    expect(result.failures[0].error).toContain('502 Bad Gateway');
    expect(result.snapshot.enrichment?.[MERGE_SHA]?.label).toBe('feat(system): add global site settings');
    expect(snapshotSchema.safeParse(result.snapshot).success).toBe(true);
  });

  it('sums the tokens every call consumed', async () => {
    const other = pullRequest({ number: 6001, mergeCommitSha: COMMIT_B });
    const result = await enrichSnapshot({
      snapshot: snapshot([pullRequest(), other]),
      model: modelReturning(goodOutput, { input: 700, output: 90 }),
    });

    expect(result.usage).toEqual({ inputTokens: 1400, outputTokens: 180 });
  });

  it('refuses a merge SHA that would be written as a reserved object key', async () => {
    await expect(
      enrichSnapshot({
        snapshot: snapshot([pullRequest({ mergeCommitSha: '__proto__' })]),
        model: modelReturning(goodOutput),
      }),
    ).rejects.toThrow(/reserved object key/);
  });
});

describe('DEFAULT_ENRICHMENT_MODEL', () => {
  it('is Haiku 4.5, per ORCHESTRATOR.md design decision 10', () => {
    expect(DEFAULT_ENRICHMENT_MODEL).toBe('claude-haiku-4-5');
  });
});
