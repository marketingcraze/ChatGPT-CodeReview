import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ReviewRun } from '../src/contracts';
import {
  encodeReviewRunMarker,
  formatReviewBody,
  parseReviewRunMarker,
  writeActionOutputs,
} from '../src/report';

const run: ReviewRun = {
  schemaVersion: 1,
  runId: 'repo#1:initial:abc',
  mode: 'initial',
  repository: 'owner/repo',
  pullRequest: 1,
  baseSha: 'a'.repeat(40),
  headSha: 'b'.repeat(40),
  startedAt: '2026-08-04T00:00:00Z',
  completedAt: '2026-08-04T00:00:01Z',
  initialModel: 'gpt-5.6-luna',
  validationModel: 'gpt-5.6-luna',
  contextValidationModel: 'gpt-5.6-terra',
  escalationModel: 'gpt-5.6-sol',
  gitnexus: {
    schemaVersion: 1,
    requestedVersion: '1.6.9',
    compatibilityMode: 'v1.6.9-normalized',
    repository: '/repo',
    branch: 'feature',
    indexCommit: 'b'.repeat(40),
    currentCommit: 'b'.repeat(40),
    incompleteReasons: [],
    status: 'up-to-date',
    restoreSource: 'exact_artifact',
    incrementalUpdateAttempted: false,
    forcedRebuildAttempted: false,
  },
  timings: [],
  modelUsage: [],
  contextRequests: [],
  findings: [
    {
      id: 'f1',
      title: 'Finding',
      description: 'Description',
      severity: 'high',
      action: 'change_or_remove',
      confidence: 0.9,
      disposition: 'retained',
      evidence: [
        {
          repositorySha: 'b'.repeat(40),
          file: 'src/file.ts',
          lineStart: 1,
          lineEnd: 1,
          excerptHash: 'sha256:hash',
          excerpt: 'private source excerpt',
        },
      ],
      validationNote: 'Validated',
    },
  ],
  verdict: {
    status: 'changes_required',
    summary: 'Blocking evidence remains.',
    blockingFindingIds: ['f1'],
    evidenceGaps: [],
  },
};

describe('review reporting', () => {
  test('round-trips duplicate-event marker without serializing source excerpts', () => {
    const parsed = parseReviewRunMarker(encodeReviewRunMarker(run));
    expect(parsed?.runId).toBe(run.runId);
    expect(parsed?.findings[0].evidence[0].excerpt).toBe('[redacted]');
  });

  test('formats discrete evidence links without leaking the excerpt', () => {
    const body = formatReviewBody(run);
    expect(body).toContain('changes_required');
    expect(body).toContain('src/file.ts:1-1');
    expect(body).not.toContain('private source excerpt');
  });

  test('writes declared structured Action outputs without excerpts', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'output-test-'));
    const output = path.join(root, 'github-output');
    const prior = process.env.GITHUB_OUTPUT;
    process.env.GITHUB_OUTPUT = output;
    try {
      await writeActionOutputs(run);
      const written = await fs.readFile(output, 'utf8');
      expect(written).toContain('verdict');
      expect(written).toContain('changes_required');
      expect(written).toContain('gitnexus_restore_source');
      expect(written).toContain('timings_json');
      expect(written).not.toContain('private source excerpt');
    } finally {
      if (prior === undefined) delete process.env.GITHUB_OUTPUT;
      else process.env.GITHUB_OUTPUT = prior;
    }
  });
});
