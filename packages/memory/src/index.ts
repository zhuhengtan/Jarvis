import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, realpath, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Pool } from "pg";
import type { MemoryEngine } from "@jarvis/core";
import { assertSafeId, confinedPath, atomicWriteFile, withFileLock, InvalidPathError, RevisionConflictError, newId, now, redactSecrets, type Event, type Experience, type Goal, type MemoryRecord, type MemorySourceEvidence, type MemoryScope, type MemoryStatus, type ProjectIdentity, type Session } from "@jarvis/shared";
import { cosine, JsonEmbeddingIndex } from "./embeddings.js";

const exec = promisify(execFile);
const digest = (input: string) => createHash("sha256").update(input).digest("hex").slice(0, 20);

export interface ProjectMetadata {
  id?: string;
  name?: string;
  description?: string;
  keywords?: string[];
  workspaces?: string[];
}

export interface ContainedProject {
  path: string;
  name: string;
  gitRemote?: string;
  id?: string;
  isGit?: boolean;
}

export interface ProjectResolution {
  project: ProjectIdentity;
  identityWarning?: string;
  containedProjects?: ContainedProject[];
}

export class ProjectResolver {
  private normalizeRemote(remote?: string) {
    if (!remote) return undefined;
    return remote.trim().replace(/^git@([^:]+):/, "https://$1/").replace(/\.git$/, "").replace(/\/$/, "").toLowerCase();
  }
  private async canonicalPath(workspace: string): Promise<string> {
    if (!isAbsolute(workspace)) throw new InvalidPathError("Workspace must be absolute");
    try { return await realpath(workspace); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return join(await this.canonicalPath(dirname(workspace)), basename(workspace));
    }
  }
  private async metadataAt(dir: string): Promise<ProjectMetadata> {
    try {
      const metadata = JSON.parse(await readFile(join(dir, ".jarvis", "project.json"), "utf8")) as ProjectMetadata;
      if (metadata.id !== undefined) assertSafeId(metadata.id);
      if (["maintenance", "unassigned"].includes(metadata.id ?? "")) throw new InvalidPathError("Reserved project ID");
      return metadata;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; return {}; }
  }
  private async metadataFor(canonical: string, boundary?: string): Promise<ProjectMetadata> {
    let current = canonical;
    while (true) {
      const metadata = await this.metadataAt(current);
      if (metadata.id || metadata.name || metadata.keywords || metadata.workspaces || metadata.description) return metadata;
      const parent = dirname(current); if (parent === current || current === boundary) return {};
      current = parent;
    }
  }
  private async gitRemote(dir: string): Promise<string | undefined> {
    try { return (await exec("git", ["-C", dir, "config", "--get", "remote.origin.url"])).stdout.trim() || undefined; } catch { return undefined; }
  }
  private async gitToplevel(dir: string): Promise<string | undefined> {
    // Missing workspace descendants must still respect their containing repo boundary.
    try { await realpath(dir); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && dirname(dir) !== dir) return this.gitToplevel(dirname(dir));
      throw error;
    }
    try { return (await exec("git", ["-C", dir, "rev-parse", "--show-toplevel"])).stdout.trim() || undefined; } catch { return undefined; }
  }
  private async samePath(left: string, right: string) {
    try { return (await realpath(left)) === (await realpath(right)); } catch { return resolve(left) === resolve(right); }
  }
  private identityFrom(workspace: string, metadata: ProjectMetadata, gitRemote?: string, extraWorkspaces: string[] = [], identityRoot = workspace): ProjectIdentity {
    const normalizedRemote = this.normalizeRemote(gitRemote);
    const workspaces = [...new Set([...(metadata.workspaces ?? []), workspace, ...extraWorkspaces])];
    return {
      id: metadata.id?.trim() || `project_${digest(normalizedRemote || identityRoot)}`,
      workspace,
      gitRemote: normalizedRemote,
      name: metadata.name?.trim() || basename(workspace) || "workspace",
      description: metadata.description,
      keywords: metadata.keywords,
      workspaces: workspaces.length ? workspaces : undefined,
    };
  }
  private async discoverNested(canonical: string): Promise<ContainedProject[]> {
    let entries: Array<{ name: string; isDirectory(): boolean }>;
    try { entries = await readdir(canonical, { withFileTypes: true }); } catch { return []; }
    const nested: ContainedProject[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const path = join(canonical, entry.name);
      const metadata = await this.metadataAt(path);
      const toplevel = await this.gitToplevel(path);
      const ownRepo = Boolean(toplevel && await this.samePath(toplevel, path));
      const gitRemote = ownRepo ? this.normalizeRemote(await this.gitRemote(path)) : undefined;
      if (!metadata.id && !ownRepo) continue;
      nested.push({ path, name: metadata.name?.trim() || entry.name, gitRemote, id: metadata.id?.trim(), isGit: ownRepo });
    }
    return nested;
  }
  private bindNested(canonical: string, chosen: ContainedProject, metadata: ProjectMetadata): ProjectResolution {
    return { project: this.identityFrom(canonical, metadata, chosen.gitRemote, [chosen.path], chosen.path) };
  }
  async resolve(workspace: string): Promise<ProjectResolution> {
    const canonical = await this.canonicalPath(workspace);
    const toplevel = await this.gitToplevel(canonical);
    const boundary = toplevel ? await this.canonicalPath(toplevel) : undefined;
    const metadata = await this.metadataFor(canonical, boundary);
    const gitRemote = await this.gitRemote(boundary ?? canonical);
    if (metadata.id?.trim() || gitRemote || boundary) return { project: this.identityFrom(canonical, metadata, gitRemote, boundary ? [boundary] : [], boundary) };

    const nested = await this.discoverNested(canonical);
    const withMeta = nested.filter((item) => item.id);
    if (withMeta.length === 1) return this.bindNested(canonical, withMeta[0], await this.metadataAt(withMeta[0].path));
    const sameName = nested.filter((item) => basename(item.path) === basename(canonical) && item.isGit);
    if (sameName.length === 1) return this.bindNested(canonical, sameName[0], await this.metadataAt(sameName[0].path));
    const withGit = nested.filter((item) => item.isGit);
    if (withGit.length === 1) return this.bindNested(canonical, withGit[0], await this.metadataAt(withGit[0].path));

    const project = this.identityFrom(canonical, metadata);
    if (nested.length > 1) {
      return {
        project,
        identityWarning: "当前工作区包含多个嵌套项目，无法唯一归属。已按文件夹路径生成临时项目身份。请打开具体仓库，或在目标仓库写入 .jarvis/project.json。",
        containedProjects: nested,
      };
    }
    return { project };
  }

  async register(workspace: string, name?: string, details?: { description?: string; keywords?: string[] }): Promise<ProjectIdentity> {
    const canonical = await this.canonicalPath(workspace);
    await mkdir(canonical, { recursive: true });
    const gitRemote = await this.gitRemote(canonical);
    const jarvisDir = join(canonical, ".jarvis");
    await mkdir(jarvisDir, { recursive: true });
    const metadata = await this.metadataAt(canonical);
    const normalizedRemote = this.normalizeRemote(gitRemote);
    const id = metadata.id?.trim() || (await this.resolve(canonical)).project.id;
    const projectName = name?.trim() || metadata.name?.trim() || basename(canonical) || "workspace";
    const description = details?.description?.trim() || metadata.description;
    const keywords = details?.keywords?.map((item) => item.trim()).filter(Boolean) || metadata.keywords || [];
    const workspaces = [...new Set([...(metadata.workspaces ?? []), canonical])];
    await writeFile(join(jarvisDir, "project.json"), JSON.stringify({ id, name: projectName, description, keywords, workspaces }, null, 2), "utf8");
    return { id, workspace: canonical, gitRemote: normalizedRemote, name: projectName, description, keywords, workspaces };
  }
}

