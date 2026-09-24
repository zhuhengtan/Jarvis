import { afterEach, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { FileMemoryEngine, JsonEmbeddingIndex, JsonlDynamicStore, MarkdownMemoryStore } from "../src/index.js";
const exec = promisify(execFile);
const roots: string[] = [];
async function fixture() { const root = await mkdtemp(join(tmpdir(), "jarvis-process-test-")); roots.push(root); return root; }
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
const child = (mode: string, root: string, id: string) => exec(process.execPath, ["--import", createRequire(import.meta.url).resolve("tsx"), fileURLToPath(new URL("./fixtures/concurrent-writer.ts", import.meta.url)), mode, root, id]);
it("merges writes from independent instances and refreshes old readers", async () => {
  const root = await fixture(); const path = join(root, "embeddings.json");
  const first = new JsonEmbeddingIndex(path); const second = new JsonEmbeddingIndex(path);
  expect(await first.get("b", "test")).toBeUndefined(); expect(await second.get("a", "test")).toBeUndefined();
  await Promise.all([first.upsert("a", "test", [1, 0]), second.upsert("b", "test", [0, 1])]);
  expect(await first.get("b", "test")).toEqual([0, 1]); expect(await second.get("a", "test")).toEqual([1, 0]);
});
it("retains all embedding writes from two OS processes", async () => {
  const root = await fixture();
  await Promise.all([child("embedding", root, "a"), child("embedding", root, "b")]);
  const data = JSON.parse(await readFile(join(root, "embeddings.json"), "utf8"));
  expect(Object.keys(data)).toHaveLength(24);
  for (const prefix of ["a", "b"]) for (let n = 0; n < 12; n++) expect(data[`${prefix}-${n}`].vector).toEqual([n, 1]);
}, 15_000);
it("only one OS process can commit the same memory revision", async () => {
  const root = await fixture(); const store = new MarkdownMemoryStore(join(root, "memory"));
  const engine = new FileMemoryEngine(store, new JsonlDynamicStore(root));
  const c = await engine.saveCandidate({ scope: "project", projectId: "p", kind: "fact", title: "fixture", content: "current", sourceRefs: [] });
  const results = await Promise.all([child("promote", root, c.id), child("promote", root, c.id)]);
  expect(results.map(result => result.stdout.trim()).sort()).toEqual(["committed", "conflict"]);
  expect(await store.get(c.id)).toMatchObject({ revision: 2, status: "active", content: "current" });
}, 15_000);

it("keeps an in-flight embedding associated with its original model", async () => {
  const root = await fixture(); const store = new MarkdownMemoryStore(join(root, "memory"));
  const engine = new FileMemoryEngine(store, new JsonlDynamicStore(root));
  const index = new JsonEmbeddingIndex(join(root, "embeddings.json"));
  let finish!: (value: number[][]) => void;
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const pending = new Promise<number[][]>(resolve => { finish = resolve; });
  engine.setEmbedding({ model: "original", index, embed: async () => { started(); return pending; } });
  const c = await engine.saveCandidate({ scope: "project", projectId: "p", kind: "fact", title: "fixture", content: "current", sourceRefs: [] });
  const promotion = engine.promote({ record: c, expectedRevision: 1 });
  await ready;
  engine.setEmbedding({ model: "replacement", index, embed: async () => [[0, 1]] });
  finish([[1, 0]]); await promotion;
  expect(await index.get(c.id, "original")).toEqual([1, 0]);
  expect(await index.get(c.id, "replacement")).toBeUndefined();
});
