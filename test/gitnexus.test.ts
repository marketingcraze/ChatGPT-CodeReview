import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CommandRunner, ensureGitNexusFresh } from '../src/gitnexus';

const head = 'b'.repeat(40);

const createIndex = async (commit: string) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gitnexus-test-'));
  await fs.mkdir(path.join(root, '.gitnexus/lbug'), { recursive: true });
  await fs.writeFile(
    path.join(root, '.gitnexus/gitnexus.json'),
    JSON.stringify({ lastCommit: commit, indexedAt: new Date().toISOString() }),
  );
  return root;
};

const baseRunner = (root: string, onAnalyze?: (args: string[]) => Promise<void>): CommandRunner =>
  async (command, args) => {
    if (command === 'git' && args.join(' ') === 'rev-parse HEAD') {
      return { stdout: `${head}\n`, stderr: '', exitCode: 0 };
    }
    if (command === 'git' && args.join(' ') === 'branch --show-current') {
      return { stdout: 'feature/test\n', stderr: '', exitCode: 0 };
    }
    if (command === 'npx' && args.includes('--json')) {
      return { stdout: '', stderr: "error: unknown option '--json'", exitCode: 1 };
    }
    if (command === 'npx' && args.includes('analyze')) {
      await onAnalyze?.(args);
      return { stdout: 'indexed', stderr: '', exitCode: 0 };
    }
    if (command === 'npx' && args.includes('status')) {
      return {
        stdout: `Repository: ${root}\nBranch: feature/test\nIndexed commit: bbbbbbb\nCurrent commit: bbbbbbb\nStatus: ✅ up-to-date\n`,
        stderr: '',
        exitCode: 0,
      };
    }
    return { stdout: '', stderr: 'unexpected', exitCode: 1 };
  };

describe('GitNexus exact-SHA freshness', () => {
  test('normalizes the pinned 1.6.9 human status and verifies full metadata SHA', async () => {
    const root = await createIndex(head);
    const receipt = await ensureGitNexusFresh(head, { cwd: root, runner: baseRunner(root) });
    expect(receipt.status).toBe('up-to-date');
    expect(receipt.compatibilityMode).toBe('v1.6.9-normalized');
    expect(receipt.indexCommit).toBe(head);
    expect(receipt.incrementalUpdateAttempted).toBe(false);
    expect(receipt.forcedRebuildAttempted).toBe(false);
  });

  test('uses an incremental update before accepting a stale seeded index', async () => {
    const root = await createIndex('c'.repeat(40));
    let rebuilds = 0;
    const runner = baseRunner(root, async () => {
      rebuilds += 1;
      await fs.writeFile(
        path.join(root, '.gitnexus/gitnexus.json'),
        JSON.stringify({ lastCommit: head, indexedAt: new Date().toISOString() }),
      );
    });
    const receipt = await ensureGitNexusFresh(head, { cwd: root, runner });
    expect(rebuilds).toBe(1);
    expect(receipt.status).toBe('up-to-date');
    expect(receipt.incrementalUpdateAttempted).toBe(true);
    expect(receipt.forcedRebuildAttempted).toBe(false);
  });

  test('performs one forced rebuild only after incremental repair fails', async () => {
    const root = await createIndex('c'.repeat(40));
    let attempts = 0;
    const runner = baseRunner(root, async (args) => {
      attempts += 1;
      if (args.includes('--force')) {
        await fs.writeFile(
          path.join(root, '.gitnexus/gitnexus.json'),
          JSON.stringify({ lastCommit: head, indexedAt: new Date().toISOString() }),
        );
      }
    });
    const receipt = await ensureGitNexusFresh(head, { cwd: root, runner, restoreSource: 'base_cache' });
    expect(attempts).toBe(2);
    expect(receipt.status).toBe('up-to-date');
    expect(receipt.restoreSource).toBe('base_cache');
    expect(receipt.incrementalUpdateAttempted).toBe(true);
    expect(receipt.forcedRebuildAttempted).toBe(true);
  });

  test('remains fail-closed when the forced rebuild does not repair metadata', async () => {
    const root = await createIndex('d'.repeat(40));
    const receipt = await ensureGitNexusFresh(head, { cwd: root, runner: baseRunner(root) });
    expect(receipt.status).not.toBe('up-to-date');
    expect(receipt.incompleteReasons).toContain('metadata-commit-mismatch');
    expect(receipt.forcedRebuildAttempted).toBe(true);
  });
});
