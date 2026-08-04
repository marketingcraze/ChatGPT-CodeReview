import { ReviewRun } from './contracts.js';
export declare const sanitizeReviewRun: (run: ReviewRun) => ReviewRun;
export declare const encodeReviewRunMarker: (run: ReviewRun) => string;
export declare const parseReviewRunMarker: (body: string | null | undefined) => ReviewRun | undefined;
export declare const formatReviewBody: (run: ReviewRun) => string;
export declare const writeActionOutputs: (run: ReviewRun) => Promise<void>;
