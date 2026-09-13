import { z } from "zod";
export const memoryKinds = ["preference", "fact", "constraint", "decision", "identity", "workflow"];
export const openSessionInput = z.object({ client: z.string().min(1).max(80), workspace: z.string().min(1), task: z.string().min(1).max(10_000) });
export const buildContextInput = z.object({ sessionId: z.string().min(1), task: z.string().min(1), tokenBudget: z.number().int().min(500).max(50_000).default(8_000) });
export const eventInput = z.object({ sessionId: z.string().min(1), type: z.enum(["observation", "action", "result", "system"]), content: z.string().min(1).max(100_000) });
export const experienceInput = z.object({ sessionId: z.string().min(1), summary: z.string().min(1).max(20_000), decisions: z.array(z.string().max(2_000)).default([]), failures: z.array(z.string().max(2_000)).default([]), nextSteps: z.array(z.string().max(2_000)).default([]) });
export const goalInput = z.object({ projectId: z.string().min(1), title: z.string().min(1).max(2_000), status: z.enum(["active", "completed", "blocked"]).default("active") });
export const closeSessionInput = experienceInput.extend({ result: z.enum(["success", "failure", "partial"]) });
export const adminLoginInput = z.object({ token: z.string().min(1) });
export const updateCandidateInput = z.object({ title: z.string().min(1).optional(), content: z.string().min(1).optional(), kind: z.enum(memoryKinds).optional() });
export const listSessionsInput = z.object({ projectId: z.string().optional(), status: z.enum(["active", "closed"]).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });
export const now = () => new Date().toISOString();
export const newId = (prefix) => `${prefix}_${crypto.randomUUID()}`;
export function redactSecrets(value) { return value.replace(/(?:sk|pk|api)[_-][A-Za-z0-9_-]{12,}|(?:token|password|secret)\s*[:=]\s*[^\s,;]+/gi, "[REDACTED]"); }
//# sourceMappingURL=index.js.map