import { createHash } from 'node:crypto';
import {
  CandidateFinding,
  EvidenceRef,
  Finding,
  FindingAction,
  FindingSeverity,
  ReviewFile,
} from './contracts.js';

const severities: FindingSeverity[] = ['low', 'medium', 'high', 'critical'];
const actions: FindingAction[] = ['add', 'change_or_remove', 'verify'];

export const sha256Text = (value: string) =>
  createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex');

export const extractChangedLines = (patch: string): number[] => {
  const changed = new Set<number>();
  let newLine = 0;
  let insideHunk = false;

  for (const line of patch.split('\n')) {
    const header = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (header) {
      newLine = Number(header[1]);
      insideHunk = true;
      continue;
    }
    if (!insideHunk || line.startsWith('\\ No newline')) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) {
      changed.add(newLine);
      newLine += 1;
    } else if (!line.startsWith('-')) {
      newLine += 1;
    }
  }
  return Array.from(changed).sort((a, b) => a - b);
};

export const numberedChangedContext = (file: ReviewFile, radius = 20): string => {
  const lines = file.content.replace(/\r\n/g, '\n').split('\n');
  const included = new Set<number>();
  for (const changedLine of file.changedLines) {
    const start = Math.max(1, changedLine - radius);
    const end = Math.min(lines.length, changedLine + radius);
    for (let line = start; line <= end; line += 1) included.add(line);
  }
  const selected = Array.from(included).sort((a, b) => a - b).slice(0, 600);
  return selected.map((line) => `${line}: ${lines[line - 1]}`).join('\n');
};

const normalizeConfidence = (value: number | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
};

export interface EvidenceValidationResult {
  finding?: Finding;
  gap?: string;
}

export const validateCandidateFinding = (
  candidate: CandidateFinding,
  files: ReviewFile[],
  headSha: string,
  index: number,
): EvidenceValidationResult => {
  const file = files.find((item) => item.filename === candidate.file);
  if (!file) return { gap: `Finding ${index + 1} referenced an unavailable file.` };

  const lineStart = Number(candidate.lineStart);
  const lineEnd = Number(candidate.lineEnd);
  const lineCount = file.content.replace(/\r\n/g, '\n').split('\n').length;
  if (
    !Number.isInteger(lineStart) ||
    !Number.isInteger(lineEnd) ||
    lineStart < 1 ||
    lineEnd < lineStart ||
    lineEnd > lineCount
  ) {
    return { gap: `Finding ${index + 1} did not provide a valid exact line range.` };
  }

  if (
    file.status !== 'removed' &&
    !file.changedLines.some((line) => line >= lineStart && line <= lineEnd)
  ) {
    return { gap: `Finding ${index + 1} did not overlap a changed line.` };
  }

  if (!candidate.title?.trim() || !candidate.description?.trim()) {
    return { gap: `Finding ${index + 1} did not provide a complete assertion.` };
  }

  if (!candidate.severity || !severities.includes(candidate.severity)) {
    return { gap: `Finding ${index + 1} did not provide a supported severity.` };
  }
  if (!candidate.action || !actions.includes(candidate.action)) {
    return { gap: `Finding ${index + 1} did not provide a supported action.` };
  }

  const excerpt = file.content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .slice(lineStart - 1, lineEnd)
    .join('\n');
  const evidence: EvidenceRef = {
    repositorySha: file.sourceSha || headSha,
    file: file.filename,
    lineStart,
    lineEnd,
    excerpt,
    excerptHash: `sha256:${sha256Text(excerpt)}`,
  };

  return {
    finding: {
      id: candidate.id?.trim() || `finding-${index + 1}`,
      title: candidate.title.trim(),
      description: candidate.description.trim(),
      severity: candidate.severity,
      action: candidate.action,
      confidence: normalizeConfidence(candidate.confidence),
      disposition: 'unresolved',
      evidence: [evidence],
      validationNote: '',
    },
  };
};
