export type ReviewMode = 'initial' | 'final';

export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical';

export type FindingAction = 'add' | 'change_or_remove' | 'verify';

export type FindingDisposition =
  | 'retained'
  | 'amended'
  | 'removed'
  | 'unresolved';

export type VerdictStatus =
  | 'approved_to_merge'
  | 'changes_required'
  | 'insufficient_evidence';

export interface EvidenceRef {
  repositorySha: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  excerptHash: string;
  excerpt: string;
}

export interface ContextRequest {
  id: string;
  findingId: string;
  query: string;
  kind: 'symbol' | 'process' | 'file' | 'test' | 'config' | 'documentation';
  rationale: string;
}

export interface ContextBundle {
  request: ContextRequest;
  repositorySha: string;
  provider: 'gitnexus';
  content: string;
}

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  action: FindingAction;
  confidence: number;
  disposition: FindingDisposition;
  evidence: EvidenceRef[];
  validationNote: string;
}

export interface GitNexusReceipt {
  schemaVersion: 1;
  requestedVersion: string;
  compatibilityMode: 'native-json' | 'v1.6.9-normalized';
  repository: string;
  branch: string | null;
  indexCommit: string | null;
  currentCommit: string;
  incompleteReasons: string[];
  status: 'up-to-date' | 'stale' | 'unavailable';
  forcedRebuildAttempted: boolean;
}

export interface FinalVerdict {
  status: VerdictStatus;
  summary: string;
  blockingFindingIds: string[];
  evidenceGaps: string[];
}

export interface ReviewRun {
  schemaVersion: 1;
  runId: string;
  mode: ReviewMode;
  repository: string;
  pullRequest: number;
  baseSha: string;
  headSha: string;
  startedAt: string;
  completedAt: string;
  initialModel: string;
  validationModel: string;
  escalationModel: string;
  gitnexus: GitNexusReceipt;
  contextRequests: ContextRequest[];
  findings: Finding[];
  verdict: FinalVerdict;
  previousRunId?: string;
}

export interface CandidateFinding {
  id?: string;
  title?: string;
  description?: string;
  severity?: FindingSeverity;
  action?: FindingAction;
  confidence?: number;
  file?: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface InitialReviewResponse {
  findings?: CandidateFinding[];
  evidenceGaps?: string[];
}

export interface ValidationResponse {
  decision?: 'retain' | 'amend' | 'remove' | 'needs_context';
  title?: string;
  description?: string;
  severity?: FindingSeverity;
  action?: FindingAction;
  confidence?: number;
  note?: string;
  contextRequests?: Array<Omit<ContextRequest, 'id' | 'findingId'>>;
}

export interface EscalationResponse {
  decision?: 'retain' | 'amend' | 'remove' | 'unresolved';
  title?: string;
  description?: string;
  severity?: FindingSeverity;
  action?: FindingAction;
  confidence?: number;
  note?: string;
}

export interface ReviewFile {
  filename: string;
  status: string;
  patch: string;
  content: string;
  changedLines: number[];
  sourceSha: string;
}

export interface PreviousReviewContext {
  run?: ReviewRun;
  developerComments: string[];
}

export const isVerdictStatus = (value: string): value is VerdictStatus =>
  ['approved_to_merge', 'changes_required', 'insufficient_evidence'].includes(value);
