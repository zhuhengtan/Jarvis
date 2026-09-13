import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { SkillEngine } from "@jarvis/core";

export class FilesystemSkillEngine implements SkillEngine {
  constructor(private readonly root: string) {}
  async search(query: string, limit = 10) { const all = await this.all(); const terms = query.toLowerCase().split(/\s+/).filter(Boolean); return all.filter((skill) => terms.some((term) => `${skill.name} ${skill.description}`.toLowerCase().includes(term))).slice(0, limit); }
  async load(name: string) { try { return await readFile(join(this.root, name, "SKILL.md"), "utf8"); } catch { return undefined; } }
  private async all() { let entries: string[]; try { entries = await readdir(this.root); } catch { return []; } return Promise.all(entries.map(async (name) => { const content = await this.load(name); return content ? { name, description: content.split("\n").find((line) => line.trim() && !line.startsWith("#"))?.trim() || "Jarvis skill" } : undefined; })).then((items) => items.filter((item): item is { name: string; description: string } => Boolean(item))); }
}
