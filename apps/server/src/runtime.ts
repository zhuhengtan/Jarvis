import { mkdir, readFile, writeFile } from "node:fs/promises";

import { basename, join, resolve } from "node:path";
import { DefaultContextEngine } from "@jarvis/context";
import { AgentManager } from "@jarvis/agents";
import { EvaluationEngine } from "@jarvis/evaluation";
import { FileMemoryEngine, JsonEmbeddingIndex, JsonlDynamicStore, MarkdownMemoryStore, PostgresDynamicStore, ProjectResolver, type DynamicStore } from "@jarvis/memory";
import { FilesystemSkillEngine } from "@jarvis/skills";
import { ReflectionEngine } from "@jarvis/reflection";
import { OllamaProvider } from "@jarvis/providers";
import { ToolGateway } from "@jarvis/tools";
import { IdentityService } from "./identity.js";
import { prepareCandidateReview } from "./candidate-review.js";
import { autoApproveCandidatesInput, closeSessionInput, eventInput, experienceInput, goalInput, openSessionInput, buildContextInput, retrieveContextInput, runtimeSettingsInput, newId, now, type MemoryRecord, type SkillBundle, type ProjectIdentity, type RuntimeSettings } from "@jarvis/shared";

export interface RuntimeConfig { assistantName?: string; memoryRoot: string; skillsRoot: string; databaseUrl?: string; }
const defaultSettings: RuntimeSettings = { provider: "ollama", ollamaBaseUrl: process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434", ollamaModel: process.env.OLLAMA_MODEL?.trim() || "llama3.2", embeddingProvider: "none", embeddingBaseUrl: process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434", embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL?.trim() || "nomic-embed-text", ragMinScore: 1, ragMaxResults: 12, ragMemoryLimit: 12, ragRecentEventLimit: 8, ragSkillLimit: 5, ragIncludeGlobal: true, autoConsolidation: true };

