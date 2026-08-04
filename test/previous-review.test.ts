import fs from 'node:fs/promises';
import path from 'node:path';

import { ReviewRun } from '../src/contracts';
import { loadPreviousReviewRun } from '../src/previous-review';

const sha = 'a'.repeat(40);
const run: ReviewRun = {
  schemaVersion: 1,
  runId: 'initial-run',
  mode: 'initial',
  repository: 'marketingcraze/PWA-LIVE',
  pullRequest: 7436,
  baseSha: 'b'.repeat(40),
  headSha: sha,
  startedAt: '2026-08-04T10:00:00.000Z',
  completedAt: '2026-08-04T10:01:00.000Z',
  initialModel: 'gpt-5.6-luna',
  validationModel: 'gpt-5.6-terra',
  escalationModel: 'gpt-5.6-sol',
  gitnexus: {
    schemaVersion: 1,
    requestedVersion: '1.6.9',
    compatibilityMode: 'v1.6.9-normalized',
    repository: process.cwd(),
    branch: null,
    indexCommit: sha,
    currentCommit: sha,
    incompleteReasons: [],
    status: 'up-to-date',
    forcedRebuildAttempted: false,
  },
  contextRequests: [],
  findings: [],
  verdict: {
    status: 'approved_to_merge',
    summary: 'Validated.',
    blockingFindingIds: [],
    evidenceGaps: [],
  },
};

describe('previous ReviewRun artifact', () => {
  const relativePath = '.test-state/initial-review.json';
  const absolutePath = path.resolve(relativePath);

  afterEach(async () => {
    await fs.rm(path.dirname(absolutePath), { recursive: true, force: true });
  });

  test('loads only a matching initial run from inside the caller workspace', async () => {
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, JSON.stringify(run), 'utf8');
    await expect(
      loadPreviousReviewRun(relativePath, {
        repository: run.repository,
        pullRequest: run.pullRequest,
        headSha: run.headSha,
      }),
    ).resolves.toEqual(run);
  });

  test('fails closed when the exact SHA does not match', async () => {
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, JSON.stringify(run), 'utf8');
    await expect(
      loadPreviousReviewRun(relativePath, {
        repository: run.repository,
        pullRequest: run.pullRequest,
        headSha: 'c'.repeat(40),
      }),
    ).resolves.toBeUndefined();
  });

  test('rejects paths outside the caller workspace', async () => {
    await expect(
      loadPreviousReviewRun('../initial-review.json', {
        repository: run.repository,
        pullRequest: run.pullRequest,
        headSha: run.headSha,
      }),
    ).resolves.toBeUndefined();
  });
});
