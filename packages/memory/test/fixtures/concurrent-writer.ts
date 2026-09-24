import { join } from "node:path";
import { FileMemoryEngine, JsonEmbeddingIndex, JsonlDynamicStore, MarkdownMemoryStore } from "../../src/index.js";
const [mode, root, id] = process.argv.slice(2);
if (mode === "embedding") {
  const index = new JsonEmbeddingIndex(join(root, "embeddings.json"));
  await Promise.all(Array.from({ length: 12 }, (_, n) => index.upsert(`${id}-${n}`, "test", [n, 1])));
} else {
  const store = new MarkdownMemoryStore(join(root, "memory"));
  const engine = new FileMemoryEngine(store, new JsonlDynamicStore(root));
  const record = await store.get(id);
  if (!record) throw new Error("Missing fixture");
  try { await engine.promote({ record, expectedRevision: 1 }); console.log("committed"); }
  catch (error) { if ((error as { statusCode?: number }).statusCode !== 409) throw error; console.log("conflict"); }
}
