import type { MemoryEngine } from "@jarvis/core";
import { type Event, type Experience, type Goal, type MemoryRecord, type MemoryScope, type MemoryStatus, type ProjectIdentity, type Session } from "@jarvis/shared";
export declare class ProjectResolver {
    resolve(workspace: string): Promise<ProjectIdentity>;
}
export declare class MarkdownMemoryStore {
    private readonly root;
    constructor(root: string);
    private path;
    save(record: MemoryRecord): Promise<void>;
    list(scope: MemoryScope, projectId?: string): Promise<MemoryRecord[]>;
    listAll(status?: MemoryStatus): Promise<MemoryRecord[]>;
    get(id: string): Promise<MemoryRecord | undefined>;
    archive(id: string): Promise<MemoryRecord | undefined>;
    private parse;
}
export interface DynamicStore {
    initialize(): Promise<void>;
    createSession(input: Omit<Session, "id" | "createdAt" | "updatedAt" | "status">): Promise<Session>;
    getSession(id: string): Promise<Session | undefined>;
    listSessions(query?: {
        projectId?: string;
        status?: "active" | "closed";
        limit?: number;
    }): Promise<Session[]>;
    closeSession(id: string): Promise<void>;
    appendEvent(input: Omit<Event, "id" | "occurredAt">): Promise<Event>;
    recentEvents(projectId: string, limit: number): Promise<Event[]>;
    saveGoal(input: Omit<Goal, "id" | "updatedAt">): Promise<Goal>;
    activeGoal(projectId: string): Promise<Goal | undefined>;
    listGoals(projectId: string): Promise<Goal[]>;
    saveExperience(input: Omit<Experience, "id" | "createdAt">): Promise<Experience>;
    listExperiences(projectId: string, limit: number): Promise<Experience[]>;
    listProjects(): Promise<{
        id: string;
        workspace: string;
    }[]>;
}
export declare class JsonlDynamicStore implements DynamicStore {
    private readonly root;
    private readonly sessions;
    private readonly events;
    private readonly goals;
    private readonly experiences;
    constructor(root: string);
    initialize(): Promise<void>;
    createSession(input: Omit<Session, "id" | "createdAt" | "updatedAt" | "status">): Promise<Session>;
    getSession(id: string): Promise<Session | undefined>;
    listSessions(query?: {
        projectId?: string;
        status?: "active" | "closed";
        limit?: number;
    }): Promise<Session[]>;
    closeSession(id: string): Promise<void>;
    appendEvent(input: Omit<Event, "id" | "occurredAt">): Promise<{
        id: string;
        occurredAt: string;
        content: string;
        projectId: string;
        type: "observation" | "action" | "result" | "system";
        sessionId: string;
    }>;
    recentEvents(projectId: string, limit: number): Promise<{
        id: string;
        sessionId: string;
        type: "observation" | "action" | "result" | "system";
        content: string;
        occurredAt: string;
    }[]>;
    saveGoal(input: Omit<Goal, "id" | "updatedAt">): Promise<{
        id: string;
        updatedAt: string;
        projectId?: string | undefined;
        title: string;
        status: "active" | "completed" | "blocked";
    }>;
    activeGoal(projectId: string): Promise<Goal>;
    listGoals(projectId: string): Promise<Goal[]>;
    saveExperience(input: Omit<Experience, "id" | "createdAt">): Promise<{
        id: string;
        createdAt: string;
        sessionId: string;
        summary: string;
        decisions: string[];
        failures: string[];
        nextSteps: string[];
        projectId: string;
    }>;
    listExperiences(projectId: string, limit: number): Promise<Experience[]>;
    listProjects(): Promise<{
        id: string;
        workspace: string;
    }[]>;
    private persist;
}
export declare class PostgresDynamicStore implements DynamicStore {
    private readonly pool;
    constructor(connectionString: string);
    initialize(): Promise<void>;
    migrate(): Promise<void>;
    createSession(input: Omit<Session, "id" | "createdAt" | "updatedAt" | "status">): Promise<{
        id: string;
        status: "active";
        createdAt: string;
        updatedAt: string;
        client: string;
        workspace: string;
        task: string;
        projectId: string;
    }>;
    getSession(id: string): Promise<Session | undefined>;
    listSessions(query?: {
        projectId?: string;
        status?: "active" | "closed";
        limit?: number;
    }): Promise<Session[]>;
    closeSession(id: string): Promise<void>;
    appendEvent(input: Omit<Event, "id" | "occurredAt">): Promise<{
        id: string;
        occurredAt: string;
        content: string;
        type: "observation" | "action" | "result" | "system";
        sessionId: string;
    }>;
    recentEvents(projectId: string, limit: number): Promise<Event[]>;
    saveGoal(input: Omit<Goal, "id" | "updatedAt">): Promise<{
        id: string;
        updatedAt: string;
        projectId?: string | undefined;
        title: string;
        status: "active" | "completed" | "blocked";
    }>;
    activeGoal(projectId: string): Promise<Goal | undefined>;
    listGoals(projectId: string): Promise<Goal[]>;
    saveExperience(input: Omit<Experience, "id" | "createdAt">): Promise<{
        id: string;
        createdAt: string;
        sessionId: string;
        summary: string;
        decisions: string[];
        failures: string[];
        nextSteps: string[];
        projectId: string;
    }>;
    listExperiences(projectId: string, limit: number): Promise<Experience[]>;
    listProjects(): Promise<{
        id: string;
        workspace: string;
    }[]>;
    close(): Promise<void>;
}
export declare class FileMemoryEngine implements MemoryEngine {
    private readonly store;
    private readonly dynamic;
    constructor(store: MarkdownMemoryStore, dynamic: DynamicStore);
    recall({ projectId, query, limit }: {
        projectId: string;
        query: string;
        limit: number;
    }): Promise<MemoryRecord[]>;
    observe(input: Omit<Event, "id" | "occurredAt">): Promise<Event>;
    promote({ record, expectedRevision }: {
        record: MemoryRecord;
        expectedRevision: number;
    }): Promise<{
        revision: number;
        status: "active";
        updatedAt: string;
        id: string;
        scope: MemoryScope;
        projectId?: string;
        kind: import("@jarvis/shared").MemoryKind;
        title: string;
        content: string;
        sourceRefs: string[];
        createdAt: string;
    }>;
    consolidate(): Promise<{
        promoted: number;
        archived: number;
    }>;
    saveCandidate(input: Omit<MemoryRecord, "id" | "revision" | "status" | "createdAt" | "updatedAt">): Promise<MemoryRecord>;
    candidates(projectId?: string): Promise<MemoryRecord[]>;
    allMemories(projectId?: string): Promise<MemoryRecord[]>;
    updateCandidate(id: string, updates: Partial<Pick<MemoryRecord, "title" | "content" | "kind">>): Promise<MemoryRecord>;
    archiveCandidate(id: string): Promise<MemoryRecord | undefined>;
}
