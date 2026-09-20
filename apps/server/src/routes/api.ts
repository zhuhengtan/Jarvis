import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { JarvisRuntime } from "../runtime.js";

interface PublicRoutesOptions {
  runtime: JarvisRuntime;
}

export const publicRoutes: FastifyPluginAsync<PublicRoutesOptions> = async (app: FastifyInstance, options) => {
  const { runtime } = options;

  app.get("/health", async () => ({ status: "ok", assistantName: runtime.identity.assistantName ?? null, onboardingRequired: runtime.identity.onboardingRequired, onboardingQuestion: runtime.identity.onboardingRequired ? runtime.identity.onboardingQuestion : null }));
  app.get("/v1/capabilities", async () => runtime.selfCapabilities());
  app.put("/v1/identity/name", async (request) => runtime.setAssistantName(z.object({ name: z.string() }).parse(request.body).name));
  app.post("/v1/identity/interpret", async (request) => runtime.changeAssistantNameFromNaturalLanguage(z.object({ message: z.string() }).parse(request.body).message));
  app.post("/v1/sessions", async (request) => runtime.openSession(request.body));
  app.post("/v1/maintenance/sessions", async (request) => runtime.openMaintenanceSession(z.object({ client: z.string().min(1), task: z.string().min(1) }).parse(request.body)));
  app.post("/v1/context/build", async (request) => runtime.buildContext(request.body));
  app.post("/v1/context/retrieve", async (request) => runtime.retrieveContext(request.body));
  app.get("/v1/memory/search", async (request) => { const query = z.object({ projectId: z.string(), query: z.string(), limit: z.coerce.number().int().min(1).max(50).default(10) }).parse(request.query); return runtime.searchMemory(query.projectId, query.query, query.limit); });
  app.get("/v1/rag/search", async (request) => { const query = z.object({ projectId: z.string().optional(), query: z.string().default(""), limit: z.coerce.number().int().min(1).max(100).optional(), minScore: z.coerce.number().min(0).max(20).optional() }).parse(request.query); return runtime.searchRag(query); });
  app.get("/v1/memory/candidates", async (request) => runtime.allCandidates(z.object({ projectId: z.string().optional() }).parse(request.query).projectId));
  app.get("/v1/memory/:id", async (request, reply) => { const record = (await runtime.allMemories()).find((item) => item.id === (request.params as { id: string }).id); return record ?? reply.code(404).send({ error: "Memory not found" }); });
  app.post("/v1/memory/candidates", async (request) => {
    const body = z.object({ sessionId: z.string().min(1), scope: z.enum(["global", "project"]), kind: z.enum(["preference", "fact", "constraint", "decision", "identity", "workflow"]), title: z.string().min(1).max(200), content: z.string().min(1).max(10_000), sourceRefs: z.array(z.string().min(1)).max(20).default([]) }).parse(request.body);
    return runtime.rememberCandidate(body.sessionId, body);
  });
  app.post("/v1/memory/:id/promote", async (request) => { const body = z.object({ projectId: z.string(), expectedRevision: z.number().int().positive() }).parse(request.body); return runtime.promoteMemory(body.projectId, (request.params as { id: string }).id, body.expectedRevision); });
  app.post("/v1/memory/:id/archive", async (request) => runtime.archiveCandidate((request.params as { id: string }).id));
  app.post("/v1/memory/:id/reassign", async (request) => { const body = z.object({ projectId: z.string().min(1) }).parse(request.body); return runtime.reassignCandidate((request.params as { id: string }).id, body.projectId); });
  app.post("/v1/memory/consolidate", async () => runtime.consolidateMemory());
  app.get("/v1/projects/:id/context", async (request) => runtime.projectContext((request.params as { id: string }).id));
  app.get("/v1/projects", async () => runtime.listProjectsDetailed());
  app.get("/v1/goals/active", async (request) => (await runtime.activeGoal(z.object({ projectId: z.string() }).parse(request.query).projectId)) ?? null);
  app.post("/v1/goals", async (request) => runtime.createGoal(request.body));
  app.get("/v1/skills/search", async (request) => { const query = z.object({ query: z.string(), limit: z.coerce.number().int().min(1).max(50).default(10) }).parse(request.query); return runtime.searchSkills(query.query, query.limit); });
  app.get("/v1/skills/:name", async (request, reply) => { const skill = await runtime.loadSkill((request.params as { name: string }).name); return skill ? { name: (request.params as { name: string }).name, content: skill } : reply.code(404).send({ error: "Skill not found" }); });
  app.post("/v1/events", async (request) => runtime.recordEvent(request.body));
  app.post("/v1/experiences", async (request) => runtime.recordExperience(request.body));
  app.post("/v1/agents", async (request) => { const body = z.object({ sessionId: z.string(), task: z.string().min(1) }).parse(request.body); return runtime.spawnAgent(body.sessionId, body.task); });
  app.post("/v1/sessions/:id/close", async (request) => runtime.closeSession({ ...(request.body as object), sessionId: (request.params as { id: string }).id }));
};
