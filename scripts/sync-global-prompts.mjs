#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "prompt.md");
const prompt = readFileSync(sourcePath, "utf8").trimEnd() + "\n";
const home = homedir();
const targets = [
  ["Codex", join(home, ".codex", "AGENTS.md"), prompt],
  ["Claude Code", join(home, ".claude", "CLAUDE.md"), prompt],
  ["Gemini CLI", join(home, ".gemini", "GEMINI.md"), prompt],
  ["Antigravity", join(home, ".gemini", "antigravity", "rules", "jarvis-memory.md"), prompt],
  ["Antigravity IDE", join(home, ".gemini", "antigravity-ide", "rules", "jarvis-memory.md"), prompt],
  ["VS Code prompt", join(home, "Library", "Application Support", "Code", "User", "prompts", "project_rules.md.prompt.md"), prompt],
];

const dryRun = process.argv.includes("--dry-run");
function writeAtomic(path, content) {
  if (dryRun) return;
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.jarvis-sync-${process.pid}`;
  writeFileSync(temp, content, "utf8");
  renameSync(temp, path);
}

const changed = [];
for (const [name, path, content] of targets) {
  const current = existsSync(path) ? readFileSync(path, "utf8") : undefined;
  if (current === content) continue;
  writeAtomic(path, content);
  changed.push(`${name}: ${path}`);
}

if (!changed.length) {
  console.log("Global Jarvis prompts are already synchronized.");
} else {
  console.log(`${dryRun ? "Would update" : "Updated"} ${changed.length} global prompt file(s):`);
  for (const path of changed) console.log(`- ${path}`);
}
