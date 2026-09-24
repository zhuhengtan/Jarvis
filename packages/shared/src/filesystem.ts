import { randomUUID } from "node:crypto";
import { lstat, mkdir, realpath, rename, rmdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export class InvalidPathError extends Error { readonly statusCode = 400; }
export class RevisionConflictError extends Error { readonly statusCode = 409; }

export function assertSafeId(value: string): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(value)) {
    throw new InvalidPathError("Invalid storage identifier");
  }
  return value;
}

/** The configured root is trusted; symlinks below it are never followed. */
export async function confinedPath(root: string, ...parts: string[]): Promise<string> {
  for (const part of parts) assertSafeId(part);
  let current = resolve(root);
  for (const part of parts) {
    current = join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new InvalidPathError("Symlinks below the storage root are not allowed");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return current;
}

/** Atomic visibility for readers; unique temporary files also isolate concurrent writers. */
export async function atomicWriteFile(path: string, content: string): Promise<void> {
  const temporary = join(dirname(path), `jarvis-tmp-${randomUUID()}`);
  try {
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
  }
}

/** Cross-process exclusion. Never steal a timed-out lock from a possibly live writer. */
export async function withFileLock<T>(directory: string, name: string, work: () => Promise<T>): Promise<T> {
  await mkdir(directory, { recursive: true });
  const canonical = await realpath(directory);
  const lock = await confinedPath(canonical, name);
  const deadline = Date.now() + 10_000;
  while (true) {
    try { await mkdir(lock); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (Date.now() >= deadline) throw new RevisionConflictError(`Storage is locked: ${lock}. Retry; after a crashed writer, stop all writers before removing the lock directory.`);
      await delay(10 + Math.floor(Math.random() * 20));
    }
  }
  try { return await work(); }
  finally { await rmdir(lock); }
}