export class JarvisRuntime {
  readonly projects = new ProjectResolver(); readonly dynamic: DynamicStore; readonly memory: FileMemoryEngine; readonly skills: FilesystemSkillEngine; readonly context: DefaultContextEngine; readonly evaluations = new EvaluationEngine(); readonly reflections = new ReflectionEngine(); readonly agents = new AgentManager(); readonly tools = new ToolGateway(); readonly identity: IdentityService; readonly settings: RuntimeSettings;
  private constructor(readonly config: RuntimeConfig, dynamic: DynamicStore, identity: IdentityService, settings: RuntimeSettings) { this.dynamic = dynamic; this.identity = identity; this.settings = settings; this.memory = new FileMemoryEngine(new MarkdownMemoryStore(config.memoryRoot), dynamic); this.memory.setRetrievalConfig({ minScore: settings.ragMinScore, maxResults: settings.ragMaxResults, includeGlobal: settings.ragIncludeGlobal }); this.skills = new FilesystemSkillEngine(config.skillsRoot); this.context = new DefaultContextEngine(this.memory, { active: (projectId) => dynamic.activeGoal(projectId) }, this.skills, (projectId, limit) => dynamic.recentEvents(projectId, limit), { memory: settings.ragMemoryLimit, events: settings.ragRecentEventLimit, skills: settings.ragSkillLimit }); }
  static async create(config: RuntimeConfig) {
    await Promise.all([mkdir(config.memoryRoot, { recursive: true }), mkdir(config.skillsRoot, { recursive: true })]);
    const dynamic: DynamicStore = config.databaseUrl ? new PostgresDynamicStore(config.databaseUrl) : new JsonlDynamicStore(resolve(config.memoryRoot, "..", "runtime"));
    await dynamic.initialize();
    const identity = new IdentityService(join(resolve(config.memoryRoot, ".."), "identity.json"), config.assistantName);
    await identity.initialize();
    const settingsPath = join(resolve(config.memoryRoot, ".."), "settings.json");
    let settings = defaultSettings;
    try { settings = runtimeSettingsInput.parse({ ...defaultSettings, ...JSON.parse(await readFile(settingsPath, "utf8")) }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const runtime = new JarvisRuntime(config, dynamic, identity, settings);
    runtime.applyProviders();
    return runtime;
  }
  private applyProviders() {
    if (this.settings.embeddingProvider === "ollama") {
      const embedder = new OllamaProvider(this.settings.embeddingBaseUrl, this.settings.embeddingModel);
      this.memory.setEmbedding({
        model: this.settings.embeddingModel,
        index: new JsonEmbeddingIndex(join(resolve(this.config.memoryRoot, ".."), "runtime", "embeddings.json")),
        embed: (texts) => embedder.embed(texts),
      });
    } else {
      this.memory.setEmbedding(undefined);
    }
  }
  async openSession(input: unknown) {
    const value = openSessionInput.parse(input);
    if (value.mode === "maintenance" || value.mode === "unassigned") {
      const project = { id: value.mode, workspace: value.workspace, name: value.mode === "maintenance" ? "维护审阅" : "待归属项目", description: "独立上下文，不会读取业务项目记忆。" };
      const session = await this.dynamic.createSession({ projectId: project.id, workspace: project.workspace, client: value.client, task: value.task, mode: value.mode });
      await this.memory.observe({ sessionId: session.id, type: "observation", content: value.task });
      return { session, project, assistantName: this.identity.assistantName, onboarding: this.identity.onboardingRequired ? { required: true, question: this.identity.onboardingQuestion } : { required: false } };
    }
    const { project, identityWarning, containedProjects } = await this.projects.resolve(value.workspace);
    await this.dynamic.saveProject(project);
    const session = await this.dynamic.createSession({ projectId: project.id, workspace: project.workspace, client: value.client, task: value.task, mode: value.mode });
    await this.memory.observe({ sessionId: session.id, type: "observation", content: value.task });
    return { session, project, assistantName: this.identity.assistantName, onboarding: this.identity.onboardingRequired ? { required: true, question: this.identity.onboardingQuestion } : { required: false }, identityWarning, containedProjects };
  }
  async buildContext(input: unknown) {
    const value = buildContextInput.parse(input);
    const session = await this.requireSession(value.sessionId);
    const isolated = session.mode === "maintenance" || session.mode === "unassigned";
    const registered = isolated ? undefined : (await this.dynamic.listProjects()).find(project => project.id === session.projectId);
    const project: ProjectIdentity = { ...registered, id: session.projectId, workspace: session.workspace, name: isolated ? session.projectId : registered?.name ?? basename(session.workspace) };
    return this.context.build({ session, project, task: value.task, tokenBudget: value.tokenBudget });
  }
  async retrieveContext(input: unknown) { const value = retrieveContextInput.parse(input); const project = value.workspace ? (await this.projects.resolve(value.workspace)).project : await this.resolveProjectFromTask(value.task); const session = { id: newId("context"), projectId: project.id, workspace: project.workspace, client: value.client, task: value.task, mode: project.id === "unassigned" ? "unassigned" as const : "work" as const, status: "active" as const, createdAt: now(), updatedAt: now() }; return this.context.build({ session, project, task: value.task, tokenBudget: value.tokenBudget }); }
  async searchMemory(projectId: string, query: string, limit = 10) { return this.memory.recall({ projectId, query, limit }); }
  async searchRag(input: { projectId?: string; query: string; limit?: number; minScore?: number }) { const limit = Math.min(100, Math.max(1, input.limit ?? this.settings.ragMaxResults)); return this.memory.search({ projectId: input.projectId, query: input.query, limit, minScore: input.minScore ?? this.settings.ragMinScore, includeGlobal: this.settings.ragIncludeGlobal }); }
  async getSettings() { return this.settings; }
  async updateSettings(input: unknown) { const next = runtimeSettingsInput.parse(input); Object.assign(this.settings, next); this.memory.setRetrievalConfig({ minScore: next.ragMinScore, maxResults: next.ragMaxResults, includeGlobal: next.ragIncludeGlobal }); this.context.setLimits({ memory: next.ragMemoryLimit, events: next.ragRecentEventLimit, skills: next.ragSkillLimit }); this.applyProviders(); await writeFile(join(resolve(this.config.memoryRoot, ".."), "settings.json"), JSON.stringify(next, null, 2), "utf8"); return this.settings; }
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
  async recordExperience(input: unknown) {
    const value = experienceInput.parse(input);
    const session = await this.requireSession(value.sessionId);
    const experience = await this.dynamic.saveExperience({ ...value, projectId: session.projectId });
    const evaluation = this.evaluations.evaluate(experience);
    const extras = this.settings.provider === "ollama" ? await new OllamaProvider(this.settings.ollamaBaseUrl, this.settings.ollamaModel).extract(["Summary:", value.summary, ...value.decisions.map((item) => `Decision: ${item}`), ...value.failures.map((item) => `Failure: ${item}`), ...value.nextSteps.map((item) => `Next: ${item}`)].join("\n")) : [];
    const candidates = await Promise.all(this.reflections.candidates(experience, extras).map((candidate) => this.memory.saveCandidate(candidate)));
    await this.memory.observe({ sessionId: session.id, type: "result", content: [value.summary, ...value.decisions.map((item) => `Decision: ${item}`), ...value.failures.map((item) => `Failure: ${item}`), ...value.nextSteps.map((item) => `Next: ${item}`), `Evaluation: ${evaluation.score}/100 - ${evaluation.rationale}`, `Reflection candidates: ${candidates.length}`].join("\n") });
    return { experience, evaluation, candidates };
  }
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
  async updateCandidate(id: string, updates: Partial<Pick<MemoryRecord, "title" | "content" | "kind">>, expectedRevision: number) { return this.memory.updateCandidate(id, updates, expectedRevision); }
  async archiveCandidate(id: string, expectedRevision?: number) { return this.memory.archiveCandidate(id, expectedRevision); }
  async reassignCandidate(id: string, projectId: string, expectedRevision?: number) { const project = (await this.dynamic.listProjects()).find((item) => item.id === projectId); if (!project) throw new Error("Target project not found"); return this.memory.reassignCandidate(id, projectId, expectedRevision); }
  async consolidateMemory() { return this.memory.consolidate(); }
  async autoApproveCandidates(selections: Array<{ id: string; expectedRevision: number }>) {
    const { candidates: selected } = autoApproveCandidatesInput.parse({ candidates: selections });
    if (this.settings.provider !== "ollama" || !this.settings.ollamaModel.trim()) throw new Error("审核模型未配置");
    const provider = new OllamaProvider(this.settings.ollamaBaseUrl, this.settings.ollamaModel);
    const current = new Map((await this.memory.candidates()).map((candidate) => [candidate.id, candidate]));
    let promoted = 0;
    let archived = 0;
    let kept = 0;
    let failed = 0;
    const results: Array<{ id: string; action: "promote" | "archive" | "keep" | "failed"; reason?: string }> = [];
    for (const [id, expectedRevision] of new Map(selected.map(item => [item.id, item.expectedRevision]))) {
      const candidate = current.get(id);
      if (!candidate) {
        failed += 1;
        results.push({ id, action: "failed", reason: "候选不存在或已不是待审状态" });
        continue;
      }
      if (candidate.revision !== expectedRevision) {
        failed += 1;
        results.push({ id, action: "failed", reason: "候选版本已变化，请刷新后重新选择" });
        continue;
      }
      let review: Awaited<ReturnType<OllamaProvider["reviewCandidate"]>>;
      try {
        const prepared = await prepareCandidateReview(candidate, this.dynamic, this.memory);
        if ("reason" in prepared) {
          kept += 1;
          results.push({ id, action: "keep", reason: prepared.reason });
          continue;
        }
        review = await provider.reviewCandidate(candidate, prepared.context);
        if (!review.error && (review.action === "promote" || review.action === "archive")) {
          await this.memory.applyReviewedDecision(candidate, expectedRevision, review.action, prepared.context.memories);
          if (review.action === "promote") promoted += 1;
          else archived += 1;
          results.push({ id, action: review.action, reason: review.reason });
          continue;
        }
      } catch (error) {
        failed += 1;
        results.push({ id, action: "failed", reason: error instanceof Error ? error.message : String(error) });
        continue;
      }
      if (review.error) {
        failed += 1;
        results.push({ id, action: "failed", reason: review.reason });
        continue;
      }
      if (review.action === "keep") {
        kept += 1;
        results.push({ id, action: "keep", reason: review.reason });
        continue;
      }
      failed += 1;
      results.push({ id, action: "failed", reason: "审核模型返回了无效动作" });
    }
    return { promoted, archived, kept, failed, results };
  }

  async autoReviewCandidates() {
    if (this.settings.provider !== "ollama" || !this.settings.ollamaModel.trim()) throw new Error("审核模型未配置");
    const reviewer = new OllamaProvider(this.settings.ollamaBaseUrl, this.settings.ollamaModel);
    const candidates = await this.memory.candidates();
    const decisions: Array<{ candidate: (typeof candidates)[number]; decision: Awaited<ReturnType<OllamaProvider["reviewCandidate"]>> }> = [];
    const queue = [...candidates];
    const reviewWorker = async () => {
      while (queue.length) {
        const candidate = queue.shift();
        if (!candidate) return;
        try {
          const prepared = await prepareCandidateReview(candidate, this.dynamic, this.memory);
          const decision = "reason" in prepared ? { action: "keep" as const, reason: prepared.reason } : await reviewer.reviewCandidate(candidate, prepared.context);
          decisions.push({ candidate, decision });
        } catch (error) {
          decisions.push({ candidate, decision: { action: "keep", reason: error instanceof Error ? error.message : String(error), error: true } });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, candidates.length) }, () => reviewWorker()));
    // Model output is advice, never proof that the source was verified.
    const recommendations = decisions.filter(({ decision }) => !decision.error).map(({ candidate, decision }) => ({
      id: candidate.id, title: candidate.title, expectedRevision: candidate.revision, action: decision.action, reason: decision.reason,
    }));
    // auto-review is advisory only: it NEVER persists decisions to the candidate store.
    return { total: candidates.length, promoted: 0, archived: 0, kept: recommendations.length, failed: decisions.length - recommendations.length, recommendations };
  }

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
