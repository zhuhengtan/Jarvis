import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  RevisionConflictError,
  atomicWriteFile,
  profileItemSchema,
  withFileLock,
  type ProfileItem,
} from "@jarvis/shared";

export class ProfileStore {
  private items: ProfileItem[] = [];
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly path: string) {}

  async initialize(): Promise<void> {
    await this.exclusive(async () => undefined);
  }

  /** Called under the file lock, including repairs of invalid on-disk data. */
  private async reloadUnlocked(): Promise<void> {
    try {
      const content = await readFile(this.path, "utf8");
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        await this.quarantine();
        await this.persistUnlocked([]);
        return;
      }
      if (!Array.isArray(parsed)) {
        await this.quarantine();
        await this.persistUnlocked([]);
        return;
      }
      const items: ProfileItem[] = [];
      let dropped = 0;
      for (const item of parsed) {
        const result = profileItemSchema.safeParse(item);
        if (result.success) items.push(result.data);
        else dropped += 1;
      }
      if (dropped > 0) await this.quarantine();
      this.items = items;
      if (dropped > 0) await this.persistUnlocked(items);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.items = [];
    }
  }

  private async quarantine(): Promise<void> {
    await copyFile(this.path, `${this.path}.invalid-${Date.now()}`);
  }

  private async exclusive<T>(work: () => Promise<T>): Promise<T> {
    const run = this.tail.then(() => withFileLock(dirname(this.path), "profile.lock", async () => {
      await this.reloadUnlocked();
      return work();
    }));
    this.tail = run.then(() => undefined, () => undefined);
    return run;
  }

  private copy(items: ProfileItem[]): ProfileItem[] {
    return items.map((item) => ({ ...item, evidence: item.evidence.map((entry) => ({ ...entry })) }));
  }

  private async persistUnlocked(nextItems: ProfileItem[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await atomicWriteFile(this.path, `${JSON.stringify(nextItems, null, 2)}\n`);
    this.items = this.copy(nextItems);
  }

  async list(): Promise<ProfileItem[]> {
    return this.exclusive(async () => this.copy(this.items));
  }

  async get(id: string): Promise<ProfileItem | undefined> {
    return this.exclusive(async () => this.copy(this.items).find((item) => item.id === id));
  }

  async saveAll(nextItems: ProfileItem[]): Promise<void> {
    await this.exclusive(async () => {
      await this.persistUnlocked(nextItems);
    });
  }

  async mutate(transform: (items: ProfileItem[]) => ProfileItem[]): Promise<ProfileItem[]> {
    return this.exclusive(async () => {
      const current = this.copy(this.items);
      const next = transform(current);
      if (JSON.stringify(next) !== JSON.stringify(this.items)) await this.persistUnlocked(next);
      return this.copy(this.items);
    });
  }

  async update(
    id: string,
    updates: Partial<Pick<ProfileItem, "statement" | "category" | "status" | "inject">>,
    expectedRevision: number
  ): Promise<ProfileItem> {
    return this.exclusive(async () => {
      const index = this.items.findIndex((item) => item.id === id);
      if (index === -1) throw new Error(`Profile item with id "${id}" not found`);
      const current = this.items[index];
      if (current.revision !== expectedRevision) {
        throw new RevisionConflictError(`Profile revision conflict: expected ${expectedRevision}, got ${current.revision}`);
      }
      const updated: ProfileItem = {
        ...current,
        ...(updates.statement !== undefined ? { statement: updates.statement.trim() } : {}),
        ...(updates.category !== undefined ? { category: updates.category } : {}),
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.inject !== undefined ? { inject: updates.inject } : {}),
        updatedAt: new Date().toISOString(),
        revision: current.revision + 1,
      };
      const next = this.items.slice();
      next[index] = updated;
      await this.persistUnlocked(next);
      return { ...updated, evidence: updated.evidence.map((entry) => ({ ...entry })) };
    });
  }

  async delete(id: string): Promise<void> {
    await this.exclusive(async () => {
      const next = this.items.filter((item) => item.id !== id);
      if (next.length === this.items.length) return;
      await this.persistUnlocked(next);
    });
  }
}
