import type { CognitiveProvider } from "@jarvis/core";

export class OllamaProvider implements CognitiveProvider {
  readonly name = "ollama";
  constructor(private readonly baseUrl: string) {}
  async healthy() { try { return (await fetch(`${this.baseUrl}/api/tags`)).ok; } catch { return false; } }
  async extract(input: string) { return [input]; }
}
