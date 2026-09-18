import { z } from "zod";
export declare const memoryKinds: readonly ["preference", "fact", "constraint", "decision", "identity", "workflow"];
export type MemoryKind = (typeof memoryKinds)[number];
export type MemoryScope = "global" | "project";
export type MemoryStatus = "candidate" | "active" | "archived";
export interface ProjectIdentity {
    id: string;
    workspace: string;
    gitRemote?: string;
    name: string;
    description?: string;
    keywords?: string[];
    workspaces?: string[];
}
export interface MemoryRecord {
    id: string;
    revision: number;
    scope: MemoryScope;
    projectId?: string;
    kind: MemoryKind;
    title: string;
    content: string;
    summary?: string;
    applicability?: string[];
    verification?: string;
    status: MemoryStatus;
    sourceRefs: string[];
    createdAt: string;
    updatedAt: string;
}
export interface Session {
    id: string;
    projectId: string;
    workspace: string;
    client: string;
    task: string;
    mode?: "work" | "maintenance" | "unassigned";
    status: "active" | "closed";
    createdAt: string;
    updatedAt: string;
}
export interface Event {
    id: string;
    sessionId: string;
    type: "observation" | "action" | "result" | "system";
    content: string;
    occurredAt: string;
}
export interface Goal {
    id: string;
    projectId?: string;
    title: string;
    status: "active" | "completed" | "blocked";
    updatedAt: string;
}
export interface Experience {
    id: string;
    sessionId: string;
    projectId: string;
    summary: string;
    decisions: string[];
    failures: string[];
    nextSteps: string[];
    createdAt: string;
}
export interface Evaluation {
    id: string;
    sessionId: string;
    projectId: string;
    score: number;
    rationale: string;
    createdAt: string;
}
export interface ActionAudit {
    id: string;
    sessionId: string;
    action: string;
    permission: string;
    outcome: "allowed" | "denied" | "completed" | "failed";
    detail: string;
    createdAt: string;
}
export interface ContextPackage {
    session: Session;
    project: ProjectIdentity;
    activeGoal?: Goal;
    memories: MemoryRecord[];
    recentEvents: Event[];
    recommendedSkills: string[];
    text: string;
}
export interface RuntimeSettings {
    provider: "ollama" | "none";
    ollamaBaseUrl: string;
    ollamaModel: string;
    embeddingProvider: "ollama" | "none";
    embeddingBaseUrl: string;
    embeddingModel: string;
    ragMinScore: number;
    ragMaxResults: number;
    ragMemoryLimit: number;
    ragRecentEventLimit: number;
    ragSkillLimit: number;
    ragIncludeGlobal: boolean;
    autoConsolidation: boolean;
}
export declare const openSessionInput: z.ZodObject<{
    client: z.ZodString;
    workspace: z.ZodString;
    task: z.ZodString;
    mode: z.ZodDefault<z.ZodEnum<{
        work: "work";
        maintenance: "maintenance";
        unassigned: "unassigned";
    }>>;
}, z.core.$strip>;
export declare const buildContextInput: z.ZodObject<{
    sessionId: z.ZodString;
    task: z.ZodString;
    tokenBudget: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const retrieveContextInput: z.ZodObject<{
    client: z.ZodDefault<z.ZodString>;
    workspace: z.ZodOptional<z.ZodString>;
    task: z.ZodString;
    tokenBudget: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const eventInput: z.ZodObject<{
    sessionId: z.ZodString;
    type: z.ZodEnum<{
        observation: "observation";
        action: "action";
        result: "result";
        system: "system";
    }>;
    content: z.ZodString;
}, z.core.$strip>;
export declare const experienceInput: z.ZodObject<{
    sessionId: z.ZodString;
    summary: z.ZodString;
    decisions: z.ZodDefault<z.ZodArray<z.ZodString>>;
    failures: z.ZodDefault<z.ZodArray<z.ZodString>>;
    nextSteps: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const goalInput: z.ZodObject<{
    projectId: z.ZodString;
    title: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        completed: "completed";
        blocked: "blocked";
    }>>;
}, z.core.$strip>;
export declare const closeSessionInput: z.ZodObject<{
    sessionId: z.ZodString;
    summary: z.ZodString;
    decisions: z.ZodDefault<z.ZodArray<z.ZodString>>;
    failures: z.ZodDefault<z.ZodArray<z.ZodString>>;
    nextSteps: z.ZodDefault<z.ZodArray<z.ZodString>>;
    result: z.ZodEnum<{
        success: "success";
        failure: "failure";
        partial: "partial";
    }>;
}, z.core.$strip>;
export declare const adminLoginInput: z.ZodObject<{
    token: z.ZodString;
}, z.core.$strip>;
export declare const updateCandidateInput: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    kind: z.ZodOptional<z.ZodEnum<{
        preference: "preference";
        fact: "fact";
        constraint: "constraint";
        decision: "decision";
        identity: "identity";
        workflow: "workflow";
    }>>;
}, z.core.$strip>;
export declare const listSessionsInput: z.ZodObject<{
    projectId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        closed: "closed";
    }>>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const runtimeSettingsInput: z.ZodObject<{
    provider: z.ZodEnum<{
        ollama: "ollama";
        none: "none";
    }>;
    ollamaBaseUrl: z.ZodString;
    ollamaModel: z.ZodString;
    embeddingProvider: z.ZodEnum<{
        ollama: "ollama";
        none: "none";
    }>;
    embeddingBaseUrl: z.ZodString;
    embeddingModel: z.ZodString;
    ragMinScore: z.ZodNumber;
    ragMaxResults: z.ZodNumber;
    ragMemoryLimit: z.ZodNumber;
    ragRecentEventLimit: z.ZodNumber;
    ragSkillLimit: z.ZodNumber;
    ragIncludeGlobal: z.ZodBoolean;
    autoConsolidation: z.ZodBoolean;
}, z.core.$strip>;
export interface SkillScript {
    filename: string;
    content: string;
}
export interface SkillBundle {
    name: string;
    description?: string;
    content: string;
    scripts: SkillScript[];
}
export declare const registerProjectInput: z.ZodObject<{
    workspace: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    keywords: z.ZodOptional<z.ZodArray<z.ZodString>>;
    initialGoal: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const skillScriptInput: z.ZodObject<{
    filename: z.ZodString;
    content: z.ZodString;
}, z.core.$strip>;
export declare const skillBundleInput: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    content: z.ZodString;
    scripts: z.ZodDefault<z.ZodArray<z.ZodObject<{
        filename: z.ZodString;
        content: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const now: () => string;
export declare const newId: (prefix: string) => string;
export declare function redactSecrets(value: string): string;
