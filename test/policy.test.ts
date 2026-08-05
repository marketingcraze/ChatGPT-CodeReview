import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadPolicy } from '../src/policy';

describe('private policy loading', () => {
  test('loads a caller-owned repository policy', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'policy-test-'));
    await fs.mkdir(path.join(root, '.github'));
    await fs.writeFile(path.join(root, '.github/policy.yml'), 'rule: evidence only');
    await expect(loadPolicy('.github/policy.yml', root)).resolves.toContain('evidence only');
  });

  test('prevents policy_path from escaping the checkout', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'policy-test-'));
    await expect(loadPolicy('../secret.txt', root)).rejects.toThrow('inside');
  });
});
