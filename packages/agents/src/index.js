import { newId, now } from "@jarvis/shared";
/** Jarvis tracks delegation requests; a client remains responsible for selecting and executing its own agent runtime. */
export class AgentManager {
    runs = [];
    request(parentSessionId, task) { const run = { id: newId("agent_run"), parentSessionId, task, status: "requested", createdAt: now() }; this.runs.push(run); return run; }
    list(parentSessionId) { return this.runs.filter((run) => run.parentSessionId === parentSessionId); }
}
//# sourceMappingURL=index.js.map