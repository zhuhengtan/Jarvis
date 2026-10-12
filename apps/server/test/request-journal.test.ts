import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Fastify from "fastify";
import { RequestJournal } from "../src/request-journal.js";
import { JarvisRuntime } from "../src/runtime.js";
import { publicRoutes } from "../src/routes/api.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function root() { const path = await mkdtemp(join(tmpdir(), "jarvis-receipt-")); roots.push(path); return path; }

it("reuses receipts after response loss, concurrent retries, and journal reload", async () => {
  const path = await root();
  const first = new RequestJournal(path);
  const write = vi.fn(async () => ({ id: "event-1" }));
  expect(await Promise.all(Array.from({ length: 8 }, () => first.run("event:s1", "e1", { content: "hello" }, write)))).toEqual(Array.from({ length: 8 }, () => ({ id: "event-1" })));
  expect(await new RequestJournal(path).run("event:s1", "e1", { content: "hello" }, write)).toEqual({ id: "event-1" });
  expect(write).toHaveBeenCalledOnce();
  await expect(first.run("event:s1", "e1", { content: "changed" }, write)).rejects.toThrow("different input");
});

it("does not acknowledge failed writes and allows a later retry", async () => {
  const journal = new RequestJournal(await root());
  await expect(journal.run("s1", "k1", {}, async () => { throw new Error("offline"); })).rejects.toThrow("offline");
  expect(await journal.run("s1", "k1", {}, async () => "recovered")).toBe("recovered");
});

it("deduplicates event, candidate and close HTTP retries and exposes resolvable session evidence", async () => {
  const path = await root();
  const runtime = await JarvisRuntime.create({ memoryRoot: join(path, "memory"), skillsRoot: join(path, "skills") });
  runtime.settings.provider = "none";
  let app = Fastify(); await app.register(publicRoutes, { runtime });
  const opened = await app.inject({ method: "POST", url: "/v1/sessions", payload: { client: "pulse", workspace: path, task: "Joint integration" } });
  const { session } = opened.json();
  const post = (url: string, payload: object, key: string) => app.inject({ method: "POST", url, payload, headers: { "idempotency-key": key } });
  try {
    const event = { sessionId: session.id, type: "observation", content: "以后请使用中文回答" };
    const first = await post("/v1/events", event, "pulse:event:human-1");
    expect((await post("/v1/events", event, "pulse:event:human-1")).json()).toEqual(first.json());
    const candidate = { sessionId: session.id, scope: "project", kind: "workflow", title: "联合工作流", content: "已验证的工作流", sourceRefs: [session.id] };
    const saved = await post("/v1/memory/candidates", candidate, "pulse:candidate");
    expect((await post("/v1/memory/candidates", candidate, "pulse:candidate")).json().id).toBe(saved.json().id);
    const close = { result: "success", summary: "Completed verified workflow" };
    expect((await post(`/v1/sessions/${session.id}/close`, close, "pulse:close")).statusCode).toBe(200);
    await app.close(); app = Fastify(); await app.register(publicRoutes, { runtime });
    expect((await post(`/v1/sessions/${session.id}/close`, close, "pulse:close")).statusCode).toBe(200);
    const events = await runtime.dynamic.sessionEvents(session.id);
    expect(events.filter(event => event.content.includes("以后请使用中文回答"))).toHaveLength(1);
    expect(await runtime.dynamic.listExperiences(session.projectId, 20)).toHaveLength(1);
    const evidence = await runtime.dynamic.getSourceEvidence(saved.json().sourceRefs[0]);
    expect(evidence?.projectId).toBe(session.projectId);
    expect(evidence?.content).toContain("Completed verified workflow");
  } finally { await app.close(); }
});
