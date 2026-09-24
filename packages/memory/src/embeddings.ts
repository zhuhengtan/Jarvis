import { readFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { atomicWriteFile, confinedPath, withFileLock } from "@jarvis/shared";

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
  constructor(private readonly path: string) {}
  private async load(): Promise<Record<string, StoredEmbedding>> {
    const path = await confinedPath(dirname(this.path), basename(this.path));
    try { return JSON.parse(await readFile(path, "utf8")) as Record<string, StoredEmbedding>; } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return Object.create(null) as Record<string, StoredEmbedding>;
    }
  }
  async get(id: string, model: string) {
    const stored = (await this.load())[id];
    return stored?.model === model ? stored.vector : undefined;
  }
  async getMany(ids: string[], model: string): Promise<Map<string, number[]>> {
    const current = await this.load();
    return new Map(ids.flatMap(id => current[id]?.model === model ? [[id, current[id].vector] as const] : []));
  }
  async upsert(id: string, model: string, vector: number[]) {
    await this.upsertMany([{ id, model, vector }]);
  }
  async upsertMany(entries: Array<{ id: string; model: string; vector: number[] }>) {
    await withFileLock(dirname(this.path), `${basename(this.path)}-lock`, async () => {
      const current = await this.load();
      for (const { id, model, vector } of entries) {
        Object.defineProperty(current, id, { value: { model, vector, updatedAt: new Date().toISOString() }, enumerable: true, configurable: true, writable: true });
      }
      await atomicWriteFile(await confinedPath(dirname(this.path), basename(this.path)), `${JSON.stringify(current, null, 2)}\n`);
    });
  }
  async missing(ids: string[], model: string) {
    const cache = await this.load();
    return ids.filter((id) => cache[id]?.model !== model || !cache[id]?.vector?.length);
  }
}
