import type { Context } from "@deepseek-ai/cordis";
export declare const name = "jarvis-dsh-memory";
export declare const inject: string[];
export interface Config {
    apiUrl?: string;
    apiToken?: string;
    contextTokenBudget?: number;
    autoCandidate?: boolean;
}
export declare function apply(ctx: Context, config?: Config): void;
