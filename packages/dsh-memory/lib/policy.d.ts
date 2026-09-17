import type { CandidateInput } from "./client.js";
export declare function extractText(messages: readonly unknown[]): string;
export declare function candidateFromUserText(text: string, dshSessionId: string): CandidateInput | undefined;
