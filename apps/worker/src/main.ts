import { homedir } from "node:os";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { FileMemoryEngine, JsonEmbeddingIndex, JsonlDynamicStore, MarkdownMemoryStore, PostgresDynamicStore, type DynamicStore } from "@jarvis/memory";
import { OllamaProvider } from "@jarvis/providers";

/** The worker archives exact duplicates and backfills embeddings; promotion requires explicit review. */
const intervalMs = Number(process.env.JARVIS_WORKER_INTERVAL_MS ?? 60_000);
const memoryRoot = process.env.MEMORY_ROOT?.trim() || join(process.env.JARVIS_HOME?.trim() || join(homedir(), ".jarvis"), "memory");
const settingsPath = join(resolve(memoryRoot, ".."), "settings.json");
const dynamic: DynamicStore = process.env.DATABASE_URL ? new PostgresDynamicStore(process.env.DATABASE_URL) : new JsonlDynamicStore(resolve(memoryRoot, "..", "runtime"));
await dynamic.initialize();
const engine = new FileMemoryEngine(new MarkdownMemoryStore(memoryRoot), dynamic);

async function loadSettings() {
  try { return JSON.parse(await readFile(settingsPath, "utf8")) as { embeddingProvider?: string; embeddingBaseUrl?: string; embeddingModel?: string; autoConsolidation?: boolean }; } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return {};
  }
}

function applyEmbedding(settings: { embeddingProvider?: string; embeddingBaseUrl?: string; embeddingModel?: string }) {
  if (settings.embeddingProvider === "ollama") {
    const embedder = new OllamaProvider(settings.embeddingBaseUrl || "http://127.0.0.1:11434", settings.embeddingModel || "nomic-embed-text");
    engine.setEmbedding({
      model: settings.embeddingModel || "nomic-embed-text",
      index: new JsonEmbeddingIndex(join(resolve(memoryRoot, ".."), "runtime", "embeddings.json")),
      embed: (texts) => embedder.embed(texts),
    });
  } else {
    engine.setEmbedding(undefined);
  }
}

let running = false;
async function consolidate() {
  if (running) return;
  running = true;
  try {
    const settings = await loadSettings();
    if (settings.autoConsolidation === false) return;
    applyEmbedding(settings);
    const result = await engine.consolidate();
    const embedded = await engine.backfillEmbeddings(64);
    if (result.promoted || result.archived || embedded) console.log(`Jarvis consolidation: promoted=${result.promoted} archived=${result.archived} embedded=${embedded}`);
  } catch (error) { console.error(`Jarvis consolidation failed: ${error instanceof Error ? error.message : String(error)}`); }
  finally { running = false; }
}
console.log(`Jarvis consolidation worker scheduled every ${intervalMs}ms`);
await consolidate();
// Keep the worker process alive so the production supervisor does not treat a
// successful first consolidation as a service shutdown.
setInterval(() => void consolidate(), intervalMs);
