export class OllamaProvider {
    baseUrl;
    model;
    name = "ollama";
    constructor(baseUrl, model = process.env.OLLAMA_MODEL ?? "llama3.2") {
        this.baseUrl = baseUrl;
        this.model = model;
    }
    async healthy() { try {
        return (await fetch(`${this.baseUrl}/api/tags`)).ok;
    }
    catch {
        return false;
    } }
    async extract(input) {
        try {
            const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: this.model, stream: false, format: "json", prompt: `Extract durable project facts, decisions, constraints and workflows from the evidence below. Return a JSON array of concise complete statements. Do not invent facts.\n\n${input}` }) });
            if (!response.ok)
                return [input];
            const payload = await response.json();
            const parsed = JSON.parse(payload.response ?? "[]");
            return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string" && item.trim().length > 0) : [input];
        }
        catch {
            return [input];
        }
    }
}
//# sourceMappingURL=index.js.map