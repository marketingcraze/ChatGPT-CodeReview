import { Context, Probot } from 'probot';
import { minimatch } from 'minimatch';
import log from 'loglevel';

import { Chat } from './chat.js';
import { loadReviewConfig } from './config.js';
import { GitNexusReceipt, PreviousReviewContext, ReviewFile, ReviewRun, StageTiming } from './contracts.js';
import { extractChangedLines } from './evidence.js';
import { ensureGitNexusFresh, requestGitNexusContext } from './gitnexus.js';
import { loadPolicy } from './policy.js';
import { loadPreviousReviewRun } from './previous-review.js';
import { runEvidenceReview, JsonModelClient } from './review-engine.js';
import { loadCiEvidence, loadTrustedContext } from './trusted-inputs.js';
import {
  formatReviewBody,
  parseReviewRunMarker,
  writeActionOutputs,
} from './report.js';

const OPENAI_API_KEY = 'OPENAI_API_KEY';

const unavailableModel: JsonModelClient = {
  completeJson: async () => {
    throw new Error('No model credential is available');
  },
};

const isValidSha = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);

const matchPatterns = (patterns: string[], filePath: string) =>
  patterns.some((pattern) => {
    try {
      return minimatch(
        filePath,
        pattern.startsWith('/') ? `**${pattern}` : pattern.startsWith('**') ? pattern : `**/${pattern}`,
      );
    } catch {
      try {
        return new RegExp(pattern).test(filePath);
      } catch {
        return false;
      }
    }
  });

const loadModel = async (context: Context): Promise<JsonModelClient> => {
  if (process.env.USE_GITHUB_MODELS === 'true' && process.env.GITHUB_TOKEN) {
    return new Chat(process.env.GITHUB_TOKEN);
  }
  if (process.env.OPENAI_API_KEY) return new Chat(process.env.OPENAI_API_KEY);

  const repo = context.repo();
  try {
    const { data } = (await context.octokit.request(
      'GET /repos/{owner}/{repo}/actions/variables/{name}',
      { ...repo, name: OPENAI_API_KEY },
    )) as any;
    return data?.value ? new Chat(data.value) : unavailableModel;
  } catch {
    return unavailableModel;
  }
};

const decodeRepositoryContent = (data: any): string | undefined => {
  if (!data || Array.isArray(data) || data.type !== 'file' || data.encoding !== 'base64') {
    return undefined;
  }
  return Buffer.from(data.content, 'base64').toString('utf8');
};

