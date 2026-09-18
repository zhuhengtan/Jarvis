import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DefaultContextEngine } from "@jarvis/context";
import { AgentManager } from "@jarvis/agents";
import { EvaluationEngine } from "@jarvis/evaluation";
import { FileMemoryEngine, JsonlDynamicStore, MarkdownMemoryStore, PostgresDynamicStore, ProjectResolver, type DynamicStore } from "@jarvis/memory";
import { FilesystemSkillEngine } from "@jarvis/skills";
import { ReflectionEngine } from "@jarvis/reflection";
import { ToolGateway } from "@jarvis/tools";
import { IdentityService } from "./identity.js";
import { closeSessionInput, eventInput, experienceInput, goalInput, openSessionInput, buildContextInput, retrieveContextInput, runtimeSettingsInput, newId, now, type MemoryRecord, type SkillBundle, type ProjectIdentity, type RuntimeSettings } from "@jarvis/shared";

export interface RuntimeConfig { assistantName?: string; memoryRoot: string; skillsRoot: string; databaseUrl?: string; }
const defaultSettings: RuntimeSettings = { provider: "ollama", ollamaBaseUrl: process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434", ollamaModel: process.env.OLLAMA_MODEL?.trim() || "llama3.2", embeddingProvider: "none", embeddingBaseUrl: process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434", embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL?.trim() || "nomic-embed-text", ragMinScore: 1, ragMaxResults: 12, ragMemoryLimit: 12, ragRecentEventLimit: 8, ragSkillLimit: 5, ragIncludeGlobal: true, autoConsolidation: true };

