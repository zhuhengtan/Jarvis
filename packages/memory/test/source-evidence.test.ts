import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { JsonlDynamicStore, PostgresDynamicStore } from "../src/index.js";

const roots: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

it("resolves old exact references with provenance and full session evidence after restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "jarvis-source-")); roots.push(root);
  const first = new JsonlDynamicStore(root); await first.initialize();
  const session = await first.createSession({ projectId: "a", workspace: "/tmp/a", client: "test", task: "Choose storage" });
  const event = await first.appendEvent({ sessionId: session.id, type: "result", content: "Use PostgreSQL" });
  const experience = await first.saveExperience({ sessionId: session.id, projectId: "a", summary: "PostgreSQL chosen", decisions: ["Use PostgreSQL"], failures: [], nextSteps: [] });
  for (let n = 0; n < 105; n++) await first.appendEvent({ sessionId: session.id, type: "observation", content: `Later observation ${n}` });
  const second = new JsonlDynamicStore(root); await second.initialize();
  expect((await second.recentEvents("a", 100)).some(item => item.id === event.id)).toBe(false);
  expect(await second.getSourceEvidence(event.id)).toMatchObject({ id: event.id, projectId: "a", content: expect.stringContaining("Use PostgreSQL") });
  expect(await second.getSourceEvidence(experience.id)).toMatchObject({ id: experience.id, projectId: "a", content: expect.stringContaining("PostgreSQL chosen") });
  const sessionSource = await second.getSourceEvidence(session.id);
  expect(sessionSource?.content).toContain("Use PostgreSQL");
  expect(sessionSource?.content).toContain("Later observation 104");
  expect(await second.getSourceEvidence("experience_missing")).toBeUndefined();
  expect(await second.getSourceEvidence("https://fixture.invalid/source")).toBeUndefined();
});

it("queries PostgreSQL sources by exact parameterized id and returns source project provenance", async () => {
  const query = vi.spyOn(Pool.prototype, "query");
  query.mockResolvedValueOnce({ rows: [{ id: "experience_old", projectId: "a", summary: "Original evidence", decisions: ["Use PostgreSQL"], failures: [], nextSteps: [] }] } as never);
  query.mockResolvedValueOnce({ rows: [{ id: "event_old", projectId: "foreign", type: "result", content: "Foreign evidence" }] } as never);
  query.mockResolvedValueOnce({ rows: [{ id: "session_old", projectId: "a", task: "Choose storage" }] } as never);
  query.mockResolvedValueOnce({ rows: [{ id: "event_old", type: "result", content: "All session evidence" }] } as never);
  query.mockResolvedValueOnce({ rows: [] } as never);
  const store = new PostgresDynamicStore("postgresql://fixture.invalid/test");
  try {
    expect(await store.getSourceEvidence("experience_old")).toMatchObject({ projectId: "a", content: expect.stringContaining("Original evidence") });
    expect(await store.getSourceEvidence("event_old")).toMatchObject({ projectId: "foreign" });
    expect(await store.getSourceEvidence("session_old")).toMatchObject({ projectId: "a", content: expect.stringContaining("All session evidence") });
    expect(await store.getSourceEvidence("event_missing")).toBeUndefined();
    expect(await store.getSourceEvidence("file:///tmp/source")).toBeUndefined();
    expect(query.mock.calls.map(call => call[1])).toEqual([["experience_old"], ["event_old"], ["session_old"], ["session_old"], ["event_missing"]]);
    expect(String(query.mock.calls[1][0])).toContain("JOIN sessions");
    for (const call of query.mock.calls) expect(String(call[0])).toContain("=$1");
  } finally { await store.close(); }
});
