import type { ContextEngine, GoalEngine, MemoryEngine, SkillEngine } from "@jarvis/core";
import type { ContextPackage, ProjectIdentity, Session } from "@jarvis/shared";
export declare class DefaultContextEngine implements ContextEngine {
    private readonly memory;
    private readonly goals;
    private readonly skills;
    private readonly recentEvents;
    constructor(memory: MemoryEngine, goals: GoalEngine, skills: SkillEngine, recentEvents: (projectId: string, limit: number) => Promise<ContextPackage["recentEvents"]>);
    build({ session, project, task }: {
        session: Session;
        project: ProjectIdentity;
        task: string;
        tokenBudget: number;
    }): Promise<ContextPackage>;
}
