import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Pool } from "pg";
import { newId, now, redactSecrets } from "@jarvis/shared";
const exec = promisify(execFile);
const digest = (input) => createHash("sha256").update(input).digest("hex").slice(0, 20);
export class ProjectResolver {
    normalizeRemote(remote) {
        if (!remote)
            return undefined;
        return remote.trim().replace(/^git@([^:]+):/, "https://$1/").replace(/\.git$/, "").replace(/\/$/, "").toLowerCase();
    }
    async metadataFor(canonical) {
        let current = canonical;
        while (true) {
            try {
                return JSON.parse(await readFile(join(current, ".jarvis", "project.json"), "utf8"));
            }
            catch (error) {
                if (error.code !== "ENOENT")
                    throw error;
            }
            const parent = dirname(current);
            if (parent === current)
                return {};
            current = parent;
        }
    }
    async resolve(workspace) {
        const canonical = resolve(workspace);
        let gitRemote;
        try {
            gitRemote = (await exec("git", ["-C", canonical, "config", "--get", "remote.origin.url"])).stdout.trim() || undefined;
        }
        catch { /* non-git workspaces are supported */ }
        const metadata = await this.metadataFor(canonical);
        const normalizedRemote = this.normalizeRemote(gitRemote);
        const id = metadata.id?.trim() || `project_${digest(normalizedRemote || canonical)}`;
        return { id, workspace: canonical, gitRemote: normalizedRemote, name: metadata.name?.trim() || basename(canonical) || "workspace", description: metadata.description, keywords: metadata.keywords, workspaces: metadata.workspaces };
    }
    async register(workspace, name, details) {
        const canonical = resolve(workspace);
        await mkdir(canonical, { recursive: true });
        let gitRemote;
        try {
            gitRemote = (await exec("git", ["-C", canonical, "config", "--get", "remote.origin.url"])).stdout.trim() || undefined;
        }
        catch { /* non-git */ }
        const jarvisDir = join(canonical, ".jarvis");
        await mkdir(jarvisDir, { recursive: true });
        let metadata = {};
        try {
            metadata = JSON.parse(await readFile(join(jarvisDir, "project.json"), "utf8"));
        }
        catch { /* ignore */ }
        const normalizedRemote = this.normalizeRemote(gitRemote);
        const id = metadata.id?.trim() || `project_${digest(normalizedRemote || canonical)}`;
        const projectName = name?.trim() || metadata.name?.trim() || basename(canonical) || "workspace";
        const description = details?.description?.trim() || metadata.description;
        const keywords = details?.keywords?.map((item) => item.trim()).filter(Boolean) || metadata.keywords || [];
        const workspaces = [...new Set([...(metadata.workspaces ?? []), canonical])];
        await writeFile(join(jarvisDir, "project.json"), JSON.stringify({ id, name: projectName, description, keywords, workspaces }, null, 2), "utf8");
        return { id, workspace: canonical, gitRemote: normalizedRemote, name: projectName, description, keywords, workspaces };
    }
}
export class MarkdownMemoryStore {
    root;
    constructor(root) {
        this.root = root;
    }
    path(record) {
        return record.scope === "global"
            ? join(this.root, "global", `${record.id}.md`)
            : join(this.root, "projects", record.projectId ?? "unassigned", `${record.id}.md`);
    }
    async save(record) {
        const path = this.path(record);
        await mkdir(resolve(path, ".."), { recursive: true });
        const metadata = { id: record.id, revision: record.revision, scope: record.scope, project_id: record.projectId ?? null, kind: record.kind, status: record.status, source_refs: record.sourceRefs, summary: record.summary ?? null, applicability: record.applicability ?? [], verification: record.verification ?? null, created_at: record.createdAt, updated_at: record.updatedAt };
        await writeFile(path, `---\n${Object.entries(metadata).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n")}\n---\n\n# ${record.title}\n\n${record.content}\n`, "utf8");
    }
    async list(scope, projectId) {
        const folder = scope === "global" ? join(this.root, "global") : join(this.root, "projects", projectId ?? "");
        let files;
        try {
            files = (await readdir(folder)).filter((file) => file.endsWith(".md"));
        }
        catch {
            return [];
        }
        const parsed = await Promise.all(files.map(async (file) => this.parse(join(folder, file))));
        return parsed.filter((item) => Boolean(item));
    }
    async listAll(status) {
        const globalRecords = await this.list("global");
        const projectsDir = join(this.root, "projects");
        let projectDirs = [];
        try {
            const entries = await readdir(projectsDir, { withFileTypes: true });
            projectDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
        }
        catch {
            projectDirs = [];
        }
        const projectRecords = (await Promise.all(projectDirs.map((dir) => this.list("project", dir)))).flat();
        const all = [...globalRecords, ...projectRecords];
        return status ? all.filter((item) => item.status === status) : all;
    }
    async get(id) {
        const all = await this.listAll();
        return all.find((item) => item.id === id);
    }
    async archive(id) {
        const record = await this.get(id);
        if (!record)
            return undefined;
        const archived = { ...record, status: "archived", updatedAt: now() };
        await this.save(archived);
        return archived;
    }
    async reassign(id, projectId) {
        const record = await this.get(id);
        if (!record || record.scope !== "project" || record.status !== "candidate")
            return undefined;
        if (record.projectId === projectId)
            return record;
        const moved = { ...record, projectId, updatedAt: now() };
        await this.save(moved);
        try {
            await unlink(this.path(record));
        }
        catch (error) {
            if (error.code !== "ENOENT")
                throw error;
        }
        return moved;
    }
    async parse(path) {
        const raw = await readFile(path, "utf8");
        const match = raw.match(/^---\n([\s\S]*?)\n---\n\n# (.*?)\n\n([\s\S]*?)\n?$/);
        if (!match)
            return undefined;
        const attributes = Object.fromEntries(match[1].split("\n").map((line) => { const index = line.indexOf(": "); return [line.slice(0, index), JSON.parse(line.slice(index + 2))]; }));
        return { id: attributes.id, revision: attributes.revision, scope: attributes.scope, projectId: attributes.project_id ?? undefined, kind: attributes.kind, status: attributes.status, sourceRefs: attributes.source_refs ?? [], summary: attributes.summary ?? undefined, applicability: attributes.applicability ?? [], verification: attributes.verification ?? undefined, createdAt: attributes.created_at, updatedAt: attributes.updated_at, title: match[2], content: match[3] };
    }
}
export class JsonlDynamicStore {
    root;
    sessions = new Map();
    events = [];
    goals = new Map();
    experiences = [];
    projects = new Map();
    constructor(root) {
        this.root = root;
    }
    async initialize() { try {
        const raw = await readFile(join(this.root, "events.jsonl"), "utf8");
        for (const line of raw.split("\n")) {
            if (!line.trim())
                continue;
            const item = JSON.parse(line);
            if (item.type === "session")
                this.sessions.set(item.session.id, item.session);
            if (item.type === "event")
                this.events.push(item.event);
            if (item.type === "goal")
                this.goals.set(item.goal.id, item.goal);
            if (item.type === "experience")
                this.experiences.push(item.experience);
            if (item.type === "project")
                this.projects.set(item.project.id, item.project);
        }
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    } }
    async createSession(input) { const session = { ...input, id: newId("session"), status: "active", createdAt: now(), updatedAt: now() }; this.sessions.set(session.id, session); await this.persist({ type: "session", session }); return session; }
    async getSession(id) { return this.sessions.get(id); }
    async listSessions(query) {
        let result = [...this.sessions.values()];
        if (query?.projectId)
            result = result.filter((s) => s.projectId === query.projectId);
        if (query?.status)
            result = result.filter((s) => s.status === query.status);
        result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return result.slice(0, query?.limit ?? 50);
    }
    async closeSession(id) { const session = this.sessions.get(id); if (!session)
        return; session.status = "closed"; session.updatedAt = now(); await this.persist({ type: "session", session }); }
    async appendEvent(input) { const session = this.sessions.get(input.sessionId); if (!session)
        throw new Error("Unknown session"); const event = { ...input, id: newId("event"), occurredAt: now(), content: redactSecrets(input.content), projectId: session.projectId }; this.events.push(event); await this.persist({ type: "event", event }); return event; }
    async recentEvents(projectId, limit) { return this.events.filter((event) => event.projectId === projectId).slice(-limit).reverse().map(({ projectId: _, ...event }) => event); }
    async saveGoal(input) { const goal = { ...input, id: newId("goal"), updatedAt: now() }; if (goal.status === "active")
        for (const existing of this.goals.values())
            if (existing.projectId === goal.projectId && existing.status === "active") {
                existing.status = "completed";
                existing.updatedAt = now();
                await this.persist({ type: "goal", goal: existing });
            } this.goals.set(goal.id, goal); await this.persist({ type: "goal", goal }); return goal; }
    async activeGoal(projectId) { return [...this.goals.values()].filter((goal) => goal.projectId === projectId && goal.status === "active").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]; }
    async listGoals(projectId) { return [...this.goals.values()].filter((goal) => goal.projectId === projectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
    async saveExperience(input) { const experience = { ...input, id: newId("experience"), createdAt: now() }; this.experiences.push(experience); await this.persist({ type: "experience", experience }); return experience; }
    async listExperiences(projectId, limit) { return this.experiences.filter((experience) => experience.projectId === projectId).slice(-limit).reverse(); }
    async saveProject(project) { this.projects.set(project.id, project); await this.persist({ type: "project", project }); }
    async deleteProject(id) { this.projects.delete(id); }
    async listProjects() {
        const map = new Map();
        for (const p of this.projects.values())
            map.set(p.id, p);
        for (const s of this.sessions.values())
            if (s.mode !== "maintenance" && s.mode !== "unassigned" && !map.has(s.projectId))
                map.set(s.projectId, { id: s.projectId, workspace: s.workspace, name: basename(s.workspace), workspaces: [s.workspace] });
        return [...map.values()];
    }
    async persist(value) { await mkdir(this.root, { recursive: true }); await writeFile(join(this.root, "events.jsonl"), `${JSON.stringify(value)}\n`, { flag: "a" }); }
}
export class PostgresDynamicStore {
    pool;
    constructor(connectionString) { this.pool = new Pool({ connectionString }); }
    async initialize() { await this.migrate(); }
    async migrate() { await this.pool.query(`CREATE EXTENSION IF NOT EXISTS vector; CREATE TABLE IF NOT EXISTS sessions (id text primary key, project_id text not null, workspace text not null, client text not null, task text not null, mode text not null default 'work', status text not null, created_at timestamptz not null, updated_at timestamptz not null); ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mode text not null default 'work'; CREATE TABLE IF NOT EXISTS events (id text primary key, session_id text not null references sessions(id), type text not null, content text not null, occurred_at timestamptz not null); CREATE TABLE IF NOT EXISTS goals (id text primary key, project_id text not null, title text not null, status text not null, updated_at timestamptz not null); CREATE TABLE IF NOT EXISTS experiences (id text primary key, session_id text not null references sessions(id), project_id text not null, summary text not null, decisions jsonb not null, failures jsonb not null, next_steps jsonb not null, created_at timestamptz not null); CREATE TABLE IF NOT EXISTS projects (id text primary key, workspace text not null, name text not null, git_remote text, description text, keywords jsonb not null default '[]', workspaces jsonb not null default '[]'); ALTER TABLE projects ADD COLUMN IF NOT EXISTS description text; ALTER TABLE projects ADD COLUMN IF NOT EXISTS keywords jsonb not null default '[]'; ALTER TABLE projects ADD COLUMN IF NOT EXISTS workspaces jsonb not null default '[]'; CREATE INDEX IF NOT EXISTS events_session_idx ON events(session_id, occurred_at DESC); CREATE INDEX IF NOT EXISTS goals_project_idx ON goals(project_id, updated_at DESC); CREATE INDEX IF NOT EXISTS experiences_project_idx ON experiences(project_id, created_at DESC);`); }
    async createSession(input) { const session = { ...input, id: newId("session"), mode: input.mode ?? "work", status: "active", createdAt: now(), updatedAt: now() }; await this.pool.query("INSERT INTO sessions (id,project_id,workspace,client,task,mode,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [session.id, session.projectId, session.workspace, session.client, session.task, session.mode, session.status, session.createdAt, session.updatedAt]); return session; }
    async getSession(id) { const row = (await this.pool.query("SELECT id, project_id AS \\\"projectId\\\", workspace, client, task, mode, status, created_at AS \\\"createdAt\\\", updated_at AS \\\"updatedAt\\\" FROM sessions WHERE id=$1", [id])).rows[0]; return row; }
    async listSessions(query) {
        const conditions = [];
        const values = [];
        if (query?.projectId) {
            values.push(query.projectId);
            conditions.push(`project_id = $${values.length}`);
        }
        if (query?.status) {
            values.push(query.status);
            conditions.push(`status = $${values.length}`);
        }
        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        values.push(query?.limit ?? 50);
        const sql = `SELECT id, project_id AS "projectId", workspace, client, task, mode, status, created_at AS "createdAt", updated_at AS "updatedAt" FROM sessions ${where} ORDER BY created_at DESC LIMIT $${values.length}`;
        return (await this.pool.query(sql, values)).rows;
    }
    async closeSession(id) { await this.pool.query("UPDATE sessions SET status='closed', updated_at=now() WHERE id=$1", [id]); }
    async appendEvent(input) { const event = { ...input, id: newId("event"), occurredAt: now(), content: redactSecrets(input.content) }; await this.pool.query("INSERT INTO events VALUES ($1,$2,$3,$4,$5)", [event.id, event.sessionId, event.type, event.content, event.occurredAt]); return event; }
    async recentEvents(projectId, limit) { const rows = (await this.pool.query("SELECT e.id,e.session_id AS \\\"sessionId\\\",e.type,e.content,e.occurred_at AS \\\"occurredAt\\\" FROM events e JOIN sessions s ON s.id=e.session_id WHERE s.project_id=$1 ORDER BY e.occurred_at DESC LIMIT $2", [projectId, limit])).rows; return rows; }
    async saveGoal(input) { const goal = { ...input, id: newId("goal"), updatedAt: now() }; await this.pool.query("UPDATE goals SET status='completed',updated_at=now() WHERE project_id=$1 AND status='active'", [goal.projectId]); await this.pool.query("INSERT INTO goals VALUES ($1,$2,$3,$4,$5)", [goal.id, goal.projectId, goal.title, goal.status, goal.updatedAt]); return goal; }
    async activeGoal(projectId) { return (await this.pool.query("SELECT id, project_id AS \\\"projectId\\\", title, status, updated_at AS \\\"updatedAt\\\" FROM goals WHERE project_id=$1 AND status='active' ORDER BY updated_at DESC LIMIT 1", [projectId])).rows[0]; }
    async listGoals(projectId) { return (await this.pool.query("SELECT id, project_id AS \\\"projectId\\\", title, status, updated_at AS \\\"updatedAt\\\" FROM goals WHERE project_id=$1 ORDER BY updated_at DESC", [projectId])).rows; }
    async saveExperience(input) { const experience = { ...input, id: newId("experience"), createdAt: now() }; await this.pool.query("INSERT INTO experiences VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [experience.id, experience.sessionId, experience.projectId, experience.summary, JSON.stringify(experience.decisions), JSON.stringify(experience.failures), JSON.stringify(experience.nextSteps), experience.createdAt]); return experience; }
    async listExperiences(projectId, limit) { return (await this.pool.query("SELECT id, session_id AS \\\"sessionId\\\", project_id AS \\\"projectId\\\", summary, decisions, failures, next_steps AS \\\"nextSteps\\\", created_at AS \\\"createdAt\\\" FROM experiences WHERE project_id=$1 ORDER BY created_at DESC LIMIT $2", [projectId, limit])).rows; }
    async saveProject(project) {
        await this.pool.query(`INSERT INTO projects (id, workspace, name, git_remote, description, keywords, workspaces) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET workspace=$2, name=$3, git_remote=$4, description=$5, keywords=$6, workspaces=$7`, [project.id, project.workspace, project.name, project.gitRemote ?? null, project.description ?? null, JSON.stringify(project.keywords ?? []), JSON.stringify(project.workspaces ?? [project.workspace])]);
    }
    async deleteProject(id) {
        await this.pool.query("DELETE FROM projects WHERE id=$1", [id]);
    }
    async listProjects() {
        const rows = (await this.pool.query(`SELECT id, workspace, name, git_remote AS "gitRemote", description, keywords, workspaces FROM projects`)).rows;
        const map = new Map();
        for (const p of rows)
            map.set(p.id, p);
        const sessionProjects = (await this.pool.query(`SELECT DISTINCT project_id AS "id", workspace FROM sessions`)).rows;
        for (const s of sessionProjects)
            if (s.id !== "maintenance" && s.id !== "unassigned" && !map.has(s.id))
                map.set(s.id, { id: s.id, workspace: s.workspace, name: basename(s.workspace), workspaces: [s.workspace] });
        return [...map.values()];
    }
    async close() { await this.pool.end(); }
}
export class FileMemoryEngine {
    store;
    dynamic;
    minScore = 0;
    maxResults = 100;
    includeGlobal = true;
    constructor(store, dynamic) {
        this.store = store;
        this.dynamic = dynamic;
    }
    setMinScore(value) { this.minScore = Math.max(0, value); }
    setRetrievalConfig(config) { if (config.minScore !== undefined)
        this.minScore = Math.max(0, config.minScore); if (config.maxResults !== undefined)
        this.maxResults = Math.max(1, config.maxResults); if (config.includeGlobal !== undefined)
        this.includeGlobal = config.includeGlobal; }
    async search({ projectId, query, limit, minScore = this.minScore, includeGlobal = this.includeGlobal }) {
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        const records = (projectId ? [...(includeGlobal ? await this.store.list("global") : []), ...await this.store.list("project", projectId)] : await this.store.listAll()).filter((record) => record.status === "active" && (includeGlobal || record.scope !== "global"));
        return records.map((record) => ({ record, score: terms.reduce((sum, term) => sum + Number(`${record.title} ${record.summary ?? ""} ${record.content} ${record.applicability?.join(" ") ?? ""}`.toLowerCase().includes(term)), 0) })).filter(({ score }) => !terms.length || score >= minScore).sort((left, right) => right.score - left.score || right.record.updatedAt.localeCompare(left.record.updatedAt)).slice(0, Math.min(limit, this.maxResults));
    }
    async recall({ projectId, query, limit }) { return (await this.search({ projectId, query, limit })).map(({ record }) => record); }
    async observe(input) { return this.dynamic.appendEvent(input); }
    async promote({ record, expectedRevision }) { if (record.revision !== expectedRevision)
        throw new Error("Memory revision conflict"); const active = { ...record, revision: record.revision + 1, status: "active", updatedAt: now() }; await this.store.save(active); return active; }
    async consolidate() {
        const candidates = await this.store.listAll("candidate");
        const seen = new Map();
        let promoted = 0;
        let archived = 0;
        for (const candidate of candidates.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
            const key = `${candidate.scope}:${candidate.projectId ?? ""}:${candidate.kind}:${candidate.title.trim().toLowerCase()}:${candidate.content.trim().toLowerCase()}`;
            if (seen.has(key)) {
                await this.store.archive(candidate.id);
                archived += 1;
                continue;
            }
            seen.set(key, candidate);
            const eligible = candidate.scope === "project" && candidate.sourceRefs.length > 0 && candidate.content.length >= 80 && !/未知|待归属|冲突|等待人工/.test(candidate.content);
            if (eligible) {
                await this.promote({ record: candidate, expectedRevision: candidate.revision });
                promoted += 1;
            }
        }
        return { promoted, archived };
    }
    async saveCandidate(input) { const record = { ...input, id: newId("memory"), revision: 1, status: "candidate", createdAt: now(), updatedAt: now() }; await this.store.save(record); return record; }
    async candidates(projectId) {
        if (projectId) {
            return [...await this.store.list("global"), ...await this.store.list("project", projectId)].filter((record) => record.status === "candidate").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        }
        return (await this.store.listAll("candidate")).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    async allMemories(projectId) {
        if (projectId) {
            return [...await this.store.list("global"), ...await this.store.list("project", projectId)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        }
        return (await this.store.listAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    async updateCandidate(id, updates) {
        const record = await this.store.get(id);
        if (!record)
            throw new Error("Memory not found");
        const updated = {
            ...record,
            ...(updates.title !== undefined ? { title: updates.title } : {}),
            ...(updates.content !== undefined ? { content: updates.content } : {}),
            ...(updates.kind !== undefined ? { kind: updates.kind } : {}),
            updatedAt: now(),
        };
        await this.store.save(updated);
        return updated;
    }
    async archiveCandidate(id) {
        return this.store.archive(id);
    }
    async reassignCandidate(id, projectId) {
        if (!projectId.trim() || projectId === "unassigned")
            throw new Error("A concrete target project is required");
        return this.store.reassign(id, projectId);
    }
}
//# sourceMappingURL=index.js.map