import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { JarvisRuntime } from "./runtime.js";
import { findRepoRoot, loadLocalEnv } from "./env.js";
import { adminRoutes } from "./routes/admin.js";
import { publicRoutes } from "./routes/api.js";

await loadLocalEnv();
const port = Number(process.env.JARVIS_PORT ?? 7330);
const host = process.env.JARVIS_HOST ?? "127.0.0.1";

const defaultJarvisHome = process.env.JARVIS_HOME?.trim() || join(homedir(), ".jarvis");
const defaultMemoryRoot = join(defaultJarvisHome, "memory");
const defaultSkillsRoot = join(defaultJarvisHome, "skills");

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
  if (token && request.headers.authorization !== `Bearer ${token}`) return reply.code(401).send({ error: "Unauthorized" });
});

await app.register(publicRoutes, { runtime });
await app.register(adminRoutes, { prefix: "/v1/admin", runtime });

const adminDist = join(findRepoRoot(), "apps/admin/dist");
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
runtime.startAutoApprovalSchedule();
if ((await runtime.getSettings()).autoApprovalEnabled) runtime.beginOldestApprovalSweep();
