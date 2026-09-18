#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const home = process.env.JARVIS_HOME?.trim() || join(homedir(), ".jarvis");
const runtimeFile = join(home, "runtime", "events.jsonl");
const memoryRoot = process.env.MEMORY_ROOT?.trim() || join(home, "memory");
const projects = new Map();
try {
  const raw = await readFile(runtimeFile, "utf8");
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const item = JSON.parse(line);
    const value = item.project ?? item.session;
    if (!value?.projectId && !value?.id) continue;
    const id = value.projectId ?? value.id;
    const current = projects.get(id) ?? { id, workspaces: new Set(), sessions: 0, events: 0, experiences: 0 };
    if (value.workspace) current.workspaces.add(value.workspace);
    if (item.type === "session") current.sessions += 1;
    if (item.type === "event") current.events += 1;
    if (item.type === "experience") current.experiences += 1;
    projects.set(id, current);
  }
} catch (error) { if (error.code !== "ENOENT") throw error; }
try {
  for (const id of await readdir(join(memoryRoot, "projects"))) {
    const current = projects.get(id) ?? { id, workspaces: new Set(), sessions: 0, events: 0, experiences: 0 };
    current.memoryFiles = (await readdir(join(memoryRoot, "projects", id))).filter((file) => file.endsWith(".md")).length;
    projects.set(id, current);
  }
} catch (error) { if (error.code !== "ENOENT") throw error; }
console.log(JSON.stringify([...projects.values()].map((item) => ({ ...item, workspaces: [...item.workspaces] })), null, 2));
