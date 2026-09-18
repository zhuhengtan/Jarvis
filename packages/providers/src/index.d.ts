import type { CognitiveProvider } from "@jarvis/core";
export declare class OllamaProvider implements CognitiveProvider {
    private readonly baseUrl;
    private readonly model;
    readonly name = "ollama";
    constructor(baseUrl: string, model?: string);
    healthy(): Promise<boolean>;
    extract(input: string): Promise<string[]>;
}
