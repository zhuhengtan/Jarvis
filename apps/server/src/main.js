import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { z } from "zod";
import { JarvisRuntime } from "./runtime.js";
import { loadLocalEnv } from "./env.js";
import { adminRoutes } from "./routes/admin.js";
await loadLocalEnv();
const port = Number(process.env.JARVIS_PORT ?? 7330);
const host = process.env.JARVIS_HOST ?? "127.0.0.1";
const defaultJarvisHome = process.env.JARVIS_HOME?.trim() || join(homedir(), ".jarvis");
const defaultMemoryRoot = join(defaultJarvisHome, "memory");
const defaultSkillsRoot = existsSync(join(defaultJarvisHome, "memory", "skills"))
    ? join(defaultJarvisHome, "memory", "skills")
    : join(defaultJarvisHome, "skills");
const memoryRoot = process.env.MEMORY_ROOT?.trim() ? String(process.env.MEMORY_ROOT).trim() : defaultMemoryRoot;
const skillsRoot = process.env.SKILLS_ROOT?.trim() ? String(process.env.SKILLS_ROOT).trim() : defaultSkillsRoot;
const runtime = await JarvisRuntime.create({
    assistantName: process.env.JARVIS_ASSISTANT_NAME?.trim() || undefined,
    memoryRoot,
    skillsRoot,
    databaseUrl: process.env.DATABASE_URL
});
const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
app.addHook("onRequest", async (request, reply) => {
    if (request.url.startsWith("/v1/admin") || request.url === "/health" || !request.url.startsWith("/v1")) {
        return;
    }
    const token = process.env.JARVIS_API_TOKEN;
    if (token && request.headers.authorization !== `Bearer ${token}`)
        return reply.code(401).send({ error: "Unauthorized" });
});
await app.register(adminRoutes, { prefix: "/v1/admin", runtime });
app.get("/health", async () => ({ status: "ok", assistantName: runtime.identity.assistantName ?? null, onboardingRequired: runtime.identity.onboardingRequired, onboardingQuestion: runtime.identity.onboardingRequired ? runtime.identity.onboardingQuestion : null }));
app.get("/v1/capabilities", async () => runtime.selfCapabilities());
app.put("/v1/identity/name", async (request) => runtime.setAssistantName(z.object({ name: z.string() }).parse(request.body).name));
app.post("/v1/identity/interpret", async (request) => runtime.changeAssistantNameFromNaturalLanguage(z.object({ message: z.string() }).parse(request.body).message));
app.post("/v1/sessions", async (request) => runtime.openSession(request.body));
app.post("/v1/context/build", async (request) => runtime.buildContext(request.body));
app.get("/v1/memory/search", async (request) => { const query = z.object({ projectId: z.string(), query: z.string(), limit: z.coerce.number().int().min(1).max(50).default(10) }).parse(request.query); return runtime.searchMemory(query.projectId, query.query, query.limit); });
app.get("/v1/memory/candidates", async (request) => runtime.memoryCandidates(z.object({ projectId: z.string() }).parse(request.query).projectId));
app.post("/v1/memory/:id/promote", async (request) => { const body = z.object({ projectId: z.string(), expectedRevision: z.number().int().positive() }).parse(request.body); return runtime.promoteMemory(body.projectId, request.params.id, body.expectedRevision); });
app.post("/v1/memory/:id/archive", async (request) => runtime.archiveCandidate(request.params.id));
app.get("/v1/projects/:id/context", async (request) => runtime.projectContext(request.params.id));
app.get("/v1/goals/active", async (request) => runtime.activeGoal(z.object({ projectId: z.string() }).parse(request.query).projectId));
app.post("/v1/goals", async (request) => runtime.createGoal(request.body));
app.get("/v1/skills/search", async (request) => { const query = z.object({ query: z.string(), limit: z.coerce.number().int().min(1).max(50).default(10) }).parse(request.query); return runtime.searchSkills(query.query, query.limit); });
app.get("/v1/skills/:name", async (request, reply) => { const skill = await runtime.loadSkill(request.params.name); return skill ? { name: request.params.name, content: skill } : reply.code(404).send({ error: "Skill not found" }); });
app.post("/v1/events", async (request) => runtime.recordEvent(request.body));
app.post("/v1/experiences", async (request) => runtime.recordExperience(request.body));
app.post("/v1/agents", async (request) => { const body = z.object({ sessionId: z.string(), task: z.string().min(1) }).parse(request.body); return runtime.spawnAgent(body.sessionId, body.task); });
app.post("/v1/sessions/:id/close", async (request) => runtime.closeSession({ ...request.body, sessionId: request.params.id }));
const adminDist = join(dirname(fileURLToPath(import.meta.url)), "../../admin/dist");
if (existsSync(adminDist)) {
    await app.register(fastifyStatic, { root: adminDist, prefix: "/" });
    app.setNotFoundHandler(async (request, reply) => {
        if (request.raw.url && !request.raw.url.startsWith("/v1")) {
            return reply.sendFile("index.html");
        }
        return reply.code(404).send({ error: "Not Found" });
    });
}
await app.listen({ port, host });
//# sourceMappingURL=main.js.map