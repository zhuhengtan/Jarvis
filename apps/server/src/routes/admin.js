import { z } from "zod";
import { updateCandidateInput, registerProjectInput, skillBundleInput } from "@jarvis/shared";
export const adminRoutes = async (app, options) => {
    const { runtime } = options;
    const adminKey = process.env.JARVIS_ADMIN_KEY || process.env.JARVIS_API_TOKEN || "jarvis-admin";
    // Login endpoint (unprotected)
    app.post("/auth/login", async (request, reply) => {
        const body = z.object({
            token: z.string().min(1),
        }).parse(request.body);
        if (body.token !== adminKey) {
            return reply.code(401).send({ error: "Invalid admin key or password" });
        }
        return {
            success: true,
            token: body.token,
            user: {
                id: "admin_1",
                name: runtime.identity.assistantName ? `${runtime.identity.assistantName} Admin` : "Jarvis Administrator",
                role: "admin",
            },
        };
    });
    // Protected admin routes hook
    app.register(async (protectedApp) => {
        protectedApp.addHook("onRequest", async (request, reply) => {
            const auth = request.headers.authorization;
            const expected = `Bearer ${adminKey}`;
            if (auth !== expected) {
                return reply.code(401).send({ error: "Unauthorized: Invalid Admin Token" });
            }
        });
        // Overview statistics
        protectedApp.get("/overview", async () => {
            const stats = await runtime.overviewStats();
            const capabilities = runtime.selfCapabilities();
            return {
                ...stats,
                assistantName: runtime.identity.assistantName,
                onboardingRequired: runtime.identity.onboardingRequired,
                capabilities: capabilities.capabilities,
            };
        });
        protectedApp.get("/settings", async () => runtime.getSettings());
        protectedApp.put("/settings", async (request) => runtime.updateSettings(request.body));
        protectedApp.post("/settings/ollama/test", async () => runtime.testOllama());
        protectedApp.post("/settings/embedding/test", async () => runtime.testEmbedding());
        protectedApp.get("/rag/search", async (request) => {
            const query = z.object({ projectId: z.string().optional(), query: z.string().default(""), limit: z.coerce.number().int().min(1).max(100).optional(), minScore: z.coerce.number().min(0).max(20).optional() }).parse(request.query);
            return runtime.searchRag(query);
        });
        // Candidates management
        protectedApp.get("/candidates", async (request) => {
            const query = z.object({ projectId: z.string().optional() }).parse(request.query);
            return runtime.allCandidates(query.projectId);
        });
        protectedApp.put("/candidates/:id", async (request) => {
            const { id } = request.params;
            const body = updateCandidateInput.parse(request.body);
            return runtime.updateCandidate(id, body);
        });
        protectedApp.post("/candidates/:id/promote", async (request) => {
            const { id } = request.params;
            const body = z.object({ expectedRevision: z.number().int().positive() }).parse(request.body);
            return runtime.promoteCandidate(id, body.expectedRevision);
        });
        protectedApp.post("/candidates/:id/archive", async (request) => {
            const { id } = request.params;
            const archived = await runtime.archiveCandidate(id);
            return { success: true, record: archived };
        });
        protectedApp.post("/candidates/:id/reassign", async (request) => {
            const { id } = request.params;
            const body = z.object({ projectId: z.string().min(1) }).parse(request.body);
            return runtime.reassignCandidate(id, body.projectId);
        });
        protectedApp.post("/consolidate", async () => runtime.consolidateMemory());
        // Durable memories
        protectedApp.get("/memories", async (request) => {
            const query = z.object({
                projectId: z.string().optional(),
                query: z.string().optional(),
            }).parse(request.query);
            if (query.query && query.projectId) {
                return runtime.searchMemory(query.projectId, query.query, 50);
            }
            return runtime.allMemories(query.projectId);
        });
        // Sessions & Observability
        protectedApp.get("/sessions", async (request) => {
            const query = z.object({
                projectId: z.string().optional(),
                status: z.enum(["active", "closed"]).optional(),
                limit: z.coerce.number().int().min(1).max(100).default(50),
            }).parse(request.query);
            return runtime.listSessions(query);
        });
        protectedApp.get("/sessions/:id", async (request, reply) => {
            const { id } = request.params;
            const session = await runtime.dynamic.getSession(id);
            if (!session)
                return reply.code(404).send({ error: "Session not found" });
            const [events, experiences] = await Promise.all([
                runtime.dynamic.recentEvents(session.projectId, 50),
                runtime.dynamic.listExperiences(session.projectId, 10),
            ]);
            return {
                session,
                events: events.filter((e) => e.sessionId === session.id),
                experiences: experiences.filter((exp) => exp.sessionId === session.id),
            };
        });
        // Projects
        protectedApp.get("/projects", async () => {
            return runtime.listProjectsDetailed();
        });
        protectedApp.post("/projects", async (request) => {
            const body = registerProjectInput.parse(request.body);
            return runtime.registerProject(body);
        });
        protectedApp.delete("/projects/:id", async (request) => {
            const { id } = request.params;
            await runtime.deleteProject(id);
            return { success: true };
        });
        // Goals
        protectedApp.get("/goals", async (request) => {
            const query = z.object({ projectId: z.string() }).parse(request.query);
            return runtime.dynamic.listGoals(query.projectId);
        });
        // Skills
        protectedApp.get("/skills", async (request) => {
            const query = z.object({ query: z.string().default(""), limit: z.coerce.number().int().default(50) }).parse(request.query);
            return runtime.searchSkills(query.query, query.limit);
        });
        protectedApp.get("/skills/:name", async (request, reply) => {
            const { name } = request.params;
            const skill = await runtime.loadSkill(name);
            return skill ? { name, content: skill } : reply.code(404).send({ error: "Skill not found" });
        });
        protectedApp.get("/skills/:name/bundle", async (request, reply) => {
            const { name } = request.params;
            const bundle = await runtime.loadSkillBundle(name);
            return bundle ? bundle : reply.code(404).send({ error: "Skill not found" });
        });
        protectedApp.post("/skills", async (request) => {
            const body = skillBundleInput.parse(request.body);
            await runtime.saveSkillBundle(body);
            return { success: true, bundle: body };
        });
        protectedApp.put("/skills/:name", async (request) => {
            const { name } = request.params;
            const body = skillBundleInput.parse({ ...request.body, name });
            await runtime.saveSkillBundle(body);
            return { success: true, bundle: body };
        });
        protectedApp.delete("/skills/:name", async (request) => {
            const { name } = request.params;
            const deleted = await runtime.deleteSkill(name);
            return { success: deleted };
        });
    });
};
//# sourceMappingURL=admin.js.map