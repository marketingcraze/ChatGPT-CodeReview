import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { ContextBundle, ContextRequest, GitNexusReceipt } from './contracts.js';
import { PERMITTED_GITNEXUS_VERSION } from './config.js';

const execFileAsync = promisify(execFile);

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type CommandRunner = (command: string, args: string[], cwd: string) => Promise<CommandResult>;

const defaultRunner: CommandRunner = async (command, args, cwd) => {
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, NO_COLOR: '1' },
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error?.stdout || '',
      stderr: error?.stderr || error?.message || '',
      exitCode: typeof error?.code === 'number' ? error.code : 1,
    };
  }
};

const runGit = async (args: string[], cwd: string, runner: CommandRunner) =>
  runner('git', args, cwd);

const runGitNexus = async (
  version: string,
  args: string[],
  cwd: string,
  runner: CommandRunner,
  binaryPath?: string,
) => binaryPath
  ? runner(binaryPath, args, cwd)
  : runner('npx', ['--yes', `gitnexus@${version}`, ...args], cwd);

interface IndexMeta {
  lastCommit?: string;
  indexedAt?: string;
  branch?: string;
  incrementalInProgress?: unknown;
}

const collectMetadata = async (root: string): Promise<IndexMeta[]> => {
  const metadata: IndexMeta[] = [];
  const visit = async (directory: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'lbug' && entry.name !== 'parse-cache' && entry.name !== 'parsedfile-cache') {
          await visit(entryPath);
        }
      } else if (entry.name === 'gitnexus.json' || entry.name === 'meta.json') {
        try {
          metadata.push(JSON.parse(await fs.readFile(entryPath, 'utf8')) as IndexMeta);
        } catch {
          metadata.push({});
        }
      }
    }
  };
  await visit(path.join(root, '.gitnexus'));
  return metadata;
};

const parseNativeReceipt = (stdout: string): Partial<GitNexusReceipt> | null => {
  try {
    const parsed = JSON.parse(stdout.trim());
    return {
      repository: parsed.repository,
      branch: parsed.branch || null,
      indexCommit: parsed.index?.commit || null,
      currentCommit: parsed.current?.commit || '',
      incompleteReasons: Array.isArray(parsed.index?.incompleteReasons)
        ? parsed.index.incompleteReasons.map(String)
        : [],
      status:
        parsed.status === 'up-to-date' || parsed.status === 'stale'
          ? parsed.status
          : 'unavailable',
    };
  } catch {
    return null;
  }
};

const buildReceipt = async (
  cwd: string,
  headSha: string,
  version: string,
  runner: CommandRunner,
  forcedRebuildAttempted: boolean,
  incrementalUpdateAttempted: boolean,
  restoreSource: GitNexusReceipt['restoreSource'],
  binaryPath?: string,
  indexManifestDigest?: string,
): Promise<GitNexusReceipt> => {
  const gitHead = await runGit(['rev-parse', 'HEAD'], cwd, runner);
  const currentCommit = gitHead.stdout.trim();
  const branchResult = await runGit(['branch', '--show-current'], cwd, runner);
  const branch = branchResult.stdout.trim() || null;

  const native = await runGitNexus(version, ['status', '--json'], cwd, runner, binaryPath);
  const nativeReceipt = native.exitCode === 0 ? parseNativeReceipt(native.stdout) : null;
  const compatibilityMode = nativeReceipt ? 'native-json' : 'v1.6.9-normalized';
  const statusResult = nativeReceipt
    ? native
    : await runGitNexus(version, ['status'], cwd, runner, binaryPath);
  const metas = await collectMetadata(cwd);
  const exactMeta = metas.find((meta) => meta.lastCommit === headSha);
  const incompleteReasons: string[] = [];
  if (!exactMeta) incompleteReasons.push('metadata-commit-mismatch');
  if (exactMeta?.incrementalInProgress) incompleteReasons.push('incremental-analysis-in-progress');
  try {
    await fs.access(path.join(cwd, '.gitnexus', 'lbug'));
  } catch {
    incompleteReasons.push('index-database-missing');
  }
  if (currentCommit !== headSha) incompleteReasons.push('workspace-head-mismatch');

  const textSaysCurrent = /Status:\s*(?:✅\s*)?up-to-date/i.test(statusResult.stdout);
  const nativeReasons = nativeReceipt?.incompleteReasons || [];
  for (const reason of nativeReasons) incompleteReasons.push(reason);
  const uniqueReasons = Array.from(new Set(incompleteReasons));
  const status =
    statusResult.exitCode === 0 &&
    (nativeReceipt ? nativeReceipt.status === 'up-to-date' : textSaysCurrent) &&
    exactMeta?.lastCommit === headSha &&
    uniqueReasons.length === 0
      ? 'up-to-date'
      : statusResult.exitCode === 0
        ? 'stale'
        : 'unavailable';

  return {
    schemaVersion: 1,
    requestedVersion: version,
    compatibilityMode,
    repository: nativeReceipt?.repository || cwd,
    branch: nativeReceipt?.branch === undefined ? branch : nativeReceipt.branch,
    indexCommit: exactMeta?.lastCommit || nativeReceipt?.indexCommit || null,
    currentCommit,
    incompleteReasons: uniqueReasons,
    status,
    restoreSource,
    incrementalUpdateAttempted,
    forcedRebuildAttempted,
    indexManifestDigest,
  };
};

