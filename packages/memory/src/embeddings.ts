import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface StoredEmbedding { model: string; vector: number[]; updatedAt: string; }

export function cosine(left: number[], right: number[]) {
  const n = Math.min(left.length, right.length);
  let dot = 0, leftNorm = 0, rightNorm = 0;
  for (let i = 0; i < n; i += 1) {
    dot += left[i] * right[i];
    leftNorm += left[i] * left[i];
    rightNorm += right[i] * right[i];
  }
  const denom = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  return denom ? dot / denom : 0;
}

export class JsonEmbeddingIndex {
  private cache?: Record<string, StoredEmbedding>;
  constructor(private readonly path: string) {}
  private async load() {
    if (this.cache) return this.cache;
    try { this.cache = JSON.parse(await readFile(this.path, "utf8")) as Record<string, StoredEmbedding>; } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.cache = {};
    }
    return this.cache;
  }
  private async persist() {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, `${JSON.stringify(this.cache ?? {}, null, 2)}\n`, "utf8");
  }
  async get(id: string, model: string) {
    const stored = (await this.load())[id];
    return stored?.model === model ? stored.vector : undefined;
  }
  async upsert(id: string, model: string, vector: number[]) {
    const cache = await this.load();
    cache[id] = { model, vector, updatedAt: new Date().toISOString() };
    await this.persist();
  }
  async missing(ids: string[], model: string) {
    const cache = await this.load();
    return ids.filter((id) => cache[id]?.model !== model || !cache[id]?.vector?.length);
  }
}
