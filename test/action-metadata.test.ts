import fs from 'node:fs';

describe('public Action contract', () => {
  const action = fs.readFileSync('action.yml', 'utf8');

  test.each([
    'review_mode',
    'policy_path',
    'previous_review_run_path',
    'publish_review_comment',
    'trusted_context_manifest_path',
    'ci_evidence_path',
    'gitnexus_binary_path',
    'gitnexus_version',
    'initial_model',
    'validation_model',
    'context_validation_model',
    'escalation_model',
    'fail_on_verdict',
  ])('declares input %s', (input) => {
    expect(action).toMatch(new RegExp(`^  ${input}:`, 'm'));
  });

  test.each(['verdict', 'reviewed_sha', 'gitnexus_status', 'gitnexus_restore_source', 'findings_json', 'review_run_json', 'timings_json', 'model_usage_json'])(
    'declares output %s',
    (output) => expect(action).toMatch(new RegExp(`^  ${output}:`, 'm')),
  );

  test('runs the committed Node 24 package', () => {
    expect(action).toContain("using: 'node24'");
    expect(action).toContain("main: 'action/index.cjs'");
  });
});
