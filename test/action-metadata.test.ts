import fs from 'node:fs';
import path from 'node:path';

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

  test('pins every third-party workflow Action to a full commit SHA', () => {
    const workflowRoot = path.join(process.cwd(), '.github/workflows');
    for (const filename of fs.readdirSync(workflowRoot)) {
      const workflow = fs.readFileSync(path.join(workflowRoot, filename), 'utf8');
      for (const match of workflow.matchAll(/^\s*uses:\s*([^\s]+)$/gm)) {
        if (match[1].startsWith('./')) continue;
        expect(match[1]).toMatch(/@[a-f0-9]{40}$/);
      }
    }
  });
});
