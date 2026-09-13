import type { GoalEngine } from "@jarvis/core";
import type { Goal } from "@jarvis/shared";

export class InMemoryGoalEngine implements GoalEngine {
  private readonly goals = new Map<string, Goal>();
  async active(projectId: string): Promise<Goal | undefined> { return [...this.goals.values()].find((goal) => goal.projectId === projectId && goal.status === "active"); }
  async upsert(goal: Goal): Promise<Goal> { this.goals.set(goal.id, goal); return goal; }
}
