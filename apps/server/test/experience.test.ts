import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JarvisRuntime } from "../src/runtime.js";

describe("recordExperience flywheel", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("creates a summary candidate when Ollama is unavailable", async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error("offline"); }) as typeof fetch;
    const tmp = await mkdtemp(join(tmpdir(), "jarvis-experience-"));
    const runtime = await JarvisRuntime.create({ assistantName: "TestJarvis", memoryRoot: join(tmp, "memory"), skillsRoot: join(tmp, "skills") });
    const opened = await runtime.openSession({ client: "test", workspace: tmp, task: "close with summary only" });
    const result = await runtime.recordExperience({ sessionId: opened.session.id, summary: "完成了父目录工作区身份修复" });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].title).toContain("完成了父目录工作区身份修复");
    await rm(tmp, { recursive: true, force: true });
  });

  it("merges Ollama extracted facts with explicit decisions", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/api/generate")) {
        return new Response(JSON.stringify({ response: JSON.stringify([{ kind: "workflow", title: "先开 session", content: "非平凡任务先打开 Jarvis session" }]) }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;
    const tmp = await mkdtemp(join(tmpdir(), "jarvis-extract-"));
    const runtime = await JarvisRuntime.create({ assistantName: "TestJarvis", memoryRoot: join(tmp, "memory"), skillsRoot: join(tmp, "skills") });
    const opened = await runtime.openSession({ client: "test", workspace: tmp, task: "extract" });
    const result = await runtime.recordExperience({ sessionId: opened.session.id, summary: "关闭会话", decisions: ["保留人工审核"] });
    expect(result.candidates.map((item) => item.title)).toEqual(expect.arrayContaining(["保留人工审核", "先开 session"]));
    await rm(tmp, { recursive: true, force: true });
  });
});
