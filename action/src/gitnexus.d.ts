import { ContextBundle, ContextRequest, GitNexusReceipt } from './contracts.js';
export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
export type CommandRunner = (command: string, args: string[], cwd: string) => Promise<CommandResult>;
export declare const ensureGitNexusFresh: (headSha: string, options?: {
    cwd?: string;
    version?: string;
    runner?: CommandRunner;
}) => Promise<GitNexusReceipt>;
export declare const requestGitNexusContext: (request: ContextRequest, headSha: string, options?: {
    cwd?: string;
    version?: string;
    runner?: CommandRunner;
}) => Promise<ContextBundle>;
