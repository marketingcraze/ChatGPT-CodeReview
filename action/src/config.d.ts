import { ReviewMode } from './contracts.js';
export declare const PERMITTED_GITNEXUS_VERSION = "1.6.9";
export interface ReviewConfig {
    mode: ReviewMode;
    policyPath?: string;
    gitnexusVersion: string;
    initialModel: string;
    validationModel: string;
    escalationModel: string;
    maxPatchLength: number;
    maxContextRequests: number;
    failOnVerdict: boolean;
}
export declare const loadReviewConfig: () => ReviewConfig;
