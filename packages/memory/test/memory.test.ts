import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileMemoryEngine, JsonlDynamicStore, MarkdownMemoryStore } from "../src/index.js";

describe("memory isolation", () => it("does not retrieve another project's record", async () => {
  const root = await mkdtemp(join(tmpdir(), "jarvis-memory-")); const engine = new FileMemoryEngine(new MarkdownMemoryStore(root), new JsonlDynamicStore(root));
  const candidate = await engine.saveCandidate({ scope: "project", projectId: "a", kind: "decision", title: "Runtime", content: "Use PostgreSQL", sourceRefs: [] });
  await engine.promote({ record: candidate, expectedRevision: 1 });
  expect(await engine.recall({ projectId: "b", query: "PostgreSQL", limit: 5 })).toEqual([]);
  expect((await engine.recall({ projectId: "a", query: "PostgreSQL", limit: 5 }))[0]?.title).toBe("Runtime");
}));

it("recovers sessions, goals, and events after a local-runtime restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "jarvis-dynamic-")); const first = new JsonlDynamicStore(root); await first.initialize();
  const session = await first.createSession({ projectId: "project-a", workspace: "/tmp/a", client: "codex", task: "persist state" });
  await first.appendEvent({ sessionId: session.id, type: "result", content: "Finished the durable path" });
  await first.saveGoal({ projectId: "project-a", title: "Restore state", status: "active" });
  const second = new JsonlDynamicStore(root); await second.initialize();
  expect((await second.getSession(session.id))?.workspace).toBe("/tmp/a");
  expect((await second.recentEvents("project-a", 5))[0]?.content).toBe("Finished the durable path");
  expect((await second.activeGoal("project-a"))?.title).toBe("Restore state");
});
