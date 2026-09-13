export interface AgentRun {
    id: string;
    parentSessionId: string;
    task: string;
    status: "requested";
    createdAt: string;
}
/** Jarvis tracks delegation requests; a client remains responsible for selecting and executing its own agent runtime. */
export declare class AgentManager {
    private readonly runs;
    request(parentSessionId: string, task: string): {
        id: string;
        parentSessionId: string;
        task: string;
        status: "requested";
        createdAt: string;
    };
    list(parentSessionId: string): AgentRun[];
}
