import { afterEach, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JarvisRuntime } from "../src/runtime.js";
import { publicRoutes } from "../src/routes/api.js";
import { adminRoutes } from "../src/routes/admin.js";
import { OllamaProvider } from "@jarvis/providers";
const roots: string[] = [];
const apps: ReturnType<typeof Fastify>[] = [];
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "jarvis-api-safe-")); roots.push(root);
  const workspace = join(root, "workspace"); await mkdir(join(workspace, ".jarvis"), { recursive: true });
  await writeFile(join(workspace, ".jarvis", "project.json"), JSON.stringify({ id: "business" }));
  const runtime = await JarvisRuntime.create({ memoryRoot: join(root, "memory"), skillsRoot: join(root, "skills") });
  return { root, workspace, runtime };
}
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await Promise.all(apps.splice(0).map(app => app.close())); await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

it("keeps maintenance/unassigned context isolated and pins ordinary session identity", async () => {
  const { runtime, workspace } = await fixture();
  const { session } = await runtime.openSession({ client: "test", workspace, task: "needle business" });
  const memory = await runtime.rememberCandidate(session.id, { scope: "project", kind: "fact", title: "needle", content: "needle business evidence", sourceRefs: [] });
  await runtime.promoteCandidate(memory.id, 1);
  for (const mode of ["maintenance", "unassigned"] as const) {
    const opened = await runtime.openSession({ client: "test", workspace, task: "needle maintenance", mode });
    const context = await runtime.buildContext({ sessionId: opened.session.id, task: "needle" });
    expect(context.project.id).toBe(mode);
    expect(context.memories.some(record => record.id === memory.id)).toBe(false);
    expect(context.recentEvents.some(event => event.sessionId === session.id)).toBe(false);
  }
  const maintenance = await runtime.openMaintenanceSession({ client: "test", task: "needle" });
  expect((await runtime.buildContext({ sessionId: maintenance.session.id, task: "needle" })).project.id).toBe("maintenance");
  await writeFile(join(workspace, ".jarvis", "project.json"), JSON.stringify({ id: "other-project" }));
  const pinned = await runtime.buildContext({ sessionId: session.id, task: "needle" });
  expect(pinned.project.id).toBe("business"); expect(pinned.memories.map(record => record.id)).toContain(memory.id);
});

it("model review returns advice without applying promote or archive", async () => {
  const { runtime, workspace } = await fixture();
  await runtime.updateSettings({ ...await runtime.getSettings(), provider: "ollama" });
  const { session } = await runtime.openSession({ client: "test", workspace, task: "audit" });
  for (const title of ["promote", "archive"]) {
    const evidence = await runtime.recordEvent({ sessionId: session.id, type: "result", content: `${title}: evidence` });
    await runtime.rememberCandidate(session.id, { scope: "project", kind: "fact", title, content: `${title}: evidence`, sourceRefs: [evidence.id] });
  }
  vi.spyOn(OllamaProvider.prototype, "reviewCandidate").mockImplementation(async candidate => ({ action: candidate.title as "promote" | "archive", reason: "synthetic advice" }));
  const result = await runtime.autoReviewCandidates();
  expect(result).toMatchObject({ promoted: 0, archived: 0, kept: 2, failed: 0 });
  expect(result.recommendations.map(item => item.action).sort()).toEqual(["archive", "promote"]);
  expect((await runtime.allCandidates()).length).toBe(2);
  expect(await runtime.consolidateMemory()).toEqual({ promoted: 0, archived: 0 });
});

