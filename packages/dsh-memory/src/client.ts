export interface JarvisSession { id: string; projectId: string; workspace: string; }
export interface JarvisContext { text: string; memories: unknown[]; }
export interface CandidateInput { scope: "global" | "project"; kind: "preference" | "fact" | "constraint" | "decision" | "identity" | "workflow"; title: string; content: string; sourceRefs: string[]; }
export class JarvisClient {
  constructor(private readonly baseUrl: string, private readonly token?: string) {}
  async openSession(workspace: string, task: string): Promise<JarvisSession> { return (await this.request<{ session: JarvisSession }>("/v1/sessions", { client: "dsh", workspace, task })).session; }
  buildContext(sessionId: string, task: string, tokenBudget: number): Promise<JarvisContext> { return this.request("/v1/context/build", { sessionId, task, tokenBudget }); }
  async recordCandidate(sessionId: string, candidate: CandidateInput): Promise<void> { await this.request("/v1/memory/candidates", { sessionId, ...candidate }); }
  async closeSession(sessionId: string, summary: string): Promise<void> { await this.request(`/v1/sessions/${encodeURIComponent(sessionId)}/close`, { result: "success", summary, decisions: [], failures: [], nextSteps: [] }); }
  private async request<T>(path: string, body: object): Promise<T> { const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify(body) }); if (!response.ok) throw new Error(`Jarvis request ${path} failed (${response.status})`); return response.json() as Promise<T>; }
}
