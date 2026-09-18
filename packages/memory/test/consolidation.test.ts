import { describe, expect, it } from "vitest";
import { FileMemoryEngine, JsonlDynamicStore, MarkdownMemoryStore } from "../src/index.js";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

describe("background consolidation", () => {
  it("archives exact duplicates and promotes evidence-backed records", async () => {
    const root = await mkdtemp(join(tmpdir(), "jarvis-consolidate-"));
    const engine = new FileMemoryEngine(new MarkdownMemoryStore(root), new JsonlDynamicStore(join(root, "runtime")));
    const content = "背景：本条结论来自一次已记录的任务经验。\n决策：采用稳定项目标识并记录来源。\n任务总结：验证跨 IDE 绑定和回滚行为。\n适用范围：项目内长期复用。\n证据状态：来自会话经验。";
    const first = await engine.saveCandidate({ scope: "project", projectId: "a", kind: "decision", title: "稳定项目标识", content, sourceRefs: ["experience-1"] });
    const duplicate = await engine.saveCandidate({ scope: "project", projectId: "a", kind: "decision", title: "稳定项目标识", content, sourceRefs: ["experience-2"] });
    const result = await engine.consolidate();
    expect(result).toEqual({ promoted: 1, archived: 1 });
    expect((await engine.allMemories("a")).find((r) => r.id === first.id)?.status).toBe("active");
    expect((await engine.allMemories("a")).find((r) => r.id === duplicate.id)?.status).toBe("archived");
  });
});

it("moves an unassigned candidate to a reviewed project", async () => {
  const root = await mkdtemp(join(tmpdir(), "jarvis-reassign-"));
  const engine = new FileMemoryEngine(new MarkdownMemoryStore(root), new JsonlDynamicStore(join(root, "runtime")));
  const candidate = await engine.saveCandidate({ scope: "project", projectId: "unassigned", kind: "fact", title: "待归属", content: "来自无目录会话的事实", sourceRefs: ["context-1"] });
  const moved = await engine.reassignCandidate(candidate.id, "project-b");
  expect(moved?.projectId).toBe("project-b");
  expect((await engine.candidates("unassigned")).some((item) => item.id === candidate.id)).toBe(false);
  expect((await engine.candidates("project-b")).some((item) => item.id === candidate.id)).toBe(true);
});
