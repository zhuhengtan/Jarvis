import type { GoalEngine } from "@jarvis/core";
import type { Goal } from "@jarvis/shared";
export declare class InMemoryGoalEngine implements GoalEngine {
    private readonly goals;
    active(projectId: string): Promise<Goal | undefined>;
    upsert(goal: Goal): Promise<Goal>;
}
