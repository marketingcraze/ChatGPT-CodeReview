import { ContextBundle, ContextRequest, CiEvidence, PreviousReviewContext, ReviewFile, ReviewRun, StageTiming, TrustedContextReceipt } from './contracts.js';
import { ReviewConfig } from './config.js';
export interface JsonModelClient {
    completeJson<T>(options: {
        model: string;
        system: string;
        prompt: string;
    }): Promise<T>;
    getUsage?: () => ReviewRun['modelUsage'];
}
export interface ReviewEngineInput {
    repository: string;
    pullRequest: number;
    baseSha: string;
    headSha: string;
    files: ReviewFile[];
    unreviewedFiles: string[];
    policy: string;
    config: ReviewConfig;
    gitnexus: ReviewRun['gitnexus'];
    model: JsonModelClient;
    previous: PreviousReviewContext;
    trustedContext?: {
        receipt: TrustedContextReceipt;
        content: string;
    };
    ciEvidence?: CiEvidence;
    timings?: StageTiming[];
    requestContext: (request: ContextRequest) => Promise<ContextBundle>;
    now?: () => Date;
}
export declare const runEvidenceReview: (input: ReviewEngineInput) => Promise<ReviewRun>;
