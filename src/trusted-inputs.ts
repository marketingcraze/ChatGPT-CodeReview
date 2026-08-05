import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  CiEvidence,
  TrustedContextDocumentReceipt,
  TrustedContextReceipt,
} from './contracts.js';

const SHA = /^[a-f0-9]{40}$/i;
const HASH = /^sha256:[a-f0-9]{64}$/i;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const resolveExistingInside = async (root: string, candidate: string, label: string) => {
  const absoluteRoot = await fs.realpath(root);
  const resolved = path.resolve(absoluteRoot, candidate);
  const real = await fs.realpath(resolved);
  const relative = path.relative(absoluteRoot, real);
  assert(!relative.startsWith('..') && !path.isAbsolute(relative), `${label} escapes the checkout`);
  return real;
};

const readLimited = async (filename: string, maximum: number, label: string) => {
  const value = await fs.readFile(filename, 'utf8');
  assert(Buffer.byteLength(value, 'utf8') <= maximum, `${label} exceeds its size limit`);
  return value;
};

const sha256 = (value: string) =>
  `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;

export interface LoadedTrustedContext {
  receipt: TrustedContextReceipt;
  content: string;
}

export const loadTrustedContext = async (
  manifestPath: string | undefined,
  cwd = process.cwd(),
): Promise<LoadedTrustedContext | undefined> => {
  if (!manifestPath) return undefined;
  const manifestFile = await resolveExistingInside(cwd, manifestPath, 'trusted context manifest');
  const raw = await readLimited(manifestFile, 1024 * 1024, 'trusted context manifest');
  const parsed = JSON.parse(raw) as TrustedContextReceipt;
  assert(parsed?.schemaVersion === 1, 'trusted context schema is unsupported');
  assert(typeof parsed.repository === 'string' && parsed.repository.includes('/'), 'trusted context repository is invalid');
  assert(SHA.test(parsed.commitSha), 'trusted context commit SHA is invalid');
  assert(!Number.isNaN(Date.parse(parsed.generatedAt)), 'trusted context timestamp is invalid');
  assert(Array.isArray(parsed.documents) && parsed.documents.length <= 20, 'trusted context documents are invalid');

  const base = path.dirname(manifestFile);
  const receipts: TrustedContextDocumentReceipt[] = [];
  const sections: string[] = [];
  let totalBytes = 0;
  for (const document of parsed.documents) {
    assert(document && typeof document.path === 'string', 'trusted context document path is invalid');
    assert(HASH.test(document.sha256), `trusted context hash is invalid for ${document.path}`);
    if (document.sourceSha) assert(SHA.test(document.sourceSha), `trusted context source SHA is invalid for ${document.path}`);
    if (document.generatedAt) assert(!Number.isNaN(Date.parse(document.generatedAt)), `trusted context timestamp is invalid for ${document.path}`);
    const file = await resolveExistingInside(base, document.path, 'trusted context document');
    const content = await readLimited(file, 80 * 1024, `trusted context document ${document.path}`);
    assert(sha256(content) === document.sha256.toLowerCase(), `trusted context hash mismatch for ${document.path}`);
    totalBytes += Buffer.byteLength(content, 'utf8');
    assert(totalBytes <= 160 * 1024, 'trusted context exceeds the aggregate size limit');
    receipts.push({ ...document });
    sections.push(`DOCUMENT: ${document.path}\n${content}`);
  }

  return {
    receipt: { ...parsed, documents: receipts },
    content: sections.join('\n\n'),
  };
};

export const loadCiEvidence = async (
  evidencePath: string | undefined,
  expected: { repository: string; headSha: string },
  cwd = process.cwd(),
): Promise<CiEvidence | undefined> => {
  if (!evidencePath) return undefined;
  const filename = await resolveExistingInside(cwd, evidencePath, 'CI evidence');
  const raw = await readLimited(filename, 2 * 1024 * 1024, 'CI evidence');
  const parsed = JSON.parse(raw) as CiEvidence;
  assert(parsed?.schemaVersion === 1, 'CI evidence schema is unsupported');
  assert(parsed.repository === expected.repository, 'CI evidence repository does not match');
  assert(parsed.headSha === expected.headSha, 'CI evidence exact head SHA does not match');
  assert(!Number.isNaN(Date.parse(parsed.collectedAt)), 'CI evidence timestamp is invalid');
  assert(Array.isArray(parsed.checks) && parsed.checks.length <= 500, 'CI checks are invalid');
  assert(Array.isArray(parsed.statuses) && parsed.statuses.length <= 500, 'CI statuses are invalid');
  assert(Array.isArray(parsed.pending) && parsed.pending.every((name) => typeof name === 'string'), 'CI pending list is invalid');
  assert(Array.isArray(parsed.failed) && parsed.failed.every((name) => typeof name === 'string'), 'CI failed list is invalid');
  assert(Array.isArray(parsed.missing) && parsed.missing.every((name) => typeof name === 'string'), 'CI missing list is invalid');
  for (const check of [...parsed.checks, ...parsed.statuses]) {
    assert(typeof check.name === 'string' && check.name.length <= 300, 'CI check name is invalid');
    assert(typeof check.status === 'string' && check.status.length <= 100, 'CI check status is invalid');
    assert(check.conclusion === null || typeof check.conclusion === 'string', 'CI check conclusion is invalid');
  }
  return parsed;
};
