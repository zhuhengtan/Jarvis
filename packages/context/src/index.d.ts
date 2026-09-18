import type { ContextEngine, GoalEngine, MemoryEngine, SkillEngine } from "@jarvis/core";
import type { ContextPackage, ProjectIdentity, Session } from "@jarvis/shared";
export declare class DefaultContextEngine implements ContextEngine {
    private readonly memory;
    private readonly goals;
    private readonly skills;
    private readonly recentEvents;
    private limits;
    constructor(memory: MemoryEngine, goals: GoalEngine, skills: SkillEngine, recentEvents: (projectId: string, limit: number) => Promise<ContextPackage["recentEvents"]>, limits?: {
        memory?: number;
        events?: number;
        skills?: number;
    });
    setLimits(limits: {
        memory?: number;
        events?: number;
        skills?: number;
    }): void;
    build({ session, project, task, tokenBudget }: {
        session: Session;
        project: ProjectIdentity;
        task: string;
        tokenBudget: number;
    }): Promise<ContextPackage>;
}
