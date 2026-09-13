import { newId, now } from "@jarvis/shared";

export interface AgentRun { id: string; parentSessionId: string; task: string; status: "requested"; createdAt: string; }
/** Jarvis tracks delegation requests; a client remains responsible for selecting and executing its own agent runtime. */
export class AgentManager { private readonly runs: AgentRun[] = []; request(parentSessionId: string, task: string) { const run = { id: newId("agent_run"), parentSessionId, task, status: "requested" as const, createdAt: now() }; this.runs.push(run); return run; } list(parentSessionId: string) { return this.runs.filter((run) => run.parentSessionId === parentSessionId); } }
