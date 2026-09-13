import { DefaultContextEngine } from "@jarvis/context";
import { AgentManager } from "@jarvis/agents";
import { EvaluationEngine } from "@jarvis/evaluation";
import { FileMemoryEngine, ProjectResolver, type DynamicStore } from "@jarvis/memory";
import { FilesystemSkillEngine } from "@jarvis/skills";
import { ReflectionEngine } from "@jarvis/reflection";
import { ToolGateway } from "@jarvis/tools";
import { IdentityService } from "./identity.js";
import { type MemoryRecord, type SkillBundle, type ProjectIdentity } from "@jarvis/shared";
export interface RuntimeConfig {
    assistantName?: string;
    memoryRoot: string;
    skillsRoot: string;
    databaseUrl?: string;
}
export declare class JarvisRuntime {
    readonly config: RuntimeConfig;
    readonly projects: ProjectResolver;
    readonly dynamic: DynamicStore;
    readonly memory: FileMemoryEngine;
    readonly skills: FilesystemSkillEngine;
    readonly context: DefaultContextEngine;
    readonly evaluations: EvaluationEngine;
    readonly reflections: ReflectionEngine;
    readonly agents: AgentManager;
    readonly tools: ToolGateway;
    readonly identity: IdentityService;
    private constructor();
    static create(config: RuntimeConfig): Promise<JarvisRuntime>;
    openSession(input: unknown): Promise<{
        session: import("@jarvis/shared").Session;
        project: ProjectIdentity;
        assistantName: string | undefined;
        onboarding: {
            required: boolean;
            question: string;
        } | {
            required: boolean;
            question?: undefined;
        };
    }>;
    buildContext(input: unknown): Promise<import("@jarvis/shared").ContextPackage>;
    searchMemory(projectId: string, query: string, limit?: number): Promise<MemoryRecord[]>;
    memoryCandidates(projectId: string): Promise<MemoryRecord[]>;
    projectContext(projectId: string): Promise<{
        projectId: string;
        activeGoal: import("@jarvis/shared").Goal | undefined;
        goals: import("@jarvis/shared").Goal[];
        memories: MemoryRecord[];
        recentEvents: import("@jarvis/shared").Event[];
        experiences: import("@jarvis/shared").Experience[];
    }>;
    activeGoal(projectId: string): Promise<import("@jarvis/shared").Goal | undefined>;
    createGoal(input: unknown): Promise<import("@jarvis/shared").Goal>;
    searchSkills(query: string, limit?: number): Promise<{
        name: string;
        description: string;
        scriptCount: number;
    }[]>;
    loadSkill(name: string): Promise<string | undefined>;
    selfCapabilities(): {
        assistantName: string | null;
        onboardingRequired: boolean;
        onboardingQuestion: string | null;
        capabilities: string[];
        transports: string[];
        semanticMemoryWrites: string;
    };
    setAssistantName(name: string): Promise<import("./identity.js").IdentityState>;
    changeAssistantNameFromNaturalLanguage(message: string): Promise<import("./identity.js").IdentityState>;
    spawnAgent(sessionId: string, task: string): Promise<{
        id: string;
        parentSessionId: string;
        task: string;
        status: "requested";
        createdAt: string;
    }>;
    recordEvent(input: unknown): Promise<import("@jarvis/shared").Event>;
    recordExperience(input: unknown): Promise<{
        experience: import("@jarvis/shared").Experience;
        evaluation: import("@jarvis/shared").Evaluation;
        candidates: MemoryRecord[];
    }>;
    closeSession(input: unknown): Promise<{
        closed: boolean;
        result: "success" | "failure" | "partial";
        experience: {
            experience: import("@jarvis/shared").Experience;
            evaluation: import("@jarvis/shared").Evaluation;
            candidates: MemoryRecord[];
        };
    }>;
    rememberCandidate(sessionId: string, input: Omit<MemoryRecord, "id" | "revision" | "status" | "createdAt" | "updatedAt" | "projectId"> & {
        scope: "global" | "project";
    }): Promise<MemoryRecord>;
    promoteMemory(projectId: string, id: string, expectedRevision: number): Promise<{
        revision: number;
        status: "active";
        updatedAt: string;
        id: string;
        scope: import("@jarvis/shared").MemoryScope;
        projectId?: string;
        kind: import("@jarvis/shared").MemoryKind;
        title: string;
        content: string;
        sourceRefs: string[];
        createdAt: string;
    }>;
    listSessions(filter?: {
        projectId?: string;
        status?: "active" | "closed";
        limit?: number;
    }): Promise<import("@jarvis/shared").Session[]>;
    listProjects(): Promise<ProjectIdentity[]>;
    allCandidates(projectId?: string): Promise<MemoryRecord[]>;
    allMemories(projectId?: string): Promise<MemoryRecord[]>;
    updateCandidate(id: string, updates: Partial<Pick<MemoryRecord, "title" | "content" | "kind">>): Promise<MemoryRecord>;
    archiveCandidate(id: string): Promise<MemoryRecord | undefined>;
    promoteCandidate(id: string, expectedRevision: number): Promise<{
        revision: number;
        status: "active";
        updatedAt: string;
        id: string;
        scope: import("@jarvis/shared").MemoryScope;
        projectId?: string;
        kind: import("@jarvis/shared").MemoryKind;
        title: string;
        content: string;
        sourceRefs: string[];
        createdAt: string;
    }>;
    overviewStats(): Promise<{
        activeSessions: number;
        totalSessions: number;
        pendingCandidates: number;
        activeMemories: number;
        totalSkills: number;
    }>;
    registerProject(input: {
        workspace: string;
        name?: string;
        initialGoal?: string;
    }): Promise<ProjectIdentity>;
    deleteProject(id: string): Promise<void>;
    listProjectsDetailed(): Promise<{
        goalsCount: number;
        memoriesCount: number;
        activeGoal: string | undefined;
        id: string;
        workspace: string;
        gitRemote?: string;
        name: string;
    }[]>;
    loadSkillBundle(name: string): Promise<SkillBundle | undefined>;
    saveSkillBundle(bundle: SkillBundle): Promise<void>;
    deleteSkill(name: string): Promise<boolean>;
    private requireSession;
}
