import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const git = (cwd: string, args: string[]) =>
  spawnSync('git', args, { cwd, encoding: 'utf8' });

describe('upstream maintenance controls', () => {
  test('guide validator accepts the current inventory and metadata', () => {
    const result = spawnSync(process.execPath, ['scripts/check-upstream-guide.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, GUIDE_BASE_REF: 'origin/main' },
    });
    expect(result.status).toBe(0);
  });

  test('conflicting upstream runtime and managed verdict changes can be semantically integrated', () => {
    const fixture = path.join(process.cwd(), 'test/fixtures/upstream-conflict');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'upstream-conflict-'));
    expect(git(root, ['init', '-b', 'main']).status).toBe(0);
    expect(git(root, ['config', 'user.email', 'fixture@example.test']).status).toBe(0);
    expect(git(root, ['config', 'user.name', 'Fixture']).status).toBe(0);
    fs.copyFileSync(path.join(fixture, 'base.ts'), path.join(root, 'review.ts'));
    expect(git(root, ['add', 'review.ts']).status).toBe(0);
    expect(git(root, ['commit', '-m', 'base']).status).toBe(0);
    const baseSha = git(root, ['rev-parse', 'HEAD']).stdout.trim();

    expect(git(root, ['switch', '-c', 'upstream']).status).toBe(0);
    fs.copyFileSync(path.join(fixture, 'upstream.ts'), path.join(root, 'review.ts'));
    expect(git(root, ['commit', '-am', 'upstream runtime']).status).toBe(0);

    expect(git(root, ['switch', '-c', 'managed', baseSha]).status).toBe(0);
    fs.copyFileSync(path.join(fixture, 'managed.ts'), path.join(root, 'review.ts'));
    expect(git(root, ['commit', '-am', 'managed verdict']).status).toBe(0);
    const merge = git(root, ['merge', '--no-commit', '--no-ff', 'upstream']);
    expect(merge.status).not.toBe(0);

    fs.copyFileSync(path.join(fixture, 'expected.ts'), path.join(root, 'review.ts'));
    expect(git(root, ['add', 'review.ts']).status).toBe(0);
    expect(git(root, ['commit', '-m', 'semantic resolution']).status).toBe(0);
    const resolved = fs.readFileSync(path.join(root, 'review.ts'), 'utf8');
    expect(resolved).toContain("runtime = 'node24'");
    expect(resolved).toContain("verdict = 'insufficient_evidence'");
  });
});
