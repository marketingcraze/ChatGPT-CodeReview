import { ReviewRun } from './contracts.js';
export interface PreviousReviewExpectation {
    repository: string;
    pullRequest: number;
    headSha: string;
}
export declare const loadPreviousReviewRun: (configuredPath: string | undefined, expected: PreviousReviewExpectation) => Promise<ReviewRun | undefined>;
