import fs from 'node:fs';

describe('public Action contract', () => {
  const action = fs.readFileSync('action.yml', 'utf8');

  test.each([
    'review_mode',
    'policy_path',
    'gitnexus_version',
    'initial_model',
    'validation_model',
    'escalation_model',
    'fail_on_verdict',
  ])('declares input %s', (input) => {
    expect(action).toMatch(new RegExp(`^  ${input}:`, 'm'));
  });

  test.each(['verdict', 'reviewed_sha', 'gitnexus_status', 'findings_json', 'review_run_json'])(
    'declares output %s',
    (output) => expect(action).toMatch(new RegExp(`^  ${output}:`, 'm')),
  );

  test('runs the committed Node 24 package', () => {
    expect(action).toContain("using: 'node24'");
    expect(action).toContain("main: 'action/index.cjs'");
  });
});