const loadReviewFiles = async (
  context: Context,
  headSha: string,
  baseSha: string,
  maxPatchLength: number,
): Promise<{ files: ReviewFile[]; unreviewedFiles: string[] }> => {
  const repo = context.repo();
  const pullNumber = context.pullRequest().pull_number;
  const changedFiles = (await context.octokit.paginate(context.octokit.pulls.listFiles, {
    ...repo,
    pull_number: pullNumber,
    per_page: 100,
  })) as any[];
  const ignoreList = (process.env.IGNORE || process.env.ignore || '')
    .split('\n')
    .filter(Boolean);
  const ignorePatterns = (process.env.IGNORE_PATTERNS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const includePatterns = (process.env.INCLUDE_PATTERNS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const files: ReviewFile[] = [];
  const unreviewedFiles: string[] = [];
  for (const changed of changedFiles) {
    const filename = String(changed.filename || '');
    if (!filename) continue;
    const included = !includePatterns.length || matchPatterns(includePatterns, filename);
    const ignored = ignoreList.includes(filename) ||
      (ignorePatterns.length > 0 && matchPatterns(ignorePatterns, filename));
    if (!included || ignored) {
      unreviewedFiles.push(`${filename} (excluded by configuration)`);
      continue;
    }

    const patch = typeof changed.patch === 'string' ? changed.patch : '';
    if (!patch || patch.length > maxPatchLength) {
      unreviewedFiles.push(`${filename} (missing or oversized patch)`);
      continue;
    }

    const isRemoved = changed.status === 'removed';
    const sourceSha = isRemoved ? baseSha : headSha;
    const sourcePath = isRemoved
      ? String(changed.previous_filename || changed.filename)
      : filename;
    try {
      const response = await context.octokit.repos.getContent({
        ...repo,
        path: sourcePath,
        ref: sourceSha,
      });
      const content = decodeRepositoryContent(response.data);
      if (content === undefined || content.length > 1024 * 1024) {
        unreviewedFiles.push(`${filename} (binary or oversized source)`);
        continue;
      }
      files.push({
        filename,
        status: String(changed.status || 'modified'),
        patch,
        content,
        changedLines: extractChangedLines(patch),
        sourceSha,
      });
    } catch {
      unreviewedFiles.push(`${filename} (exact-SHA source unavailable)`);
    }
  }
  return { files, unreviewedFiles };
};

const loadPreviousContext = async (
  context: Context,
  previousReviewRunPath: string | undefined,
  headSha: string,
): Promise<PreviousReviewContext> => {
  const repo = context.repo();
  const pullNumber = context.pullRequest().pull_number;
  const repository = `${repo.owner}/${repo.repo}`;
  const artifactRun = await loadPreviousReviewRun(previousReviewRunPath, {
    repository,
    pullRequest: pullNumber,
    headSha,
  });
  const reviews = (await context.octokit.paginate(context.octokit.pulls.listReviews, {
    ...repo,
    pull_number: pullNumber,
    per_page: 100,
  })) as any[];
  const initialReview = reviews
    .slice()
    .reverse()
    .map((review) => ({ review, run: parseReviewRunMarker(review.body) }))
    .find(({ run }) => run?.mode === 'initial');

  const previousRun = artifactRun || initialReview?.run;
  if (!previousRun) return { developerComments: [] };
  const comments = (await context.octokit.paginate(context.octokit.issues.listComments, {
    ...repo,
    issue_number: pullNumber,
    per_page: 100,
  })) as any[];
  const submittedAt = Date.parse(
    artifactRun?.completedAt || initialReview?.review.submitted_at || previousRun.completedAt,
  );
  const developerComments = comments
    .filter((comment) => Date.parse(comment.created_at || '') > submittedAt)
    .map((comment) => String(comment.body || '').slice(0, 12000));
  return { run: previousRun, developerComments };
};

export const publishReviewRun = async (
  enabled: boolean,
  publish: () => Promise<unknown>,
): Promise<boolean> => {
  if (!enabled) return false;
  await publish();
  return true;
};

const findDuplicateRun = async (
  context: Context,
  mode: ReviewRun['mode'],
  headSha: string,
): Promise<ReviewRun | undefined> => {
  const repo = context.repo();
  const reviews = (await context.octokit.paginate(context.octokit.pulls.listReviews, {
    ...repo,
    pull_number: context.pullRequest().pull_number,
    per_page: 100,
  })) as any[];
  return reviews
    .map((review) => parseReviewRunMarker(review.body))
    .find((run) => run?.mode === mode && run.headSha === headSha);
};

const unavailableReceipt = (headSha: string, version: string, reason: string): GitNexusReceipt => ({
  schemaVersion: 1,
  requestedVersion: version,
  compatibilityMode: 'v1.6.9-normalized',
  repository: process.cwd(),
  branch: null,
  indexCommit: null,
  currentCommit: headSha,
  incompleteReasons: [reason],
  status: 'unavailable',
  restoreSource: 'cold',
  incrementalUpdateAttempted: false,
  forcedRebuildAttempted: true,
});

const readRestoreSource = (): GitNexusReceipt['restoreSource'] => {
  const value = process.env.EVIDENCE_REVIEW_INDEX_RESTORE_SOURCE;
  return value === 'exact_artifact' || value === 'base_cache' ? value : 'cold';
};

const readManifestDigest = () => {
  const value = process.env.EVIDENCE_REVIEW_INDEX_MANIFEST_DIGEST;
  return value && /^sha256:[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : undefined;
};

const timeStage = async <T>(
  timings: StageTiming[],
  stage: string,
  operation: () => Promise<T>,
): Promise<T> => {
  const started = new Date();
  try {
    return await operation();
  } finally {
    const completed = new Date();
    timings.push({
      stage,
      startedAt: started.toISOString(),
      completedAt: completed.toISOString(),
      durationMs: Math.max(0, completed.getTime() - started.getTime()),
    });
  }
};

export const eventMatchesMode = (payload: any, mode: ReviewRun['mode']) => {
  if (mode === 'final') return payload.action === 'closed' && !payload.pull_request?.merged;
  return ['opened', 'reopened', 'synchronize'].includes(payload.action) &&
    payload.pull_request?.state !== 'closed';
};

export const robot = (app: Probot) => {
  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.synchronize',
      'pull_request.closed',
    ],
    async (context) => {
      const payload = context.payload as any;
      const config = loadReviewConfig();
      if (!eventMatchesMode(payload, config.mode)) {
        log.info(`Evidence review skipped: event does not match ${config.mode} mode`);
        return 'mode mismatch';
      }
      const pullRequest = payload.pull_request;
      const headSha = pullRequest?.head?.sha;
      const baseSha = pullRequest?.base?.sha;
      if (!isValidSha(headSha) || !isValidSha(baseSha)) {
        throw new Error('Pull request payload does not contain exact 40-character SHAs');
      }
      if (pullRequest.locked) return 'locked pull request';

      const targetLabel = process.env.TARGET_LABEL;
      if (
        targetLabel &&
        (!pullRequest.labels?.length ||
          pullRequest.labels.every((label: any) => label.name !== targetLabel))
      ) {
        return 'target label missing';
      }

      const duplicate = await findDuplicateRun(context, config.mode, headSha);
      if (duplicate) {
        await writeActionOutputs(duplicate);
        log.info(`Evidence review already exists for ${config.mode} ${headSha}`);
        return 'duplicate';
      }

      const model = await loadModel(context);
      const timings: StageTiming[] = [];
      const previous =
        config.mode === 'final'
          ? await timeStage(timings, 'load.previous-review', () =>
              loadPreviousContext(context, config.previousReviewRunPath, headSha),
            )
          : { developerComments: [] };
      const loaded = await timeStage(timings, 'load.changed-files', () =>
        loadReviewFiles(
          context,
          headSha,
          baseSha,
          config.maxPatchLength,
        ),
      );
      let policy = '';
      try {
        policy = await timeStage(timings, 'load.policy', () => loadPolicy(config.policyPath));
      } catch {
        loaded.unreviewedFiles.push('Configured private policy was unavailable or invalid.');
      }

      let trustedContext;
      try {
        trustedContext = await timeStage(timings, 'load.trusted-context', () =>
          loadTrustedContext(config.trustedContextManifestPath),
        );
      } catch {
        log.info('Trusted architecture context was unavailable; exact-SHA repository evidence remains authoritative.');
      }

      const repository = `${context.repo().owner}/${context.repo().repo}`;
      let ciEvidence;
      try {
        ciEvidence = await timeStage(timings, 'load.ci-evidence', () =>
          loadCiEvidence(config.ciEvidencePath, { repository, headSha }),
        );
      } catch {
        loaded.unreviewedFiles.push('Configured exact-SHA CI evidence was unavailable or invalid.');
      }

      let gitnexus: GitNexusReceipt;
      try {
        gitnexus = await timeStage(timings, 'gitnexus.freshness', () =>
          ensureGitNexusFresh(headSha, {
            version: config.gitnexusVersion,
            binaryPath: config.gitnexusBinaryPath,
            restoreSource: readRestoreSource(),
            indexManifestDigest: readManifestDigest(),
          }),
        );
      } catch {
        gitnexus = unavailableReceipt(headSha, config.gitnexusVersion, 'freshness-check-failed');
      }

      const run = await runEvidenceReview({
        repository,
        pullRequest: context.pullRequest().pull_number,
        baseSha,
        headSha,
        files: loaded.files,
        unreviewedFiles: loaded.unreviewedFiles,
        policy,
        config,
        gitnexus,
        model,
        previous,
        trustedContext,
        ciEvidence,
        timings,
        requestContext: (request) =>
          requestGitNexusContext(request, headSha, {
            version: config.gitnexusVersion,
            binaryPath: config.gitnexusBinaryPath,
          }),
      });

      await publishReviewRun(config.publishReviewComment, () =>
        context.octokit.pulls.createReview({
          ...context.repo(),
          pull_number: context.pullRequest().pull_number,
          body: formatReviewBody(run),
          event: 'COMMENT',
          commit_id: headSha,
        }),
      );
      await writeActionOutputs(run);
      log.info(
        `Evidence review completed for ${repository}#${run.pullRequest} at ${headSha}: ${run.verdict.status}`,
      );

      if (config.failOnVerdict && run.verdict.status !== 'approved_to_merge') {
        throw new Error(`Evidence review verdict: ${run.verdict.status}`);
      }
      return run.verdict.status;
    },
  );
};