export class MarkdownMemoryStore {
  constructor(private readonly root: string) {}
  private async path(record: MemoryRecord) {
    assertSafeId(record.id);
    if (record.scope === "global") return confinedPath(this.root, "global", `${record.id}.md`);
    if (record.scope !== "project" || !record.projectId) throw new InvalidPathError("Project memory requires a safe project ID");
    assertSafeId(record.projectId);
    return confinedPath(this.root, "projects", record.projectId, `${record.id}.md`);
  }
  private async write(record: MemoryRecord): Promise<void> {
    const path = await this.path(record);
    if (!record.title.trim() || /[\r\n]/.test(record.title)) throw new InvalidPathError("Memory title must be a single nonempty line");
    await mkdir(dirname(path), { recursive: true });
    const metadata = { id: record.id, revision: record.revision, scope: record.scope, project_id: record.projectId ?? null, kind: record.kind, status: record.status, source_refs: record.sourceRefs, summary: record.summary ?? null, applicability: record.applicability ?? [], verification: record.verification ?? null, created_at: record.createdAt, updated_at: record.updatedAt };
    await atomicWriteFile(path, `---\n${Object.entries(metadata).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n")}\n---\n\n# ${record.title}\n\n${record.content}\n`);
  }
  /** New candidates only. Existing records must go through revision-checked mutate. */
  async save(record: MemoryRecord): Promise<void> {
    await this.path(record);
    await withFileLock(this.root, "memory-write-lock", async () => {
      if (record.status !== "candidate" || record.revision !== 1 || await this.get(record.id)) throw new RevisionConflictError("Memory already exists or is not a new candidate");
      await this.write(record);
    });
  }
  async mutate(id: string, expectedRevision: number | undefined, change: (record: MemoryRecord) => MemoryRecord | Promise<MemoryRecord>): Promise<MemoryRecord> {
    assertSafeId(id);
    return withFileLock(this.root, "memory-write-lock", async () => {
      const current = await this.get(id);
      if (!current) throw new RevisionConflictError("Memory no longer exists");
      if (expectedRevision !== undefined && current.revision !== expectedRevision) throw new RevisionConflictError("Memory revision conflict; reload before retrying");
      const next = { ...await change(current), id: current.id, revision: current.revision + 1, updatedAt: now() };
      const previousPath = await this.path(current);
      const nextPath = await this.path(next);
      await this.write(next);
      if (previousPath !== nextPath) await unlink(previousPath);
      return next;
    });
  }
  async list(scope: MemoryScope, projectId?: string): Promise<MemoryRecord[]> {
    if (projectId !== undefined) assertSafeId(projectId);
    const folder = scope === "global" ? await confinedPath(this.root, "global") : await confinedPath(this.root, "projects", ...(projectId ? [projectId] : []));
    let files: string[];
    try { files = (await readdir(folder, { withFileTypes: true })).filter((file) => file.isFile() && file.name.endsWith(".md")).map(file => file.name); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
    const parsed = await Promise.all(files.map(async (file) => this.parse(await confinedPath(folder, file))));
    return parsed.filter((item): item is MemoryRecord => Boolean(item));
  }
  async listAll(status?: MemoryStatus): Promise<MemoryRecord[]> {
    const globalRecords = await this.list("global");
    const projectsDir = await confinedPath(this.root, "projects");
    let projectDirs: string[] = [];
    try { projectDirs = (await readdir(projectsDir, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const projectRecords = (await Promise.all(projectDirs.map(dir => this.list("project", dir)))).flat();
    const all = [...globalRecords, ...projectRecords];
    return status ? all.filter(item => item.status === status) : all;
  }
  async get(id: string): Promise<MemoryRecord | undefined> {
    assertSafeId(id);
    const matches = (await this.listAll()).filter(item => item.id === id);
    if (matches.length > 1) throw new RevisionConflictError("Duplicate memory ID; resolve storage conflict before writing");
    return matches[0];
  }
  async archive(id: string, expectedRevision?: number): Promise<MemoryRecord> {
    return this.mutate(id, expectedRevision, record => ({ ...record, status: "archived" }));
  }
  async reassign(id: string, projectId: string, expectedRevision?: number): Promise<MemoryRecord> {
    assertSafeId(projectId);
    return this.mutate(id, expectedRevision, record => {
      if (record.scope !== "project" || record.status !== "candidate") throw new RevisionConflictError("Only candidate project memories can be reassigned");
      return { ...record, projectId, applicability: [...(record.applicability ?? []).filter(item => !item.startsWith("project:")), `project:${projectId}`] };
    });
  }
  private async parse(path: string): Promise<MemoryRecord | undefined> {
    let raw: string;
    try { raw = await readFile(path, "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
    const match = raw.match(/^---\n([\s\S]*?)\n---\n\n# (.*?)\n\n([\s\S]*?)\n?$/);
    if (!match) return undefined;
    const attributes = Object.fromEntries(match[1].split("\n").map(line => { const index = line.indexOf(": "); return [line.slice(0, index), JSON.parse(line.slice(index + 2))]; }));
    const record: MemoryRecord = { id: attributes.id, revision: attributes.revision, scope: attributes.scope, projectId: attributes.project_id ?? undefined, kind: attributes.kind, status: attributes.status, sourceRefs: attributes.source_refs ?? [], summary: attributes.summary ?? undefined, applicability: attributes.applicability ?? [], verification: attributes.verification ?? undefined, createdAt: attributes.created_at, updatedAt: attributes.updated_at, title: match[2], content: match[3] };
    if (await this.path(record) !== resolve(path)) throw new InvalidPathError("Memory metadata does not match its storage path");
    return record;
  }
}

export interface DynamicStore {
  initialize(): Promise<void>;
  createSession(input: Omit<Session, "id" | "createdAt" | "updatedAt" | "status">): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  getSourceEvidence(id: string): Promise<MemorySourceEvidence | undefined>;
  listSessions(query?: { projectId?: string; status?: "active" | "closed"; limit?: number }): Promise<Session[]>;
  closeSession(id: string): Promise<void>;
  appendEvent(input: Omit<Event, "id" | "occurredAt">): Promise<Event>;
  recentEvents(projectId: string, limit: number): Promise<Event[]>;
  sessionEvents(sessionId: string): Promise<Event[]>;
  saveGoal(input: Omit<Goal, "id" | "updatedAt">): Promise<Goal>;
  activeGoal(projectId: string): Promise<Goal | undefined>;
  listGoals(projectId: string): Promise<Goal[]>;
  saveExperience(input: Omit<Experience, "id" | "createdAt">): Promise<Experience>;
  listExperiences(projectId: string, limit: number): Promise<Experience[]>;
  saveProject(project: ProjectIdentity): Promise<void>;
  deleteProject(id: string): Promise<void>;
  listProjects(): Promise<ProjectIdentity[]>;
}

export class JsonlDynamicStore implements DynamicStore {
  private readonly sessions = new Map<string, Session>(); private readonly events: Array<Event & { projectId: string }> = []; private readonly goals = new Map<string, Goal>(); private readonly experiences: Experience[] = []; private readonly projects = new Map<string, ProjectIdentity>();
  constructor(private readonly root: string) {}
  async initialize() { try { const raw = await readFile(join(this.root, "events.jsonl"), "utf8"); for (const line of raw.split("\n")) { if (!line.trim()) continue; const item = JSON.parse(line); if (item.type === "session") this.sessions.set(item.session.id, item.session); if (item.type === "event") this.events.push(item.event); if (item.type === "goal") this.goals.set(item.goal.id, item.goal); if (item.type === "experience") this.experiences.push(item.experience); if (item.type === "project") this.projects.set(item.project.id, item.project); } } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } }
  async createSession(input: Omit<Session, "id" | "createdAt" | "updatedAt" | "status">): Promise<Session> { const session = { ...input, id: newId("session"), status: "active" as const, createdAt: now(), updatedAt: now() }; this.sessions.set(session.id, session); await this.persist({ type: "session", session }); return session; }
  async getSession(id: string) { return this.sessions.get(id); }
  async getSourceEvidence(id: string): Promise<MemorySourceEvidence | undefined> {
    const experience = this.experiences.find(item => item.id === id);
    if (experience) return { id, projectId: experience.projectId, content: redactSecrets(JSON.stringify(experience)) };
    const event = this.events.find(item => item.id === id);
    if (event) return { id, projectId: event.projectId, content: redactSecrets(JSON.stringify(event)) };
    const session = this.sessions.get(id);
    if (session) return { id, projectId: session.projectId, content: redactSecrets(JSON.stringify({ session, events: this.events.filter(item => item.sessionId === id) })) };
    return undefined;
  }
  async listSessions(query?: { projectId?: string; status?: "active" | "closed"; limit?: number }) {
    let result = [...this.sessions.values()];
    if (query?.projectId) result = result.filter((s) => s.projectId === query.projectId);
    if (query?.status) result = result.filter((s) => s.status === query.status);
    result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return result.slice(0, query?.limit ?? 50);
  }
  async closeSession(id: string) { const session = this.sessions.get(id); if (!session) return; session.status = "closed"; session.updatedAt = now(); await this.persist({ type: "session", session }); }
  async appendEvent(input: Omit<Event, "id" | "occurredAt">) { const session = this.sessions.get(input.sessionId); if (!session) throw new Error("Unknown session"); const event = { ...input, id: newId("event"), occurredAt: now(), content: redactSecrets(input.content), projectId: session.projectId }; this.events.push(event); await this.persist({ type: "event", event }); return event; }
  async recentEvents(projectId: string, limit: number) { return this.events.filter((event) => event.projectId === projectId).slice(-limit).reverse().map(({ projectId: _, ...event }) => event); }
  async sessionEvents(sessionId: string) { return this.events.filter((event) => event.sessionId === sessionId).map(({ projectId: _, ...event }) => event); }
  async saveGoal(input: Omit<Goal, "id" | "updatedAt">) { const goal = { ...input, id: newId("goal"), updatedAt: now() }; if (goal.status === "active") for (const existing of this.goals.values()) if (existing.projectId === goal.projectId && existing.status === "active") { existing.status = "completed"; existing.updatedAt = now(); await this.persist({ type: "goal", goal: existing }); } this.goals.set(goal.id, goal); await this.persist({ type: "goal", goal }); return goal; }
  async activeGoal(projectId: string) { return [...this.goals.values()].filter((goal) => goal.projectId === projectId && goal.status === "active").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]; }
  async listGoals(projectId: string) { return [...this.goals.values()].filter((goal) => goal.projectId === projectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  async saveExperience(input: Omit<Experience, "id" | "createdAt">) { const experience = { ...input, id: newId("experience"), createdAt: now() }; this.experiences.push(experience); await this.persist({ type: "experience", experience }); return experience; }
  async listExperiences(projectId: string, limit: number) { return this.experiences.filter((experience) => experience.projectId === projectId).slice(-limit).reverse(); }
  async saveProject(project: ProjectIdentity) { this.projects.set(project.id, project); await this.persist({ type: "project", project }); }
  async deleteProject(id: string) { this.projects.delete(id); }
  async listProjects(): Promise<ProjectIdentity[]> {
    const map = new Map<string, ProjectIdentity>();
    for (const p of this.projects.values()) map.set(p.id, p);
    for (const s of this.sessions.values()) if (s.mode !== "maintenance" && s.mode !== "unassigned" && !map.has(s.projectId)) map.set(s.projectId, { id: s.projectId, workspace: s.workspace, name: basename(s.workspace), workspaces: [s.workspace] });
    return [...map.values()];
  }
  private async persist(value: unknown) { await mkdir(this.root, { recursive: true }); await writeFile(join(this.root, "events.jsonl"), `${JSON.stringify(value)}\n`, { flag: "a" }); }
}

export class PostgresDynamicStore implements DynamicStore {
  private readonly pool: Pool;
  constructor(connectionString: string) { this.pool = new Pool({ connectionString }); }
  async initialize() { await this.migrate(); }
  async migrate() { await this.pool.query(`CREATE EXTENSION IF NOT EXISTS vector; CREATE TABLE IF NOT EXISTS sessions (id text primary key, project_id text not null, workspace text not null, client text not null, task text not null, mode text not null default 'work', status text not null, created_at timestamptz not null, updated_at timestamptz not null); ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mode text not null default 'work'; CREATE TABLE IF NOT EXISTS events (id text primary key, session_id text not null references sessions(id), type text not null, content text not null, occurred_at timestamptz not null); CREATE TABLE IF NOT EXISTS goals (id text primary key, project_id text not null, title text not null, status text not null, updated_at timestamptz not null); CREATE TABLE IF NOT EXISTS experiences (id text primary key, session_id text not null references sessions(id), project_id text not null, summary text not null, decisions jsonb not null, failures jsonb not null, next_steps jsonb not null, created_at timestamptz not null); CREATE TABLE IF NOT EXISTS projects (id text primary key, workspace text not null, name text not null, git_remote text, description text, keywords jsonb not null default '[]', workspaces jsonb not null default '[]'); ALTER TABLE projects ADD COLUMN IF NOT EXISTS description text; ALTER TABLE projects ADD COLUMN IF NOT EXISTS keywords jsonb not null default '[]'; ALTER TABLE projects ADD COLUMN IF NOT EXISTS workspaces jsonb not null default '[]'; CREATE INDEX IF NOT EXISTS events_session_idx ON events(session_id, occurred_at DESC); CREATE INDEX IF NOT EXISTS goals_project_idx ON goals(project_id, updated_at DESC); CREATE INDEX IF NOT EXISTS experiences_project_idx ON experiences(project_id, created_at DESC);`); }
  async createSession(input: Omit<Session, "id" | "createdAt" | "updatedAt" | "status">) { const session = { ...input, id: newId("session"), mode: input.mode ?? "work", status: "active" as const, createdAt: now(), updatedAt: now() }; await this.pool.query("INSERT INTO sessions (id,project_id,workspace,client,task,mode,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [session.id, session.projectId, session.workspace, session.client, session.task, session.mode, session.status, session.createdAt, session.updatedAt]); return session; }
  async getSession(id: string) { const row = (await this.pool.query(`SELECT id, project_id AS "projectId", workspace, client, task, mode, status, created_at AS "createdAt", updated_at AS "updatedAt" FROM sessions WHERE id=$1`, [id])).rows[0]; return row as Session | undefined; }
  async getSourceEvidence(id: string): Promise<MemorySourceEvidence | undefined> {
    if (id.startsWith("experience_")) {
      const row = (await this.pool.query(`SELECT id, project_id AS "projectId", summary, decisions, failures, next_steps AS "nextSteps" FROM experiences WHERE id=$1`, [id])).rows[0];
      return row ? { id, projectId: row.projectId, content: redactSecrets(JSON.stringify(row)) } : undefined;
    }
    if (id.startsWith("event_")) {
      const row = (await this.pool.query(`SELECT e.id, s.project_id AS "projectId", e.type, e.content FROM events e JOIN sessions s ON s.id=e.session_id WHERE e.id=$1`, [id])).rows[0];
      return row ? { id, projectId: row.projectId, content: redactSecrets(JSON.stringify(row)) } : undefined;
    }
    if (id.startsWith("session_")) {
      const session = await this.getSession(id);
      if (!session) return undefined;
      const events = (await this.pool.query(`SELECT id, type, content FROM events WHERE session_id=$1 ORDER BY occurred_at, id`, [id])).rows;
      return { id, projectId: session.projectId, content: redactSecrets(JSON.stringify({ session, events })) };
    }
    return undefined;
  }
  async listSessions(query?: { projectId?: string; status?: "active" | "closed"; limit?: number }) {
    const conditions: string[] = []; const values: unknown[] = [];
    if (query?.projectId) { values.push(query.projectId); conditions.push(`project_id = $${values.length}`); }
    if (query?.status) { values.push(query.status); conditions.push(`status = $${values.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    values.push(query?.limit ?? 50);
    const sql = `SELECT id, project_id AS "projectId", workspace, client, task, mode, status, created_at AS "createdAt", updated_at AS "updatedAt" FROM sessions ${where} ORDER BY created_at DESC LIMIT $${values.length}`;
    return (await this.pool.query(sql, values)).rows as Session[];
  }
  async closeSession(id: string) { await this.pool.query("UPDATE sessions SET status='closed', updated_at=now() WHERE id=$1", [id]); }
  async appendEvent(input: Omit<Event, "id" | "occurredAt">) { const event = { ...input, id: newId("event"), occurredAt: now(), content: redactSecrets(input.content) }; await this.pool.query("INSERT INTO events VALUES ($1,$2,$3,$4,$5)", [event.id, event.sessionId, event.type, event.content, event.occurredAt]); return event; }
  async recentEvents(projectId: string, limit: number) { const rows = (await this.pool.query(`SELECT e.id,e.session_id AS "sessionId",e.type,e.content,e.occurred_at AS "occurredAt" FROM events e JOIN sessions s ON s.id=e.session_id WHERE s.project_id=$1 ORDER BY e.occurred_at DESC LIMIT $2`, [projectId, limit])).rows; return rows as Event[]; }
  async sessionEvents(sessionId: string) { const rows = (await this.pool.query(`SELECT id, session_id AS "sessionId", type, content, occurred_at AS "occurredAt" FROM events WHERE session_id=$1 ORDER BY occurred_at, id`, [sessionId])).rows; return rows as Event[]; }
  async saveGoal(input: Omit<Goal, "id" | "updatedAt">) { const goal = { ...input, id: newId("goal"), updatedAt: now() }; await this.pool.query("UPDATE goals SET status='completed',updated_at=now() WHERE project_id=$1 AND status='active'", [goal.projectId]); await this.pool.query("INSERT INTO goals VALUES ($1,$2,$3,$4,$5)", [goal.id, goal.projectId, goal.title, goal.status, goal.updatedAt]); return goal; }
  async activeGoal(projectId: string) { return (await this.pool.query(`SELECT id, project_id AS "projectId", title, status, updated_at AS "updatedAt" FROM goals WHERE project_id=$1 AND status='active' ORDER BY updated_at DESC LIMIT 1`, [projectId])).rows[0] as Goal | undefined; }
  async listGoals(projectId: string) { return (await this.pool.query(`SELECT id, project_id AS "projectId", title, status, updated_at AS "updatedAt" FROM goals WHERE project_id=$1 ORDER BY updated_at DESC`, [projectId])).rows as Goal[]; }
  async saveExperience(input: Omit<Experience, "id" | "createdAt">) { const experience = { ...input, id: newId("experience"), createdAt: now() }; await this.pool.query("INSERT INTO experiences VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [experience.id, experience.sessionId, experience.projectId, experience.summary, JSON.stringify(experience.decisions), JSON.stringify(experience.failures), JSON.stringify(experience.nextSteps), experience.createdAt]); return experience; }
  async listExperiences(projectId: string, limit: number) { return (await this.pool.query(`SELECT id, session_id AS "sessionId", project_id AS "projectId", summary, decisions, failures, next_steps AS "nextSteps", created_at AS "createdAt" FROM experiences WHERE project_id=$1 ORDER BY created_at DESC LIMIT $2`, [projectId, limit])).rows as Experience[]; }
  async saveProject(project: ProjectIdentity) {
    await this.pool.query(`INSERT INTO projects (id, workspace, name, git_remote, description, keywords, workspaces) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET workspace=$2, name=$3, git_remote=$4, description=$5, keywords=$6, workspaces=$7`, [project.id, project.workspace, project.name, project.gitRemote ?? null, project.description ?? null, JSON.stringify(project.keywords ?? []), JSON.stringify(project.workspaces ?? [project.workspace])]);
  }
  async deleteProject(id: string) {
    await this.pool.query("DELETE FROM projects WHERE id=$1", [id]);
  }
  async listProjects(): Promise<ProjectIdentity[]> {
    const rows = (await this.pool.query(`SELECT id, workspace, name, git_remote AS "gitRemote", description, keywords, workspaces FROM projects`)).rows as ProjectIdentity[];
    const map = new Map<string, ProjectIdentity>();
    for (const p of rows) map.set(p.id, p);
    const sessionProjects = (await this.pool.query(`SELECT DISTINCT project_id AS "id", workspace FROM sessions`)).rows as { id: string; workspace: string }[];
    for (const s of sessionProjects) if (s.id !== "maintenance" && s.id !== "unassigned" && !map.has(s.id)) map.set(s.id, { id: s.id, workspace: s.workspace, name: basename(s.workspace), workspaces: [s.workspace] });
    return [...map.values()];
  }
  async close() { await this.pool.end(); }
}

export { cosine, JsonEmbeddingIndex } from "./embeddings.js";

export type MemoryEmbedder = { model: string; index: JsonEmbeddingIndex; embed: (texts: string[]) => Promise<number[][]> };
const embeddingText = (record: MemoryRecord) => `${record.title} ${record.summary ?? ""} ${record.content}`;
export const memoriesForReview = (candidate: MemoryRecord, records: MemoryRecord[]) => records.filter(record => record.status === "active" && (candidate.scope === "global" || record.scope === "global" || record.projectId === candidate.projectId));
export const sameMemoryContent = (left: MemoryRecord, right: MemoryRecord) => left.content.trim().replace(/\s+/g, " ") === right.content.trim().replace(/\s+/g, " ");
const memorySnapshot = (records: Array<{ id: string; revision: number }>) => JSON.stringify(records.map(record => [record.id, record.revision]).sort(([left], [right]) => String(left).localeCompare(String(right))));

export class FileMemoryEngine implements MemoryEngine {
  private minScore = 0;
  private maxResults = 100;
  private includeGlobal = true;
  private embedder?: MemoryEmbedder;
  constructor(private readonly store: MarkdownMemoryStore, private readonly dynamic: DynamicStore) {}
  setMinScore(value: number) { this.minScore = Math.max(0, value); }
  setRetrievalConfig(config: { minScore?: number; maxResults?: number; includeGlobal?: boolean }) { if (config.minScore !== undefined) this.minScore = Math.max(0, config.minScore); if (config.maxResults !== undefined) this.maxResults = Math.max(1, config.maxResults); if (config.includeGlobal !== undefined) this.includeGlobal = config.includeGlobal; }
  setEmbedding(embedder?: MemoryEmbedder) { this.embedder = embedder; }
  private async indexRecord(record: MemoryRecord) {
    const embedder = this.embedder;
    if (!embedder || record.status !== "active") return;
    try {
      const [vector] = await embedder.embed([embeddingText(record)]);
      if (vector?.length) await embedder.index.upsert(record.id, embedder.model, vector);
    } catch { /* keyword fallback remains available */ }
  }
  async backfillEmbeddings(limit = 32) {
    const embedder = this.embedder;
    if (!embedder) return 0;
    const active = (await this.store.listAll()).filter((record) => record.status === "active");
    const missing = await embedder.index.missing(active.map((record) => record.id), embedder.model);
    const batch = missing.slice(0, Math.max(0, limit)).map((id) => active.find((record) => record.id === id)).filter((record): record is MemoryRecord => Boolean(record));
    if (!batch.length) return 0;
    try {
      const vectors = await embedder.embed(batch.map(embeddingText));
      await embedder.index.upsertMany(batch.flatMap((record, index) => vectors[index]?.length ? [{ id: record.id, model: embedder.model, vector: vectors[index] }] : []));
      return batch.length;
    } catch { return 0; }
  }
  async search({ projectId, query, limit, minScore = this.minScore, includeGlobal = this.includeGlobal }: { projectId?: string; query: string; limit: number; minScore?: number; includeGlobal?: boolean }) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const embedder = this.embedder;
    const records = (projectId ? [...(includeGlobal ? await this.store.list("global") : []), ...await this.store.list("project", projectId)] : await this.store.listAll()).filter((record) => record.status === "active" && (includeGlobal || record.scope !== "global"));
    let queryVector: number[] | undefined;
    if (embedder && terms.length) {
      await this.backfillEmbeddings(32);
      try { queryVector = (await embedder.embed([query]))[0]; } catch { queryVector = undefined; }
    }
    const vectors = queryVector && embedder ? await embedder.index.getMany(records.map(record => record.id), embedder.model) : new Map<string, number[]>();
    const scored = records.map((record) => {
      const haystack = `${record.title} ${record.summary ?? ""} ${record.content} ${record.applicability?.join(" ") ?? ""}`.toLowerCase();
      const keyword = terms.reduce((sum, term) => sum + Number(haystack.includes(term)), 0);
      const vector = vectors.get(record.id);
      const score = keyword + (queryVector && vector ? cosine(queryVector, vector) * 10 : 0);
      return { record, score };
    });
    return scored.filter(({ score }) => !terms.length || score >= minScore).sort((left, right) => right.score - left.score || right.record.updatedAt.localeCompare(left.record.updatedAt)).slice(0, Math.min(limit, this.maxResults));
  }
  async recall({ projectId, query, limit }: { projectId: string; query: string; limit: number }) { return (await this.search({ projectId, query, limit })).map(({ record }) => record); }
  async observe(input: Omit<Event, "id" | "occurredAt">) { return this.dynamic.appendEvent(input); }
  async promote({ record, expectedRevision }: { record: MemoryRecord; expectedRevision: number }) {
    if (record.revision !== expectedRevision) throw new RevisionConflictError("Memory revision conflict");
    const active = await this.store.mutate(record.id, expectedRevision, current => {
      if (current.status !== "candidate") throw new RevisionConflictError("Only a current candidate can be promoted");
      if (current.scope === "project" && (!current.projectId || ["maintenance", "unassigned"].includes(current.projectId))) throw new RevisionConflictError("Assign a concrete project before promotion");
      return { ...current, status: "active" };
    });
    await this.indexRecord(active);
    return active;
  }
  async applyReviewedDecision(record: MemoryRecord, expectedRevision: number, action: "promote" | "archive", reviewedMemories: Array<{ id: string; revision: number }>) {
    const updated = await this.store.mutate(record.id, expectedRevision, async current => {
      if (current.status !== "candidate") throw new RevisionConflictError("Only a current candidate can be reviewed");
      if (current.scope === "project" && (!current.projectId || ["maintenance", "unassigned"].includes(current.projectId))) throw new RevisionConflictError("Assign a concrete project before automatic review");
      const memories = memoriesForReview(current, await this.store.listAll());
      // Check under the same cross-process write lock as the candidate commit.
      if (memorySnapshot(memories) !== memorySnapshot(reviewedMemories)) throw new RevisionConflictError("Review context changed; reload before retrying");
      if (action === "promote" && memories.some(item => sameMemoryContent(item, current))) throw new RevisionConflictError("Duplicate memory; manual review required");
      return { ...current, status: action === "promote" ? "active" : "archived" };
    });
    if (action === "promote") await this.indexRecord(updated);
    return updated;
  }
  async consolidate() {
    const records = await this.store.listAll();
    const candidates = records.filter(record => record.status === "candidate");
    const keyFor = (record: MemoryRecord) => JSON.stringify([record.scope, record.projectId, record.kind, record.title.trim(), record.content.trim()]);
    const seen = new Set(records.filter(record => record.status === "active").map(keyFor));
    let archived = 0;
    for (const candidate of candidates.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      const key = keyFor(candidate);
      if (seen.has(key)) {
        try { await this.store.archive(candidate.id, candidate.revision); archived += 1; }
        catch (error) { if (!(error instanceof RevisionConflictError)) throw error; }
      } else seen.add(key);
    }
    // Consolidation is housekeeping, never evidence verification or approval.
    return { promoted: 0, archived };
  }

  async saveCandidate(input: Omit<MemoryRecord, "id" | "revision" | "status" | "createdAt" | "updatedAt">) { const record: MemoryRecord = { ...input, id: newId("memory"), revision: 1, status: "candidate", createdAt: now(), updatedAt: now() }; await this.store.save(record); return record; }
  async candidates(projectId?: string) {
    if (projectId) {
      return [...await this.store.list("global"), ...await this.store.list("project", projectId)].filter((record) => record.status === "candidate").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return (await this.store.listAll("candidate")).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async allMemories(projectId?: string) {
    if (projectId) {
      return [...await this.store.list("global"), ...await this.store.list("project", projectId)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return (await this.store.listAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async updateCandidate(id: string, updates: Partial<Pick<MemoryRecord, "title" | "content" | "kind">>, expectedRevision: number) {
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) throw new RevisionConflictError("Expected revision is required");
    return this.store.mutate(id, expectedRevision, record => {
      if (record.status !== "candidate") throw new RevisionConflictError("Only candidate memories can be edited");
      return {
        ...record,
        ...(updates.title !== undefined ? { title: updates.title } : {}),
        ...(updates.content !== undefined ? { content: updates.content, summary: undefined } : {}),
        ...(updates.kind !== undefined ? { kind: updates.kind } : {}),
      };
    });
  }
  async archiveCandidate(id: string, expectedRevision?: number) {
    return this.store.archive(id, expectedRevision);
  }
  async reassignCandidate(id: string, projectId: string, expectedRevision?: number) {
    if (!projectId.trim() || ["unassigned", "maintenance"].includes(projectId)) throw new InvalidPathError("A concrete target project is required");
    return this.store.reassign(id, projectId, expectedRevision);
  }
}
