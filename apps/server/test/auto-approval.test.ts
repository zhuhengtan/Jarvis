import { afterEach, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OllamaProvider } from "@jarvis/providers";
import type { MemoryRecord } from "@jarvis/shared";
import { JarvisRuntime } from "../src/runtime.js";
import { adminRoutes } from "../src/routes/admin.js";

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "jarvis-auto-safe-")); roots.push(root);
  const workspace = join(root, "workspace");
  await mkdir(join(workspace, ".jarvis"), { recursive: true });
  await writeFile(join(workspace, ".jarvis", "project.json"), JSON.stringify({ id: "business" }));
  const runtime = await JarvisRuntime.create({ memoryRoot: join(root, "memory"), skillsRoot: join(root, "skills") });
  const { session } = await runtime.openSession({ client: "test", workspace, task: "approval" });
  const create = async (title: string, content = `${title}: use PostgreSQL`, sessionId = session.id, sourceRefs?: string[]) => {
    const source = await runtime.recordEvent({ sessionId, type: "result", content });
    return runtime.rememberCandidate(sessionId, { scope: "project", kind: "decision", title, content, sourceRefs: sourceRefs ?? [source.id] });
  };
  return { runtime, workspace, session, create };
}
const select = (...records: MemoryRecord[]) => records.map(({ id, revision }) => ({ id, expectedRevision: revision }));

it("keeps missing, unsupported, foreign-project, and unassigned sources without consulting the model", async () => {
  const { runtime, workspace, create } = await fixture();
  const loose = await runtime.openSession({ client: "test", workspace, task: "loose", mode: "unassigned" });
  const maintenance = await runtime.openSession({ client: "test", workspace, task: "maintenance", mode: "maintenance" });
  const otherWorkspace = join(workspace, "other");
  await mkdir(join(otherWorkspace, ".jarvis"), { recursive: true });
  await writeFile(join(otherWorkspace, ".jarvis/project.json"), JSON.stringify({ id: "foreign" }));
  const other = await runtime.openSession({ client: "test", workspace: otherWorkspace, task: "foreign" });
  const foreign = await runtime.recordEvent({ sessionId: other.session.id, type: "result", content: "foreign evidence" });
  const records = await Promise.all([
    create("no-source", undefined, undefined, []),
    create("missing", undefined, undefined, ["event_missing"]),
    create("external", undefined, undefined, ["https://fixture.invalid/evidence"]),
    create("foreign", undefined, undefined, [foreign.id]),
    create("loose", undefined, loose.session.id),
    create("maintenance", undefined, maintenance.session.id),
  ]);
  const review = vi.spyOn(OllamaProvider.prototype, "reviewCandidate").mockResolvedValue({ action: "archive", reason: "should never execute" });
  expect(await runtime.autoApproveCandidates(select(...records))).toMatchObject({ promoted: 0, archived: 0, kept: 6, failed: 0 });
  expect(review).not.toHaveBeenCalled();
  expect((await runtime.allCandidates()).length).toBe(6);
});

it("supplies exact source contents and existing scoped memory for conflict decisions", async () => {
  const { runtime, session, create } = await fixture();
  const existing = await create("Storage", "Use PostgreSQL for events");
  await runtime.promoteCandidate(existing.id, 1);
  const experience = await runtime.dynamic.saveExperience({ sessionId: session.id, projectId: session.projectId, summary: "Consider SQLite for events", decisions: ["SQLite is under discussion, not approved"], failures: [], nextSteps: ["Get human approval"] });
  const candidate = await create("Alternative storage", "Use SQLite for events", session.id, [experience.id]);
  const review = vi.spyOn(OllamaProvider.prototype, "reviewCandidate").mockImplementation(async (_, context) => {
    expect(context?.sources[0]).toMatchObject({ id: experience.id, projectId: "business" });
    expect(context?.sources[0].content).toContain("not approved");
    expect(context?.memories.map(item => item.id)).toEqual([existing.id]);
    return { action: "keep", reason: "Conflicts with active decision and lacks approval" };
  });
  expect(await runtime.autoApproveCandidates(select(candidate))).toMatchObject({ kept: 1, promoted: 0 });
  expect(review).toHaveBeenCalledOnce();
  expect((await runtime.allCandidates()).map(item => item.id)).toEqual([candidate.id]);
});

