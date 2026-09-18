import { homedir } from "node:os";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { FileMemoryEngine, JsonlDynamicStore, MarkdownMemoryStore, PostgresDynamicStore, type DynamicStore } from "@jarvis/memory";

/** The worker only archives exact duplicates and promotes evidence-backed records. */
const intervalMs = Number(process.env.JARVIS_WORKER_INTERVAL_MS ?? 60_000);
const memoryRoot = process.env.MEMORY_ROOT?.trim() || join(process.env.JARVIS_HOME?.trim() || join(homedir(), ".jarvis"), "memory");
const settingsPath = join(resolve(memoryRoot, ".."), "settings.json");
const dynamic: DynamicStore = process.env.DATABASE_URL ? new PostgresDynamicStore(process.env.DATABASE_URL) : new JsonlDynamicStore(resolve(memoryRoot, "..", "runtime"));
await dynamic.initialize();
const engine = new FileMemoryEngine(new MarkdownMemoryStore(memoryRoot), dynamic);
let running = false;
async function consolidate() {
  if (running) return;
  running = true;
  try { let enabled = true; try { enabled = (JSON.parse(await readFile(settingsPath, "utf8")) as { autoConsolidation?: boolean }).autoConsolidation !== false; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } if (!enabled) return; const result = await engine.consolidate(); if (result.promoted || result.archived) console.log(`Jarvis consolidation: promoted=${result.promoted} archived=${result.archived}`); }
  catch (error) { console.error(`Jarvis consolidation failed: ${error instanceof Error ? error.message : String(error)}`); }
  finally { running = false; }
}
console.log(`Jarvis consolidation worker scheduled every ${intervalMs}ms`);
await consolidate();
setInterval(() => void consolidate(), intervalMs).unref();
