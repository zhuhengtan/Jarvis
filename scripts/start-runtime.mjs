#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const entries = [
  join(root, "dist/server.js"),
  join(root, "dist/mcp-http.js"),
  join(root, "dist/worker.js"),
];

for (const entry of entries) {
  if (!existsSync(entry)) {
    console.error(`Missing ${entry}. Run pnpm build first.`);
    process.exit(1);
  }
}

const envFile = join(root, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[2].startsWith("#") || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
  }
}

const children = entries.map((entry) => spawn(process.execPath, [entry], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
}));

let exiting = false;
function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(code);
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (exiting) return;
    if (signal) shutdown(1);
    else shutdown(code ?? 1);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
