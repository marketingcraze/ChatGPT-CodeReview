import { extractChangedLines, sha256Text, validateCandidateFinding } from '../src/evidence';
import { ReviewFile } from '../src/contracts';

const head = 'a'.repeat(40);
const file: ReviewFile = {
  filename: 'src/example.ts',
  status: 'modified',
  patch: '@@ -1,2 +1,2 @@\n-old\n+new\n keep',
  content: 'new\nkeep',
  changedLines: [1],
  sourceSha: head,
};

describe('exact evidence', () => {
  test('extracts exact added line numbers from a unified patch', () => {
    expect(extractChangedLines(file.patch)).toEqual([1]);
  });

  test('binds a material finding to SHA, lines, and excerpt hash', () => {
    const result = validateCandidateFinding(
      {
        title: 'Readiness starts true',
        description: 'Initialize readiness as false until validation succeeds.',
        severity: 'high',
        action: 'change_or_remove',
        confidence: 0.9,
        file: file.filename,
        lineStart: 1,
        lineEnd: 1,
      },
      [file],
      head,
      0,
    );
    expect(result.gap).toBeUndefined();
    expect(result.finding?.evidence[0]).toEqual({
      repositorySha: head,
      file: file.filename,
      lineStart: 1,
      lineEnd: 1,
      excerpt: 'new',
      excerptHash: `sha256:${sha256Text('new')}`,
    });
  });

  test('rejects assertions outside the changed evidence', () => {
    const result = validateCandidateFinding(
      {
        title: 'Unchanged claim',
        description: 'This does not overlap the diff.',
        severity: 'medium',
        action: 'verify',
        file: file.filename,
        lineStart: 2,
        lineEnd: 2,
      },
      [file],
      head,
      0,
    );
    expect(result.gap).toContain('did not overlap');
  });
});
