import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Pool } from "pg";
import { newId, now, redactSecrets } from "@jarvis/shared";
const exec = promisify(execFile);
const digest = (input) => createHash("sha256").update(input).digest("hex").slice(0, 20);
export class ProjectResolver {
    async resolve(workspace) {
        const canonical = resolve(workspace);
        let gitRemote;
        try {
            gitRemote = (await exec("git", ["-C", canonical, "config", "--get", "remote.origin.url"])).stdout.trim() || undefined;
        }
        catch { /* non-git workspaces are supported */ }
        let metadata = {};
        try {
            metadata = JSON.parse(await readFile(join(canonical, ".jarvis", "project.json"), "utf8"));
        }
        catch (error) {
            if (error.code !== "ENOENT")
                throw error;
        }
        const id = metadata.id?.trim() || `project_${digest(gitRemote || canonical)}`;
        return { id, workspace: canonical, gitRemote, name: metadata.name?.trim() || basename(canonical) || "workspace" };
    }
}
export class MarkdownMemoryStore {
    root;
    constructor(root) {
        this.root = root;
    }
    path(record) { return join(this.root, record.scope === "global" ? "global" : "projects", record.projectId ?? "unassigned", `${record.id}.md`); }
    async save(record) {
        const path = this.path(record);
        await mkdir(resolve(path, ".."), { recursive: true });
        const metadata = { id: record.id, revision: record.revision, scope: record.scope, project_id: record.projectId ?? null, kind: record.kind, status: record.status, source_refs: record.sourceRefs, created_at: record.createdAt, updated_at: record.updatedAt };
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
            projectDirs = await readdir(projectsDir);
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
    async parse(path) {
        const raw = await readFile(path, "utf8");
        const match = raw.match(/^---\n([\s\S]*?)\n---\n\n# (.*?)\n\n([\s\S]*?)\n?$/);
        if (!match)
            return undefined;
        const attributes = Object.fromEntries(match[1].split("\n").map((line) => { const index = line.indexOf(": "); return [line.slice(0, index), JSON.parse(line.slice(index + 2))]; }));
        return { id: attributes.id, revision: attributes.revision, scope: attributes.scope, projectId: attributes.project_id ?? undefined, kind: attributes.kind, status: attributes.status, sourceRefs: attributes.source_refs ?? [], createdAt: attributes.created_at, updatedAt: attributes.updated_at, title: match[2], content: match[3] };
    }
}
export class JsonlDynamicStore {
    root;
    sessions = new Map();
    events = [];
    goals = new Map();
    experiences = [];
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
    async listProjects() {
        const map = new Map();
        for (const s of this.sessions.values())
            if (!map.has(s.projectId))
                map.set(s.projectId, s.workspace);
        return [...map.entries()].map(([id, workspace]) => ({ id, workspace }));
    }
    async persist(value) { await mkdir(this.root, { recursive: true }); await writeFile(join(this.root, "events.jsonl"), `${JSON.stringify(value)}\n`, { flag: "a" }); }
}
export class PostgresDynamicStore {
    pool;
    constructor(connectionString) { this.pool = new Pool({ connectionString }); }
    async initialize() { await this.migrate(); }
    async migrate() { await this.pool.query(`CREATE EXTENSION IF NOT EXISTS vector; CREATE TABLE IF NOT EXISTS sessions (id text primary key, project_id text not null, workspace text not null, client text not null, task text not null, status text not null, created_at timestamptz not null, updated_at timestamptz not null); CREATE TABLE IF NOT EXISTS events (id text primary key, session_id text not null references sessions(id), type text not null, content text not null, occurred_at timestamptz not null); CREATE TABLE IF NOT EXISTS goals (id text primary key, project_id text not null, title text not null, status text not null, updated_at timestamptz not null); CREATE TABLE IF NOT EXISTS experiences (id text primary key, session_id text not null references sessions(id), project_id text not null, summary text not null, decisions jsonb not null, failures jsonb not null, next_steps jsonb not null, created_at timestamptz not null); CREATE INDEX IF NOT EXISTS events_session_idx ON events(session_id, occurred_at DESC); CREATE INDEX IF NOT EXISTS goals_project_idx ON goals(project_id, updated_at DESC); CREATE INDEX IF NOT EXISTS experiences_project_idx ON experiences(project_id, created_at DESC);`); }
    async createSession(input) { const session = { ...input, id: newId("session"), status: "active", createdAt: now(), updatedAt: now() }; await this.pool.query("INSERT INTO sessions VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [session.id, session.projectId, session.workspace, session.client, session.task, session.status, session.createdAt, session.updatedAt]); return session; }
    async getSession(id) { const row = (await this.pool.query("SELECT id, project_id AS \\\"projectId\\\", workspace, client, task, status, created_at AS \\\"createdAt\\\", updated_at AS \\\"updatedAt\\\" FROM sessions WHERE id=$1", [id])).rows[0]; return row; }
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
        const sql = `SELECT id, project_id AS "projectId", workspace, client, task, status, created_at AS "createdAt", updated_at AS "updatedAt" FROM sessions ${where} ORDER BY created_at DESC LIMIT $${values.length}`;
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
    async listProjects() {
        const rows = (await this.pool.query(`SELECT DISTINCT project_id AS "id", workspace FROM sessions`)).rows;
        return rows;
    }
    async close() { await this.pool.end(); }
}
export class FileMemoryEngine {
    store;
    dynamic;
    constructor(store, dynamic) {
        this.store = store;
        this.dynamic = dynamic;
    }
    async recall({ projectId, query, limit }) { const terms = query.toLowerCase().split(/\s+/).filter(Boolean); const records = [...await this.store.list("global"), ...await this.store.list("project", projectId)].filter((record) => record.status === "active"); return records.map((record) => ({ record, score: terms.reduce((sum, term) => sum + Number(`${record.title} ${record.content}`.toLowerCase().includes(term)), 0) })).filter(({ score }) => score > 0 || !terms.length).sort((left, right) => right.score - left.score || right.record.updatedAt.localeCompare(left.record.updatedAt)).slice(0, limit).map(({ record }) => record); }
    async observe(input) { return this.dynamic.appendEvent(input); }
    async promote({ record, expectedRevision }) { if (record.revision !== expectedRevision)
        throw new Error("Memory revision conflict"); const active = { ...record, revision: record.revision + 1, status: "active", updatedAt: now() }; await this.store.save(active); return active; }
    async consolidate() { return { promoted: 0, archived: 0 }; }
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
}
//# sourceMappingURL=index.js.map