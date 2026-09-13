import { readFile, readdir, writeFile, mkdir, rm, chmod } from "node:fs/promises";
import { join } from "node:path";
import type { SkillEngine } from "@jarvis/core";
import type { SkillBundle, SkillScript } from "@jarvis/shared";

function extractSkillDescription(content: string): string {
  const descMatch = content.match(/^description:\s*(.*?)$/m);
  if (descMatch && descMatch[1].trim()) return descMatch[1].trim();
  return content.split("\n").find((line) => line.trim() && !line.startsWith("#") && !line.startsWith("---") && !line.startsWith("name:"))?.trim() || "Jarvis skill";
}

export class FilesystemSkillEngine implements SkillEngine {
  constructor(private readonly root: string) {}

  async search(query: string, limit = 10) {
    const all = await this.all();
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return all.slice(0, limit);
    return all.filter((skill) => terms.some((term) => `${skill.name} ${skill.description}`.toLowerCase().includes(term))).slice(0, limit);
  }

  async load(name: string) {
    try {
      return await readFile(join(this.root, name, "SKILL.md"), "utf8");
    } catch {
      return undefined;
    }
  }

  async loadBundle(name: string): Promise<SkillBundle | undefined> {
    const content = await this.load(name);
    if (!content) return undefined;

    const scriptsDir = join(this.root, name, "scripts");
    const scripts: SkillScript[] = [];
    try {
      const files = await readdir(scriptsDir);
      for (const file of files) {
        try {
          const scriptContent = await readFile(join(scriptsDir, file), "utf8");
          scripts.push({ filename: file, content: scriptContent });
        } catch {
          // ignore unreadable files
        }
      }
    } catch {
      // scripts dir doesn't exist or is empty
    }

    const description = extractSkillDescription(content);
    return { name, description, content, scripts };
  }

  async saveBundle(bundle: SkillBundle): Promise<void> {
    const dir = join(this.root, bundle.name);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "SKILL.md"), bundle.content, "utf8");

    const scriptsDir = join(dir, "scripts");
    await mkdir(scriptsDir, { recursive: true });

    // Clean up old scripts or update
    const existingFiles = await readdir(scriptsDir).catch(() => []);
    const incomingFilenames = new Set(bundle.scripts.map((s: SkillScript) => s.filename));

    for (const oldFile of existingFiles) {
      if (!incomingFilenames.has(oldFile)) {
        await rm(join(scriptsDir, oldFile), { force: true }).catch(() => {});
      }
    }

    for (const script of bundle.scripts) {
      const filePath = join(scriptsDir, script.filename);
      await writeFile(filePath, script.content, "utf8");
      if (script.filename.endsWith(".sh") || script.content.startsWith("#!")) {
        await chmod(filePath, 0o755).catch(() => {});
      }
    }
  }

  async delete(name: string): Promise<boolean> {
    const dir = join(this.root, name);
    try {
      await rm(dir, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  private async all() {
    let entries: string[];
    try {
      entries = await readdir(this.root);
    } catch {
      return [];
    }

    return Promise.all(
      entries.map(async (name) => {
        const content = await this.load(name);
        if (!content) return undefined;
        let scriptCount = 0;
        try {
          const scriptFiles = await readdir(join(this.root, name, "scripts"));
          scriptCount = scriptFiles.length;
        } catch {
          scriptCount = 0;
        }
        return {
          name,
          description: extractSkillDescription(content),
          scriptCount,
        };
      })
    ).then((items) => items.filter((item): item is { name: string; description: string; scriptCount: number } => Boolean(item)));
  }
}