export class JarvisRuntime {
  readonly projects = new ProjectResolver(); readonly dynamic: DynamicStore; readonly memory: FileMemoryEngine; readonly skills: FilesystemSkillEngine; readonly context: DefaultContextEngine; readonly evaluations = new EvaluationEngine(); readonly reflections = new ReflectionEngine(); readonly agents = new AgentManager(); readonly tools = new ToolGateway(); readonly identity: IdentityService; readonly settings: RuntimeSettings;
  private constructor(readonly config: RuntimeConfig, dynamic: DynamicStore, identity: IdentityService, settings: RuntimeSettings) { this.dynamic = dynamic; this.identity = identity; this.settings = settings; this.memory = new FileMemoryEngine(new MarkdownMemoryStore(config.memoryRoot), dynamic); this.memory.setRetrievalConfig({ minScore: settings.ragMinScore, maxResults: settings.ragMaxResults, includeGlobal: settings.ragIncludeGlobal }); this.skills = new FilesystemSkillEngine(config.skillsRoot); this.context = new DefaultContextEngine(this.memory, { active: (projectId) => dynamic.activeGoal(projectId) }, this.skills, (projectId, limit) => dynamic.recentEvents(projectId, limit), { memory: settings.ragMemoryLimit, events: settings.ragRecentEventLimit, skills: settings.ragSkillLimit }); }
  static async create(config: RuntimeConfig) { await Promise.all([mkdir(config.memoryRoot, { recursive: true }), mkdir(config.skillsRoot, { recursive: true })]); const dynamic: DynamicStore = config.databaseUrl ? new PostgresDynamicStore(config.databaseUrl) : new JsonlDynamicStore(resolve(config.memoryRoot, "..", "runtime")); await dynamic.initialize(); const identity = new IdentityService(join(resolve(config.memoryRoot, ".."), "identity.json"), config.assistantName); await identity.initialize(); const settingsPath = join(resolve(config.memoryRoot, ".."), "settings.json"); let settings = defaultSettings; try { settings = runtimeSettingsInput.parse({ ...defaultSettings, ...JSON.parse(await readFile(settingsPath, "utf8")) }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } return new JarvisRuntime(config, dynamic, identity, settings); }
  async openSession(input: unknown) { const value = openSessionInput.parse(input); const project = value.mode === "maintenance" ? { id: "maintenance", workspace: value.workspace, name: "维护审阅", description: "独立维护会话，不会写入业务项目上下文。" } : await this.projects.resolve(value.workspace); if (value.mode !== "maintenance") await this.dynamic.saveProject(project); const session = await this.dynamic.createSession({ projectId: project.id, workspace: project.workspace, client: value.client, task: value.task, mode: value.mode }); await this.memory.observe({ sessionId: session.id, type: "observation", content: value.task }); return { session, project, assistantName: this.identity.assistantName, onboarding: this.identity.onboardingRequired ? { required: true, question: this.identity.onboardingQuestion } : { required: false } }; }
  async buildContext(input: unknown) { const value = buildContextInput.parse(input); const session = await this.requireSession(value.sessionId); const project = await this.projects.resolve(session.workspace); return this.context.build({ session, project, task: value.task, tokenBudget: value.tokenBudget }); }
  async retrieveContext(input: unknown) { const value = retrieveContextInput.parse(input); const project = value.workspace ? await this.projects.resolve(value.workspace) : await this.resolveProjectFromTask(value.task); const session = { id: newId("context"), projectId: project.id, workspace: project.workspace, client: value.client, task: value.task, mode: project.id === "unassigned" ? "unassigned" as const : "work" as const, status: "active" as const, createdAt: now(), updatedAt: now() }; return this.context.build({ session, project, task: value.task, tokenBudget: value.tokenBudget }); }
  async searchMemory(projectId: string, query: string, limit = 10) { return this.memory.recall({ projectId, query, limit }); }
  async searchRag(input: { projectId?: string; query: string; limit?: number; minScore?: number }) { const limit = Math.min(100, Math.max(1, input.limit ?? this.settings.ragMaxResults)); return this.memory.search({ projectId: input.projectId, query: input.query, limit, minScore: input.minScore ?? this.settings.ragMinScore, includeGlobal: this.settings.ragIncludeGlobal }); }
  async getSettings() { return this.settings; }
  async updateSettings(input: unknown) { const next = runtimeSettingsInput.parse(input); Object.assign(this.settings, next); this.memory.setRetrievalConfig({ minScore: next.ragMinScore, maxResults: next.ragMaxResults, includeGlobal: next.ragIncludeGlobal }); this.context.setLimits({ memory: next.ragMemoryLimit, events: next.ragRecentEventLimit, skills: next.ragSkillLimit }); await writeFile(join(resolve(this.config.memoryRoot, ".."), "settings.json"), JSON.stringify(next, null, 2), "utf8"); return this.settings; }
  async testOllama() { if (this.settings.provider !== "ollama") return { ok: false, provider: this.settings.provider, message: "Ollama provider is disabled" }; try { const response = await fetch(`${this.settings.ollamaBaseUrl.replace(/\/$/, "")}/api/tags`); return { ok: response.ok, provider: "ollama", baseUrl: this.settings.ollamaBaseUrl, model: this.settings.ollamaModel, message: response.ok ? "connected" : `HTTP ${response.status}` }; } catch (error) { return { ok: false, provider: "ollama", baseUrl: this.settings.ollamaBaseUrl, model: this.settings.ollamaModel, message: error instanceof Error ? error.message : String(error) }; } }
  async testEmbedding() { if (this.settings.embeddingProvider !== "ollama") return { ok: false, provider: this.settings.embeddingProvider, message: "Embedding provider is disabled" }; try { const response = await fetch(`${this.settings.embeddingBaseUrl.replace(/\/$/, "")}/api/embed`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: this.settings.embeddingModel, input: "jarvis embedding health check" }) }); if (!response.ok) return { ok: false, provider: "ollama", model: this.settings.embeddingModel, message: `HTTP ${response.status}` }; const payload = await response.json() as { embeddings?: number[][] }; return { ok: Array.isArray(payload.embeddings?.[0]), provider: "ollama", model: this.settings.embeddingModel, dimensions: payload.embeddings?.[0]?.length ?? 0, message: Array.isArray(payload.embeddings?.[0]) ? "connected" : "Invalid embedding response" }; } catch (error) { return { ok: false, provider: "ollama", model: this.settings.embeddingModel, message: error instanceof Error ? error.message : String(error) }; } }
  async openMaintenanceSession(input: { client: string; task: string }) { return this.openSession({ ...input, workspace: process.cwd(), mode: "maintenance" }); }
  async memoryCandidates(projectId: string) { return this.memory.candidates(projectId); }
  async projectContext(projectId: string) { return { projectId, activeGoal: await this.dynamic.activeGoal(projectId), goals: await this.dynamic.listGoals(projectId), memories: await this.memory.recall({ projectId, query: "", limit: 30 }), recentEvents: await this.dynamic.recentEvents(projectId, 20), experiences: await this.dynamic.listExperiences(projectId, 20) }; }
  async activeGoal(projectId: string) { return this.dynamic.activeGoal(projectId); }
  async createGoal(input: unknown) { return this.dynamic.saveGoal(goalInput.parse(input)); }
  async searchSkills(query: string, limit = 10) { return this.skills.search(query, limit); }
  async loadSkill(name: string) { return this.skills.load(name); }
  selfCapabilities() { return { assistantName: this.identity.assistantName ?? null, onboardingRequired: this.identity.onboardingRequired, onboardingQuestion: this.identity.onboardingRequired ? this.identity.onboardingQuestion : null, capabilities: ["sessions", "project identity", "context packages", "reviewed Markdown memory", "events", "experiences", "goals", "skills", "MCP stdio", "MCP HTTP", "permission decisions"], transports: ["stdio", "streamable-http"], semanticMemoryWrites: "reviewed candidates only" }; }
  async setAssistantName(name: string) { return this.identity.setName(name); }
  async changeAssistantNameFromNaturalLanguage(message: string) { return this.identity.changeFromNaturalLanguage(message); }
  async spawnAgent(sessionId: string, task: string) { await this.requireSession(sessionId); return this.agents.request(sessionId, task); }
  async recordEvent(input: unknown) { const value = eventInput.parse(input); await this.requireSession(value.sessionId); return this.memory.observe(value); }
  async recordExperience(input: unknown) { const value = experienceInput.parse(input); const session = await this.requireSession(value.sessionId); const experience = await this.dynamic.saveExperience({ ...value, projectId: session.projectId }); const evaluation = this.evaluations.evaluate(experience); const candidates = await Promise.all(this.reflections.candidates(experience).map((candidate) => this.memory.saveCandidate(candidate))); await this.memory.observe({ sessionId: session.id, type: "result", content: [value.summary, ...value.decisions.map((item) => `Decision: ${item}`), ...value.failures.map((item) => `Failure: ${item}`), ...value.nextSteps.map((item) => `Next: ${item}`), `Evaluation: ${evaluation.score}/100 - ${evaluation.rationale}`, `Reflection candidates: ${candidates.length}`].join("\n") }); return { experience, evaluation, candidates }; }
  async closeSession(input: unknown) { const value = closeSessionInput.parse(input); const experience = await this.recordExperience(value); await this.dynamic.closeSession(value.sessionId); return { closed: true, result: value.result, experience }; }
  async rememberCandidate(sessionId: string, input: Omit<MemoryRecord, "id" | "revision" | "status" | "createdAt" | "updatedAt" | "projectId"> & { scope: "global" | "project" }) { const session = await this.requireSession(sessionId); return this.memory.saveCandidate({ ...input, projectId: input.scope === "project" ? session.projectId : undefined }); }
  async promoteMemory(projectId: string, id: string, expectedRevision: number) { const record = (await this.memory.candidates(projectId)).find((item) => item.id === id); if (!record) throw new Error("Candidate memory not found in project scope"); return this.memory.promote({ record, expectedRevision }); }
  async listSessions(filter?: { projectId?: string; status?: "active" | "closed"; limit?: number }) { return this.dynamic.listSessions(filter); }
  async listProjects() { return this.dynamic.listProjects(); }
  private async resolveProjectFromTask(task: string): Promise<ProjectIdentity> {
    const projects = await this.dynamic.listProjects();
    const terms = task.toLowerCase().split(/\s+/).filter(Boolean);
    const ranked = projects.map((project) => ({ project, score: terms.reduce((n, term) => n + Number(`${project.name} ${project.description ?? ""} ${(project.keywords ?? []).join(" ")}`.toLowerCase().includes(term)), 0) })).sort((a, b) => b.score - a.score);
    if (ranked[0]?.score && ranked[0].score > (ranked[1]?.score ?? 0)) return ranked[0].project;
    return { id: "unassigned", workspace: "", name: "待归属项目", description: "无法根据当前任务唯一匹配项目；请在审批中心归属后再写入长期记忆。", keywords: [] };
  }
  async allCandidates(projectId?: string) { return this.memory.candidates(projectId); }
  async allMemories(projectId?: string) { return this.memory.allMemories(projectId); }
  async updateCandidate(id: string, updates: Partial<Pick<MemoryRecord, "title" | "content" | "kind">>) { return this.memory.updateCandidate(id, updates); }
  async archiveCandidate(id: string) { return this.memory.archiveCandidate(id); }
  async reassignCandidate(id: string, projectId: string) { const project = (await this.dynamic.listProjects()).find((item) => item.id === projectId); if (!project) throw new Error("Target project not found"); return this.memory.reassignCandidate(id, projectId); }
  async consolidateMemory() { return this.memory.consolidate(); }
  async promoteCandidate(id: string, expectedRevision: number) { const candidates = await this.memory.candidates(); const record = candidates.find((item) => item.id === id); if (!record) throw new Error("Candidate memory not found"); return this.memory.promote({ record, expectedRevision }); }
  async overviewStats() {
    const [sessions, candidates, memories, skills] = await Promise.all([
      this.dynamic.listSessions({ limit: 100 }),
      this.memory.candidates(),
      this.memory.allMemories(),
      this.skills.search("", 100),
    ]);
    const activeSessions = sessions.filter((s) => s.status === "active").length;
    return {
      activeSessions,
      totalSessions: sessions.length,
      pendingCandidates: candidates.length,
      activeMemories: memories.filter((m) => m.status === "active").length,
      totalSkills: skills.length,
    };
  }
  async registerProject(input: { workspace: string; name?: string; description?: string; keywords?: string[]; initialGoal?: string }): Promise<ProjectIdentity> {
    const project = await this.projects.register(input.workspace, input.name, { description: input.description, keywords: input.keywords });
    await this.dynamic.saveProject(project);
    if (input.initialGoal?.trim()) {
      await this.dynamic.saveGoal({ projectId: project.id, title: input.initialGoal.trim(), status: "active" });
    }
    return project;
  }
  async deleteProject(id: string) { return this.dynamic.deleteProject(id); }
  async listProjectsDetailed() {
    const projects = await this.dynamic.listProjects();
    return Promise.all(
      projects.map(async (p) => {
        const [goals, memories] = await Promise.all([
          this.dynamic.listGoals(p.id).catch(() => []),
          this.memory.allMemories(p.id).catch(() => []),
        ]);
        return {
          ...p,
          goalsCount: goals.length,
          memoriesCount: memories.length,
          activeGoal: goals.find((g) => g.status === "active")?.title,
        };
      })
    );
  }
  async loadSkillBundle(name: string) { return this.skills.loadBundle(name); }
  async saveSkillBundle(bundle: SkillBundle) { return this.skills.saveBundle(bundle); }
  async deleteSkill(name: string) { return this.skills.delete(name); }
  private async requireSession(id: string) { const session = await this.dynamic.getSession(id); if (!session) throw new Error("Session not found"); return session; }
}
