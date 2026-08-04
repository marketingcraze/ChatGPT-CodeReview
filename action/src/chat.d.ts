export declare class Chat {
    private openai;
    private isAzure;
    private isGithubModels;
    private reasoningModels;
    private reasoningPrefixes;
    constructor(apikey: string);
    private get model();
    private get normalizedModel();
    private get isReasoningModel();
    private get reasoningEffortOption();
    completeJson: <T>(options: {
        model: string;
        system: string;
        prompt: string;
    }) => Promise<T>;
    private generatePrompt;
    codeReview: (patch: string) => Promise<Array<{
        lgtm: boolean;
        review_comment: string;
        hunk_header?: string;
    }> | {
        lgtm: boolean;
        review_comment: string;
        hunk_header?: string;
    }>;
}