const validateBinaryPath = async (binaryPath: string | undefined): Promise<string | undefined> => {
  if (!binaryPath) return undefined;
  const workspace = process.env.GITHUB_WORKSPACE
    ? await fs.realpath(process.env.GITHUB_WORKSPACE)
    : await fs.realpath(process.cwd());
  const real = await fs.realpath(path.resolve(binaryPath));
  const relative = path.relative(workspace, real);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('GitNexus binary must remain inside GITHUB_WORKSPACE');
  }
  await fs.access(real);
  return real;
};

export const ensureGitNexusFresh = async (
  headSha: string,
  options: {
    cwd?: string;
    version?: string;
    runner?: CommandRunner;
    binaryPath?: string;
    restoreSource?: GitNexusReceipt['restoreSource'];
    indexManifestDigest?: string;
  } = {},
): Promise<GitNexusReceipt> => {
  const cwd = options.cwd || process.cwd();
  const version = options.version || PERMITTED_GITNEXUS_VERSION;
  const runner = options.runner || defaultRunner;
  const binaryPath = await validateBinaryPath(options.binaryPath);
  const restoreSource = options.restoreSource || 'cold';
  if (version !== PERMITTED_GITNEXUS_VERSION) {
    throw new Error(`Unsupported GitNexus version ${version}`);
  }

  if (binaryPath) {
    const versionResult = await runGitNexus(version, ['--version'], cwd, runner, binaryPath);
    if (versionResult.exitCode !== 0 || !versionResult.stdout.includes(version)) {
      throw new Error(`GitNexus binary is not the permitted ${version} release`);
    }
  }

  let receipt = await buildReceipt(
    cwd,
    headSha,
    version,
    runner,
    false,
    false,
    restoreSource,
    binaryPath,
    options.indexManifestDigest,
  );
  if (receipt.status === 'up-to-date') return receipt;

  await runGitNexus(version, ['analyze', '--index-only'], cwd, runner, binaryPath);
  receipt = await buildReceipt(
    cwd,
    headSha,
    version,
    runner,
    false,
    true,
    restoreSource,
    binaryPath,
    options.indexManifestDigest,
  );
  if (receipt.status === 'up-to-date') return receipt;

  await runGitNexus(version, ['analyze', '--force', '--index-only'], cwd, runner, binaryPath);
  receipt = await buildReceipt(
    cwd,
    headSha,
    version,
    runner,
    true,
    true,
    restoreSource,
    binaryPath,
    options.indexManifestDigest,
  );
  return receipt;
};

export const requestGitNexusContext = async (
  request: ContextRequest,
  headSha: string,
  options: { cwd?: string; version?: string; runner?: CommandRunner; binaryPath?: string } = {},
): Promise<ContextBundle> => {
  const cwd = options.cwd || process.cwd();
  const version = options.version || PERMITTED_GITNEXUS_VERSION;
  const runner = options.runner || defaultRunner;
  const binaryPath = await validateBinaryPath(options.binaryPath);
  const result = await runGitNexus(
    version,
    [
      'query',
      request.query,
      '--goal',
      request.rationale,
      '--limit',
      '5',
      '--content',
    ],
    cwd,
    runner,
    binaryPath,
  );
  if (result.exitCode !== 0 || !result.stdout.trim()) {
    throw new Error('GitNexus targeted context request failed');
  }
  return {
    request,
    repositorySha: headSha,
    provider: 'gitnexus',
    content: result.stdout.slice(0, 60000),
  };
};
