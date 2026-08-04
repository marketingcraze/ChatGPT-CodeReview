import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const guide = fs.readFileSync('UPSTREAM_MAINTENANCE.md', 'utf8');
const base = guide.match(/^upstream_base_sha:\s*([a-f0-9]{40})$/m)?.[1];
if (!base) throw new Error('UPSTREAM_MAINTENANCE.md has no valid upstream_base_sha');
const remote = execFileSync(
  'git',
  ['ls-remote', 'https://github.com/anc95/ChatGPT-CodeReview.git', 'refs/heads/main'],
  { encoding: 'utf8' },
)
  .trim()
  .split(/\s+/)[0];
if (remote !== base) {
  throw new Error(`Upstream drift detected: recorded ${base}, live ${remote}`);
}
process.stdout.write(`Upstream remains at ${base}.\n`);
