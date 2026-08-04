import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guidePath = path.join(root, 'UPSTREAM_MAINTENANCE.md');
const guide = fs.readFileSync(guidePath, 'utf8');

const fail = (message) => {
  process.stderr.write(`UPSTREAM_MAINTENANCE.md validation failed: ${message}\n`);
  process.exitCode = 1;
};

const frontmatterMatch = guide.match(/^---\n([\s\S]*?)\n---\n/);
if (!frontmatterMatch) {
  fail('missing YAML frontmatter');
  process.exit();
}
const metadata = Object.fromEntries(
  frontmatterMatch[1]
    .split('\n')
    .map((line) => line.match(/^([a-z_]+):\s*(.+)$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
const required = [
  'schema_version',
  'upstream_repository',
  'managed_repository',
  'upstream_base_sha',
  'managed_release_sha',
  'managed_release',
  'last_verified_at',
];
for (const key of required) if (!metadata[key]) fail(`missing ${key}`);
if (metadata.schema_version !== '1') fail('schema_version must be 1');
for (const key of ['upstream_base_sha', 'managed_release_sha']) {
  if (!/^[a-f0-9]{40}$/.test(metadata[key] || '')) fail(`${key} must be a full SHA`);
  try {
    execFileSync('git', ['cat-file', '-e', `${metadata[key]}^{commit}`], { cwd: root });
  } catch {
    fail(`${key} does not exist in the repository`);
  }
}
if (Number.isNaN(Date.parse(metadata.last_verified_at || ''))) fail('last_verified_at is not ISO time');

const inventoryMatch = guide.match(
  /<!-- managed-customizations:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- managed-customizations:end -->/,
);
if (!inventoryMatch) {
  fail('missing machine-readable customization inventory');
  process.exit();
}
let inventory = [];
try {
  inventory = JSON.parse(inventoryMatch[1]);
} catch {
  fail('customization inventory is invalid JSON');
}
for (const item of inventory) {
  if (!item.path || !fs.existsSync(path.join(root, item.path))) fail(`missing path ${item.path}`);
  if (!Array.isArray(item.symbols) || !item.symbols.length) fail(`${item.path} has no symbols`);
  if (!Array.isArray(item.invariants) || !item.invariants.length) fail(`${item.path} has no invariants`);
  for (const testPath of item.tests || []) {
    if (!fs.existsSync(path.join(root, testPath))) fail(`missing invariant test ${testPath}`);
  }
}

const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
const mandatory =
  'Before importing an upstream commit, release, or tag, read and follow `UPSTREAM_MAINTENANCE.md` completely.';
if (!agents.includes(mandatory)) fail('AGENTS.md is missing the mandatory guide instruction');

let baseRef = process.env.GUIDE_BASE_REF || 'origin/main';
try {
  try {
    execFileSync('git', ['rev-parse', '--verify', baseRef], { cwd: root, stdio: 'pipe' });
  } catch {
    baseRef = metadata.upstream_base_sha;
  }
  const changed = execFileSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
    cwd: root,
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean);
  const managedChanged = inventory.some((item) => changed.includes(item.path));
  const confirmation = process.env.MANAGED_INVARIANTS_UNCHANGED === 'true';
  if (managedChanged && !changed.includes('UPSTREAM_MAINTENANCE.md') && !confirmation) {
    fail('managed paths changed without a guide update or explicit invariant confirmation');
  }
} catch {
  fail(`could not compare managed paths against ${baseRef}`);
}

if (!process.exitCode) process.stdout.write('UPSTREAM_MAINTENANCE.md is valid.\n');
