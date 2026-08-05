import fs from 'node:fs/promises';
import { ReviewRun } from './contracts.js';

const MARKER_PREFIX = '<!-- evidence-review-run:';
const MARKER_SUFFIX = ' -->';

export const sanitizeReviewRun = (run: ReviewRun): ReviewRun => ({
  ...run,
  findings: run.findings.map((finding) => ({
    ...finding,
    evidence: finding.evidence.map((evidence) => ({ ...evidence, excerpt: '[redacted]' })),
  })),
});

export const encodeReviewRunMarker = (run: ReviewRun) => {
  const encoded = Buffer.from(JSON.stringify(sanitizeReviewRun(run)), 'utf8').toString('base64');
  return `${MARKER_PREFIX}${encoded}${MARKER_SUFFIX}`;
};

export const parseReviewRunMarker = (body: string | null | undefined): ReviewRun | undefined => {
  if (!body) return undefined;
  const start = body.indexOf(MARKER_PREFIX);
  if (start < 0) return undefined;
  const encodedStart = start + MARKER_PREFIX.length;
  const end = body.indexOf(MARKER_SUFFIX, encodedStart);
  if (end < 0) return undefined;
  try {
    return JSON.parse(Buffer.from(body.slice(encodedStart, end), 'base64').toString('utf8'));
  } catch {
    return undefined;
  }
};

const verdictTitle: Record<ReviewRun['verdict']['status'], string> = {
  approved_to_merge: 'Approved to merge',
  changes_required: 'Changes required',
  insufficient_evidence: 'Insufficient evidence',
};

export const formatReviewBody = (run: ReviewRun) => {
  const findings = run.findings.filter((finding) => finding.disposition !== 'removed');
  const findingText = findings.length
    ? findings
        .map((finding) => {
          const evidence = finding.evidence
            .map((ref) => {
              const file = ref.file.split('/').map(encodeURIComponent).join('/');
              const url = `https://github.com/${run.repository}/blob/${ref.repositorySha}/${file}#L${ref.lineStart}-L${ref.lineEnd}`;
              return `[${ref.file}:${ref.lineStart}-${ref.lineEnd}](${url}) (${ref.excerptHash})`;
            })
            .join(', ');
          return `- **${finding.severity.toUpperCase()} — ${finding.title}**\n  - Action: \`${finding.action}\`\n  - ${finding.description}\n  - Evidence: ${evidence}\n  - Validation: ${finding.validationNote}`;
        })
        .join('\n')
    : '- No material finding remained after validation.';
  const gaps = run.verdict.evidenceGaps.length
    ? `\n\nEvidence gaps:\n${run.verdict.evidenceGaps.map((gap) => `- ${gap}`).join('\n')}`
    : '';

  return `## Evidence review: ${verdictTitle[run.verdict.status]}

- Mode: \`${run.mode}\`
- Exact head: \`${run.headSha}\`
- GitNexus: \`${run.gitnexus.status}\` at \`${run.gitnexus.indexCommit || 'unavailable'}\`
- Verdict: \`${run.verdict.status}\`

${run.verdict.summary}

Findings:
${findingText}${gaps}

${encodeReviewRunMarker(run)}`;
};

export const writeActionOutputs = async (run: ReviewRun) => {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  const outputs: Record<string, string> = {
    verdict: run.verdict.status,
    reviewed_sha: run.headSha,
    gitnexus_status: run.gitnexus.status,
    gitnexus_restore_source: run.gitnexus.restoreSource,
    findings_json: JSON.stringify(sanitizeReviewRun(run).findings),
    review_run_json: JSON.stringify(sanitizeReviewRun(run)),
    timings_json: JSON.stringify(run.timings),
    model_usage_json: JSON.stringify(run.modelUsage),
  };
  let text = '';
  for (const [name, value] of Object.entries(outputs)) {
    const delimiter = `EVIDENCE_REVIEW_${name.toUpperCase()}`;
    text += `${name}<<${delimiter}\n${value}\n${delimiter}\n`;
  }
  await fs.appendFile(outputPath, text, 'utf8');
};
