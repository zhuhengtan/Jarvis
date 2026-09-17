export interface JarvisSession {
    id: string;
    projectId: string;
    workspace: string;
}
export interface JarvisContext {
    text: string;
    memories: unknown[];
}
export interface CandidateInput {
    scope: "global" | "project";
    kind: "preference" | "fact" | "constraint" | "decision" | "identity" | "workflow";
    title: string;
    content: string;
    sourceRefs: string[];
}
export declare class JarvisClient {
    private readonly baseUrl;
    private readonly token?;
    constructor(baseUrl: string, token?: string | undefined);
    openSession(workspace: string, task: string): Promise<JarvisSession>;
    buildContext(sessionId: string, task: string, tokenBudget: number): Promise<JarvisContext>;
    recordCandidate(sessionId: string, candidate: CandidateInput): Promise<void>;
    closeSession(sessionId: string, summary: string): Promise<void>;
    private request;
}
