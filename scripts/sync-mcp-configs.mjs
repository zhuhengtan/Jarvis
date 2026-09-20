#!/usr/bin/env node
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const home = homedir();
const sourcePath = join(root, "config", "mcp.json");
const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const stdio = {
  command: "node",
  args: [join(root, "dist", "mcp-stdio.js")],
  env: { JARVIS_API_URL: source.apiUrl },
};
const http = { url: source.mcpUrl };

const clients = {
  codex: { mode: source.clients?.codex ?? "http", path: join(home, ".codex", "config.toml") },
  cursor: { mode: source.clients?.cursor ?? "stdio", path: join(home, ".cursor", "mcp.json") },
  gemini: { mode: source.clients?.gemini ?? "stdio", path: join(home, ".gemini", "config", "mcp_config.json") },
  antigravity: { mode: source.clients?.antigravity ?? "stdio", path: join(home, ".gemini", "antigravity", "mcp_config.json") },
  "antigravity-ide": { mode: source.clients?.antigravity ?? "stdio", path: join(home, ".gemini", "antigravity-ide", "mcp_config.json") },
};

const dryRun = process.argv.includes("--dry-run");
const entryFor = (mode) => mode === "http" ? http : stdio;

function parseJsonWithTrailingCommas(text) {
  return JSON.parse(text.replace(/,\s*([}\]])/g, "$1"));
}

function writeAtomic(path, content) {
  if (dryRun) return;
  const temp = `${path}.jarvis-sync-${process.pid}`;
  writeFileSync(temp, content, "utf8");
  renameSync(temp, path);
}

function updateJson(path, mode) {
  if (!existsSync(path)) return false;
  const current = parseJsonWithTrailingCommas(readFileSync(path, "utf8"));
  const key = current.mcpServers ? "mcpServers" : current.servers ? "servers" : "mcpServers";
  current[key] ??= {};
  current[key][source.name] = key === "servers" ? { ...entryFor(mode), type: mode === "http" ? "http" : "stdio" } : entryFor(mode);
  writeAtomic(path, `${JSON.stringify(current, null, 2)}\n`);
  return true;
}

function updateCodex(path, mode) {
  if (!existsSync(path)) return false;
  const current = readFileSync(path, "utf8");
  const block = mode === "http"
    ? `[mcp_servers.${source.name}]\nenabled = true\nurl = "${source.mcpUrl}"\n`
    : `[mcp_servers.${source.name}]\nenabled = true\ncommand = "${stdio.command}"\nargs = ["${stdio.args[0]}"]\n`;
  const section = new RegExp(`\\n?\\[mcp_servers\\.${source.name}\\][\\s\\S]*?(?=\\n\\[|$)`);
  const next = section.test(current) ? current.replace(section, `\n${block}`) : `${current.trimEnd()}\n\n${block}`;
  writeAtomic(path, next.replace(/\n{3,}/g, "\n\n"));
  return true;
}

const changed = [];
for (const [client, target] of Object.entries(clients)) {
  const updated = client === "codex" ? updateCodex(target.path, target.mode) : updateJson(target.path, target.mode);
  if (updated) changed.push(`${target.path} (${target.mode})`);
}

if (changed.length === 0) {
  console.log("No existing client MCP config was found.");
} else {
  console.log(`${dryRun ? "Would update" : "Updated"} ${changed.length} client MCP config(s):`);
  for (const path of changed) console.log(`- ${path}`);
}
