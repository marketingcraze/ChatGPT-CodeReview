import fs from 'node:fs/promises';
import path from 'node:path';

import { ReviewRun } from './contracts.js';

export interface PreviousReviewExpectation {
  repository: string;
  pullRequest: number;
  headSha: string;
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isReviewRun = (value: unknown): value is ReviewRun => {
  if (!value || typeof value !== 'object') return false;
  const run = value as Partial<ReviewRun>;
  return run.schemaVersion === 1 &&
    typeof run.runId === 'string' &&
    run.mode === 'initial' &&
    typeof run.repository === 'string' &&
    Number.isInteger(run.pullRequest) &&
    typeof run.baseSha === 'string' &&
    typeof run.headSha === 'string' &&
    typeof run.startedAt === 'string' &&
    typeof run.completedAt === 'string' &&
    Array.isArray(run.findings) &&
    !!run.verdict &&
    typeof run.verdict.summary === 'string' &&
    isStringArray(run.verdict.blockingFindingIds) &&
    isStringArray(run.verdict.evidenceGaps) &&
    ['approved_to_merge', 'changes_required', 'insufficient_evidence'].includes(
      String(run.verdict.status),
    );
};

export const loadPreviousReviewRun = async (
  configuredPath: string | undefined,
  expected: PreviousReviewExpectation,
): Promise<ReviewRun | undefined> => {
  if (!configuredPath) return undefined;

  const workspace = path.resolve(process.cwd());
  const resolved = path.resolve(workspace, configuredPath);
  const relative = path.relative(workspace, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return undefined;

  try {
    const run = JSON.parse(await fs.readFile(resolved, 'utf8')) as unknown;
    if (!isReviewRun(run)) return undefined;
    if (
      run.repository !== expected.repository ||
      run.pullRequest !== expected.pullRequest ||
      run.headSha !== expected.headSha
    ) {
      return undefined;
    }
    return run;
  } catch {
    return undefined;
  }
};