it("prevents duplicate promotions within a batch and preserves same-title conflicts", async () => {
  const { runtime, create } = await fixture();
  const first = await create("Primary", "Use PostgreSQL");
  const second = await create("Different title", "  Use   PostgreSQL  ");
  const conflicting = await create("Primary", "Use SQLite");
  const review = vi.spyOn(OllamaProvider.prototype, "reviewCandidate").mockResolvedValue({ action: "promote", reason: "supported" });
  expect(await runtime.autoApproveCandidates(select(first, second, conflicting))).toMatchObject({ promoted: 1, kept: 2, failed: 0 });
  expect(review).toHaveBeenCalledOnce();
  expect((await runtime.allCandidates()).length).toBe(2);
});

it("rejects edits and reassignments made after selection but before the request", async () => {
  const { runtime, workspace, create } = await fixture();
  const edited = await create("Edit");
  const reassigned = await create("Reassign");
  const selected = select(edited, reassigned);
  await runtime.updateCandidate(edited.id, { content: "New content" }, 1);
  const otherWorkspace = join(workspace, "other");
  await mkdir(otherWorkspace);
  const other = await runtime.openSession({ client: "test", workspace: otherWorkspace, task: "other", mode: "work" });
  await runtime.reassignCandidate(reassigned.id, other.project.id, 1);
  const review = vi.spyOn(OllamaProvider.prototype, "reviewCandidate");
  expect(await runtime.autoApproveCandidates(selected)).toMatchObject({ failed: 2, promoted: 0, archived: 0 });
  expect(review).not.toHaveBeenCalled();
  expect((await runtime.allCandidates()).length).toBe(2);
});

it("rejects concurrent duplicate approvals under the store write lock", async () => {
  const { runtime, create } = await fixture();
  const first = await create("First", "Same content");
  const second = await create("Second", "Same content");
  let arrived = 0;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  vi.spyOn(OllamaProvider.prototype, "reviewCandidate").mockImplementation(async () => {
    if (++arrived === 2) release();
    await barrier;
    return { action: "promote", reason: "supported" };
  });
  const results = await Promise.all([runtime.autoApproveCandidates(select(first)), runtime.autoApproveCandidates(select(second))]);
  expect(results.reduce((total, result) => total + result.promoted, 0)).toBe(1);
  expect(results.reduce((total, result) => total + result.failed, 0)).toBe(1);
  expect((await runtime.allCandidates()).length).toBe(1);
});

it("rejects archive when its reviewed memory context changes during inference", async () => {
  const { runtime, create } = await fixture();
  const candidate = await create("Review me");
  const newMemory = await create("New decision");
  vi.spyOn(OllamaProvider.prototype, "reviewCandidate").mockImplementation(async () => {
    await runtime.promoteCandidate(newMemory.id, 1);
    return { action: "archive", reason: "old context" };
  });
  expect(await runtime.autoApproveCandidates(select(candidate))).toMatchObject({ failed: 1, archived: 0 });
  expect((await runtime.allCandidates()).map(item => item.id)).toEqual([candidate.id]);
});

it("the HTTP path requires revisions and does not execute a thinking-only verdict", async () => {
  const { runtime, create } = await fixture();
  const candidate = await create("Thinking");
  vi.stubEnv("JARVIS_ADMIN_KEY", "fixture-only");
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ response: "", thinking: '{"action":"promote","reason":"tentative"}', done: true, done_reason: "length" })));
  vi.stubGlobal("fetch", fetchMock);
  const app = Fastify();
  try {
    await app.register(adminRoutes, { runtime, prefix: "/v1/admin" });
    const headers = { authorization: "Bearer fixture-only" };
    for (const payload of [{ ids: [candidate.id] }, { candidates: [{ id: candidate.id }] }, { candidates: [{ id: candidate.id, expectedRevision: 0 }] }, { candidates: [] }]) {
      expect((await app.inject({ method: "POST", url: "/v1/admin/candidates/auto-approve", headers, payload })).statusCode).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    const response = await app.inject({ method: "POST", url: "/v1/admin/candidates/auto-approve", headers, payload: { candidates: select(candidate) } });
    expect(response.json()).toMatchObject({ promoted: 0, archived: 0, failed: 1 });
    expect((await runtime.allCandidates()).length).toBe(1);
    const prompt = JSON.parse(fetchMock.mock.calls[0][1].body).prompt;
    expect(prompt).toContain("Review context JSON:");
    expect(prompt).toContain(candidate.content);
  } finally { await app.close(); }
});
