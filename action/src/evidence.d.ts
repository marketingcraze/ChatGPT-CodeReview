import { CandidateFinding, Finding, ReviewFile } from './contracts.js';
export declare const sha256Text: (value: string) => string;
export declare const extractChangedLines: (patch: string) => number[];
export declare const numberedChangedContext: (file: ReviewFile, radius?: number) => string;
export interface EvidenceValidationResult {
    finding?: Finding;
    gap?: string;
}
export declare const validateCandidateFinding: (candidate: CandidateFinding, files: ReviewFile[], headSha: string, index: number) => EvidenceValidationResult;