it("persists auto-approval only for selected ids and continues after per-item failures", async () => {
  const { runtime, workspace } = await fixture();
  await runtime.updateSettings({ ...await runtime.getSettings(), provider: "ollama" });
  vi.stubEnv("JARVIS_ADMIN_KEY", "test-fixture-only");
  const app = Fastify();
  apps.push(app);
  await app.register(adminRoutes, { runtime, prefix: "/v1/admin" });
  const headers = { authorization: "Bearer test-fixture-only" };
  const { session } = await runtime.openSession({ client: "test", workspace, task: "approve" });
  const unassigned = await runtime.openSession({ client: "test", workspace, task: "loose", mode: "unassigned" });
  const content = "durable evidence ".repeat(12);
  const created = Object.fromEntries(await Promise.all([
    ["promote-me", session.id],
    ["archive-me", session.id],
    ["keep-me", session.id],
    ["model-failed", session.id],
    ["throws", session.id],
    ["stale", session.id],
    ["untouched", session.id],
  ].map(async ([title, sessionId]) => {
    const evidence = await runtime.recordEvent({ sessionId, type: "result", content: `${title}: ${content}` });
    return [title, await runtime.rememberCandidate(sessionId, { scope: "project", kind: "fact", title, content: `${title}: ${content}`, sourceRefs: [evidence.id] })];
  })));
  created["unassigned-fact"] = await runtime.rememberCandidate(unassigned.session.id, { scope: "project", kind: "fact", title: "unassigned-fact", content, sourceRefs: ["session"] });
  const review = vi.spyOn(OllamaProvider.prototype, "reviewCandidate").mockImplementation(async () => ({ action: "promote", reason: "advice only" }));
  const advice = await runtime.autoReviewCandidates();
  expect(advice).toMatchObject({ promoted: 0, archived: 0 });
  expect((await runtime.allCandidates()).length).toBe(8);
  const callsAfterAdvice = review.mock.calls.length;
  const empty = await app.inject({ method: "POST", url: "/v1/admin/candidates/auto-approve", headers, payload: { ids: [] } });
  expect(empty.statusCode).toBe(400);
  expect(review.mock.calls.length).toBe(callsAfterAdvice);
  review.mockImplementation(async (candidate) => {
    if (candidate.title === "stale") {
      await runtime.updateCandidate(candidate.id, { content: "changed during review" }, candidate.revision);
      return { action: "promote", reason: "stale revision" };
    }
    if (candidate.title === "model-failed") return { action: "promote", reason: "model down", error: true };
    if (candidate.title === "throws") throw new Error("ollama down");
    if (candidate.title === "keep-me") return { action: "keep", reason: "uncertain" };
    if (candidate.title === "archive-me") return { action: "archive", reason: "noise" };
    return { action: "promote", reason: "durable" };
  });
  const selected = ["missing-id", created["model-failed"].id, created.throws.id, created.stale.id, created["unassigned-fact"].id, created["keep-me"].id, created["archive-me"].id, created["promote-me"].id, created["promote-me"].id];
  const response = await app.inject({ method: "POST", url: "/v1/admin/candidates/auto-approve", headers, payload: { candidates: selected.map(id => ({ id, expectedRevision: 1 })) } });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({ promoted: 1, archived: 1, kept: 2, failed: 4 });
  const memories = await runtime.allMemories();
  const statusOf = (title: string) => memories.find((record) => record.id === created[title].id)?.status;
  expect(statusOf("promote-me")).toBe("active");
  expect(statusOf("archive-me")).toBe("archived");
  for (const title of ["keep-me", "model-failed", "throws", "stale", "untouched", "unassigned-fact"]) expect(statusOf(title)).toBe("candidate");
  expect(memories.find((record) => record.id === created.stale.id)?.content).toBe("changed during review");
  expect(memories.find((record) => record.id === created["unassigned-fact"].id)?.projectId).toBe("unassigned");
});

it("rejects encoded skill traversal and stale revisions through HTTP", async () => {
  const { runtime, root, workspace } = await fixture();
  vi.stubEnv("JARVIS_ADMIN_KEY", "test-fixture-only");
  const app = Fastify(); apps.push(app);
  await app.register(publicRoutes, { runtime }); await app.register(adminRoutes, { runtime, prefix: "/v1/admin" });
  await mkdir(join(root, "outside")); await writeFile(join(root, "outside", "SKILL.md"), "untouched");
  const headers = { authorization: "Bearer test-fixture-only" };
  for (const [method, url] of [["GET", "/v1/skills/..%2Foutside"], ["GET", "/v1/admin/skills/..%2Foutside/bundle"], ["DELETE", "/v1/admin/skills/..%2Foutside"]] as const) {
    expect((await app.inject({ method, url, headers })).statusCode).toBe(400);
  }
  expect(await readFile(join(root, "outside", "SKILL.md"), "utf8")).toBe("untouched");
  const { session } = await runtime.openSession({ client: "test", workspace, task: "review" });
  const c = await runtime.rememberCandidate(session.id, { scope: "project", kind: "fact", title: "review", content: "old", sourceRefs: [] });
  const edited = await app.inject({ method: "PUT", url: `/v1/admin/candidates/${c.id}`, headers, payload: { expectedRevision: 1, content: "new" } });
  expect(edited.statusCode).toBe(200); expect(edited.json().revision).toBe(2);
  const stale = await app.inject({ method: "POST", url: `/v1/admin/candidates/${c.id}/promote`, headers, payload: { expectedRevision: 1 } });
  expect(stale.statusCode).toBe(409);
  const current = await app.inject({ method: "POST", url: `/v1/admin/candidates/${c.id}/promote`, headers, payload: { expectedRevision: 2 } });
  expect(current.statusCode).toBe(200); expect(current.json()).toMatchObject({ content: "new", revision: 3, status: "active" });
});
