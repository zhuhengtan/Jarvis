export class OllamaProvider {
    baseUrl;
    name = "ollama";
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async healthy() { try {
        return (await fetch(`${this.baseUrl}/api/tags`)).ok;
    }
    catch {
        return false;
    } }
    async extract(input) { return [input]; }
}
//# sourceMappingURL=index.js.map