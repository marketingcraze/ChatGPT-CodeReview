import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadCiEvidence, loadTrustedContext } from '../src/trusted-inputs';

const sha256 = (value: string) =>
  `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;

describe('GitHub-only trusted inputs', () => {
  test('loads only hash-verified Architecture Hub documents', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'trusted-context-'));
    const content = '# Organisation context\nEvidence only.\n';
    await fs.writeFile(path.join(root, 'ORG-CONTEXT.md'), content);
    await fs.writeFile(
      path.join(root, 'context-manifest.json'),
      JSON.stringify({
        schemaVersion: 1,
        repository: 'marketingcraze/REPOARCHITECTUREHUB',
        commitSha: 'a'.repeat(40),
        generatedAt: '2026-08-05T00:00:00Z',
        documents: [{ path: 'ORG-CONTEXT.md', sha256: sha256(content) }],
      }),
    );
    const loaded = await loadTrustedContext('context-manifest.json', root);
    expect(loaded?.content).toContain('Evidence only.');
    expect(loaded?.receipt.documents[0].sha256).toBe(sha256(content));
  });

  test('rejects a context document whose digest does not match', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'trusted-context-'));
    await fs.writeFile(path.join(root, 'ORG-CONTEXT.md'), 'changed');
    await fs.writeFile(
      path.join(root, 'context-manifest.json'),
      JSON.stringify({
        schemaVersion: 1,
        repository: 'marketingcraze/REPOARCHITECTUREHUB',
        commitSha: 'a'.repeat(40),
        generatedAt: '2026-08-05T00:00:00Z',
        documents: [{ path: 'ORG-CONTEXT.md', sha256: `sha256:${'0'.repeat(64)}` }],
      }),
    );
    await expect(loadTrustedContext('context-manifest.json', root)).rejects.toThrow('hash mismatch');
  });

  test('binds CI evidence to the exact repository and head SHA', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ci-evidence-'));
    const evidence = {
      schemaVersion: 1,
      repository: 'marketingcraze/PWA-LIVE',
      headSha: 'b'.repeat(40),
      collectedAt: '2026-08-05T00:00:00Z',
      checks: [{ name: 'preview', status: 'completed', conclusion: 'success' }],
      statuses: [],
      pending: [],
    };
    await fs.writeFile(path.join(root, 'ci.json'), JSON.stringify(evidence));
    await expect(
      loadCiEvidence('ci.json', { repository: evidence.repository, headSha: evidence.headSha }, root),
    ).resolves.toEqual(evidence);
    await expect(
      loadCiEvidence('ci.json', { repository: evidence.repository, headSha: 'c'.repeat(40) }, root),
    ).rejects.toThrow('exact head SHA does not match');
  });
});
