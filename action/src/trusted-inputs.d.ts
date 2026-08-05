import { CiEvidence, TrustedContextReceipt } from './contracts.js';
export interface LoadedTrustedContext {
    receipt: TrustedContextReceipt;
    content: string;
}
export declare const loadTrustedContext: (manifestPath: string | undefined, cwd?: string) => Promise<LoadedTrustedContext | undefined>;
export declare const loadCiEvidence: (evidencePath: string | undefined, expected: {
    repository: string;
    headSha: string;
}, cwd?: string) => Promise<CiEvidence | undefined>;
