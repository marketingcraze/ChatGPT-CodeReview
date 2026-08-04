import { ContextBundle, ContextRequest, PreviousReviewContext, ReviewFile, ReviewRun } from './contracts.js';
import { ReviewConfig } from './config.js';
export interface JsonModelClient {
    completeJson<T>(options: {
        model: string;
        system: string;
        prompt: string;
    }): Promise<T>;
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
    requestContext: (request: ContextRequest) => Promise<ContextBundle>;
    now?: () => Date;
}
export declare const runEvidenceReview: (input: ReviewEngineInput) => Promise<ReviewRun>;
