import type { CognitiveProvider } from "@jarvis/core";

export class OllamaProvider implements CognitiveProvider {
  readonly name = "ollama";
  constructor(private readonly baseUrl: string, private readonly model = process.env.OLLAMA_MODEL ?? "llama3.2") {}
  async healthy() { try { return (await fetch(`${this.baseUrl}/api/tags`)).ok; } catch { return false; } }
  async extract(input: string) {
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: this.model, stream: false, format: "json", prompt: `Extract durable project facts, decisions, constraints and workflows from the evidence below. Return a JSON array of concise complete statements. Do not invent facts.\n\n${input}` }) });
      if (!response.ok) return [input];
      const payload = await response.json() as { response?: string };
      const parsed = JSON.parse(payload.response ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [input];
    } catch { return [input]; }
  }
}
