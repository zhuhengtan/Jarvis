import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileMemoryEngine, JsonEmbeddingIndex, JsonlDynamicStore, MarkdownMemoryStore } from "../src/index.js";

function axis(text: string) {
  return /postgres|数据库|durable|persist/i.test(text) ? [1, 0] : [0, 1];
}

describe("hybrid memory search", () => {
  it("ranks a semantic match above an unrelated record when embeddings are enabled", async () => {
    const root = await mkdtemp(join(tmpdir(), "jarvis-search-"));
    const engine = new FileMemoryEngine(new MarkdownMemoryStore(root), new JsonlDynamicStore(root));
    engine.setEmbedding({
      model: "test-embed",
      index: new JsonEmbeddingIndex(join(root, "embeddings.json")),
      embed: async (texts) => texts.map(axis),
    });
    const postgres = await engine.saveCandidate({ scope: "project", projectId: "a", kind: "decision", title: "Events store", content: "Use PostgreSQL for events", sourceRefs: [] });
    const theme = await engine.saveCandidate({ scope: "project", projectId: "a", kind: "preference", title: "UI theme", content: "Prefer dark theme", sourceRefs: [] });
    await engine.promote({ record: postgres, expectedRevision: 1 });
    await engine.promote({ record: theme, expectedRevision: 1 });
    const ranked = await engine.search({ projectId: "a", query: "数据库选型", limit: 5, minScore: 0 });
    expect(ranked[0]?.record.title).toBe("Events store");
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });

  it("keeps keyword-only ranking when embeddings are disabled", async () => {
    const root = await mkdtemp(join(tmpdir(), "jarvis-keyword-"));
    const engine = new FileMemoryEngine(new MarkdownMemoryStore(root), new JsonlDynamicStore(root));
    const candidate = await engine.saveCandidate({ scope: "project", projectId: "a", kind: "decision", title: "Runtime", content: "Use PostgreSQL", sourceRefs: [] });
    await engine.promote({ record: candidate, expectedRevision: 1 });
    engine.setRetrievalConfig({ minScore: 1 });
    expect((await engine.recall({ projectId: "a", query: "PostgreSQL", limit: 5 }))[0]?.title).toBe("Runtime");
    expect(await engine.recall({ projectId: "a", query: "数据库选型", limit: 5 })).toEqual([]);
  });
});
