export class JarvisClient {
    baseUrl;
    token;
    constructor(baseUrl, token) {
        this.baseUrl = baseUrl;
        this.token = token;
    }
    async openSession(workspace, task) { return (await this.request("/v1/sessions", { client: "dsh", workspace, task })).session; }
    buildContext(sessionId, task, tokenBudget) { return this.request("/v1/context/build", { sessionId, task, tokenBudget }); }
    async recordCandidate(sessionId, candidate) { await this.request("/v1/memory/candidates", { sessionId, ...candidate }); }
    async closeSession(sessionId, summary) { await this.request(`/v1/sessions/${encodeURIComponent(sessionId)}/close`, { result: "success", summary, decisions: [], failures: [], nextSteps: [] }); }
    async request(path, body) { const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify(body) }); if (!response.ok)
        throw new Error(`Jarvis request ${path} failed (${response.status})`); return response.json(); }
}
//# sourceMappingURL=client.js.map