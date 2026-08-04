import { ReviewMode } from './contracts.js';

export const PERMITTED_GITNEXUS_VERSION = '1.6.9';

export interface ReviewConfig {
  mode: ReviewMode;
  policyPath?: string;
  previousReviewRunPath?: string;
  publishReviewComment: boolean;
  gitnexusVersion: string;
  initialModel: string;
  validationModel: string;
  escalationModel: string;
  maxPatchLength: number;
  maxContextRequests: number;
  failOnVerdict: boolean;
}

const readInput = (name: string): string | undefined => {
  const input = process.env[`INPUT_${name.replace(/-/g, '_').toUpperCase()}`];
  return input && input.trim() ? input.trim() : undefined;
};

const readPositiveInteger = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const readBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Expected true or false, received: ${value}`);
};

export const loadReviewConfig = (): ReviewConfig => {
  const requestedMode = readInput('review_mode') || process.env.REVIEW_MODE || 'initial';
  if (requestedMode !== 'initial' && requestedMode !== 'final') {
    throw new Error(`Unsupported review_mode: ${requestedMode}`);
  }

  const gitnexusVersion =
    readInput('gitnexus_version') || process.env.GITNEXUS_VERSION || PERMITTED_GITNEXUS_VERSION;
  if (gitnexusVersion !== PERMITTED_GITNEXUS_VERSION) {
    throw new Error(
      `GitNexus ${gitnexusVersion} is not permitted; expected ${PERMITTED_GITNEXUS_VERSION}`,
    );
  }

  return {
    mode: requestedMode,
    policyPath: readInput('policy_path') || process.env.POLICY_PATH,
    previousReviewRunPath:
      readInput('previous_review_run_path') || process.env.PREVIOUS_REVIEW_RUN_PATH,
    publishReviewComment: readBoolean(
      readInput('publish_review_comment') || process.env.PUBLISH_REVIEW_COMMENT,
      true,
    ),
    gitnexusVersion,
    initialModel:
      readInput('initial_model') || process.env.INITIAL_MODEL || 'gpt-5.6-luna',
    validationModel:
      readInput('validation_model') || process.env.VALIDATION_MODEL || 'gpt-5.6-terra',
    escalationModel:
      readInput('escalation_model') || process.env.ESCALATION_MODEL || 'gpt-5.6-sol',
    maxPatchLength: readPositiveInteger(
      readInput('max_patch_length') || process.env.MAX_PATCH_LENGTH,
      30000,
    ),
    maxContextRequests: readPositiveInteger(
      readInput('max_context_requests') || process.env.MAX_CONTEXT_REQUESTS,
      6,
    ),
    failOnVerdict: readBoolean(
      readInput('fail_on_verdict') || process.env.FAIL_ON_VERDICT,
      false,
    ),
  };
};
