import { readFile } from "node:fs/promises";

/** Minimal dotenv reader: configuration remains explicit and no secret is written back to disk. */
export async function loadLocalEnv(path = ".env") {
  try {
    const raw = await readFile(path, "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || match[2].startsWith("#") || process.env[match[1]] !== undefined) continue;
      const value = match[2].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2"); process.env[match[1]] = value;
    }
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}
