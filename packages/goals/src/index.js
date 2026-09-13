export class InMemoryGoalEngine {
    goals = new Map();
    async active(projectId) { return [...this.goals.values()].find((goal) => goal.projectId === projectId && goal.status === "active"); }
    async upsert(goal) { this.goals.set(goal.id, goal); return goal; }
}
//# sourceMappingURL=index.js.map