import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { atomicWriteFile, RevisionConflictError, withFileLock } from "@jarvis/shared";

/** Retain write receipts so a lost HTTP response can be retried without replaying the write. */
export class RequestJournal {
  constructor(private readonly root: string) {}

  async run<T>(scope: string, key: string | undefined, input: unknown, work: () => Promise<T>): Promise<T> {
    if (!key) return work();
    const id = createHash("sha256").update(`${scope}\0${key}`).digest("hex");
    const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    return withFileLock(this.root, `${id}.lock`, async () => {
      const path = join(this.root, `${id}.json`);
      try {
        const receipt = JSON.parse(await readFile(path, "utf8")) as { fingerprint: string; result: T };
        if (receipt.fingerprint !== fingerprint) throw new RevisionConflictError("Idempotency key reused with different input");
        return receipt.result;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const result = await work();
      await atomicWriteFile(path, JSON.stringify({ fingerprint, result }));
      return result;
    });
  }
}
