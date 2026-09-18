import { z } from "zod";
export const memoryKinds = ["preference", "fact", "constraint", "decision", "identity", "workflow"];
export const openSessionInput = z.object({ client: z.string().min(1).max(80), workspace: z.string().min(1), task: z.string().min(1).max(10_000), mode: z.enum(["work", "maintenance", "unassigned"]).default("work") });
export const buildContextInput = z.object({ sessionId: z.string().min(1), task: z.string().min(1), tokenBudget: z.number().int().min(500).max(50_000).default(8_000) });
export const retrieveContextInput = z.object({ client: z.string().min(1).max(80).default("open-webui"), workspace: z.string().min(1).optional(), task: z.string().min(1).max(10_000), tokenBudget: z.number().int().min(500).max(50_000).default(8_000) });
export const eventInput = z.object({ sessionId: z.string().min(1), type: z.enum(["observation", "action", "result", "system"]), content: z.string().min(1).max(100_000) });
export const experienceInput = z.object({ sessionId: z.string().min(1), summary: z.string().min(1).max(20_000), decisions: z.array(z.string().max(2_000)).default([]), failures: z.array(z.string().max(2_000)).default([]), nextSteps: z.array(z.string().max(2_000)).default([]) });
export const goalInput = z.object({ projectId: z.string().min(1), title: z.string().min(1).max(2_000), status: z.enum(["active", "completed", "blocked"]).default("active") });
export const closeSessionInput = experienceInput.extend({ result: z.enum(["success", "failure", "partial"]) });
export const adminLoginInput = z.object({ token: z.string().min(1) });
export const updateCandidateInput = z.object({ title: z.string().min(1).optional(), content: z.string().min(1).optional(), kind: z.enum(memoryKinds).optional() });
export const listSessionsInput = z.object({ projectId: z.string().optional(), status: z.enum(["active", "closed"]).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });
export const runtimeSettingsInput = z.object({ provider: z.enum(["ollama", "none"]), ollamaBaseUrl: z.string().url(), ollamaModel: z.string().min(1).max(120), embeddingProvider: z.enum(["ollama", "none"]), embeddingBaseUrl: z.string().url(), embeddingModel: z.string().min(1).max(120), ragMinScore: z.number().min(0).max(20), ragMaxResults: z.number().int().min(1).max(100), ragMemoryLimit: z.number().int().min(1).max(100), ragRecentEventLimit: z.number().int().min(0).max(100), ragSkillLimit: z.number().int().min(0).max(50), ragIncludeGlobal: z.boolean(), autoConsolidation: z.boolean() });
export const registerProjectInput = z.object({
    workspace: z.string().min(1),
    name: z.string().min(1).optional(),
    description: z.string().max(4_000).optional(),
    keywords: z.array(z.string().min(1).max(80)).max(50).optional(),
    initialGoal: z.string().min(1).optional(),
});
export const skillScriptInput = z.object({
    filename: z.string().min(1).regex(/^[a-zA-Z0-9_.-]+$/, "文件名仅允许字母、数字、点、下划线与短横线"),
    content: z.string(),
});
export const skillBundleInput = z.object({
    name: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/, "技能标识仅允许英文字母、数字、下划线与短横线"),
    description: z.string().optional(),
    content: z.string(),
    scripts: z.array(skillScriptInput).default([]),
});
export const now = () => new Date().toISOString();
export const newId = (prefix) => `${prefix}_${crypto.randomUUID()}`;
export function redactSecrets(value) { return value.replace(/(?:sk|pk|api)[_-][A-Za-z0-9_-]{12,}|(?:token|password|secret)\s*[:=]\s*[^\s,;]+/gi, "[REDACTED]"); }
//# sourceMappingURL=index.js.map