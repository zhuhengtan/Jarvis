import { z } from "zod";

export const memoryKinds = ["preference", "fact", "constraint", "decision", "identity", "workflow"] as const;
export type MemoryKind = (typeof memoryKinds)[number];
export type MemoryScope = "global" | "project";
export type MemoryStatus = "candidate" | "active" | "archived";

export interface ProjectIdentity { id: string; workspace: string; gitRemote?: string; name: string; }
export interface MemoryRecord { id: string; revision: number; scope: MemoryScope; projectId?: string; kind: MemoryKind; title: string; content: string; status: MemoryStatus; sourceRefs: string[]; createdAt: string; updatedAt: string; }
export interface Session { id: string; projectId: string; workspace: string; client: string; task: string; status: "active" | "closed"; createdAt: string; updatedAt: string; }
export interface Event { id: string; sessionId: string; type: "observation" | "action" | "result" | "system"; content: string; occurredAt: string; }
export interface Goal { id: string; projectId?: string; title: string; status: "active" | "completed" | "blocked"; updatedAt: string; }
export interface Experience { id: string; sessionId: string; projectId: string; summary: string; decisions: string[]; failures: string[]; nextSteps: string[]; createdAt: string; }
export interface Evaluation { id: string; sessionId: string; projectId: string; score: number; rationale: string; createdAt: string; }
export interface ActionAudit { id: string; sessionId: string; action: string; permission: string; outcome: "allowed" | "denied" | "completed" | "failed"; detail: string; createdAt: string; }
export interface ContextPackage { session: Session; project: ProjectIdentity; activeGoal?: Goal; memories: MemoryRecord[]; recentEvents: Event[]; recommendedSkills: string[]; text: string; }

export const openSessionInput = z.object({ client: z.string().min(1).max(80), workspace: z.string().min(1), task: z.string().min(1).max(10_000) });
export const buildContextInput = z.object({ sessionId: z.string().min(1), task: z.string().min(1), tokenBudget: z.number().int().min(500).max(50_000).default(8_000) });
export const retrieveContextInput = z.object({ client: z.string().min(1).max(80).default("open-webui"), workspace: z.string().min(1), task: z.string().min(1).max(10_000), tokenBudget: z.number().int().min(500).max(50_000).default(8_000) });
export const eventInput = z.object({ sessionId: z.string().min(1), type: z.enum(["observation", "action", "result", "system"]), content: z.string().min(1).max(100_000) });
export const experienceInput = z.object({ sessionId: z.string().min(1), summary: z.string().min(1).max(20_000), decisions: z.array(z.string().max(2_000)).default([]), failures: z.array(z.string().max(2_000)).default([]), nextSteps: z.array(z.string().max(2_000)).default([]) });
export const goalInput = z.object({ projectId: z.string().min(1), title: z.string().min(1).max(2_000), status: z.enum(["active", "completed", "blocked"]).default("active") });
export const closeSessionInput = experienceInput.extend({ result: z.enum(["success", "failure", "partial"]) });

export const adminLoginInput = z.object({ token: z.string().min(1) });
export const updateCandidateInput = z.object({ title: z.string().min(1).optional(), content: z.string().min(1).optional(), kind: z.enum(memoryKinds).optional() });
export const listSessionsInput = z.object({ projectId: z.string().optional(), status: z.enum(["active", "closed"]).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });

export interface SkillScript { filename: string; content: string; }
export interface SkillBundle { name: string; description?: string; content: string; scripts: SkillScript[]; }

export const registerProjectInput = z.object({
  workspace: z.string().min(1),
  name: z.string().min(1).optional(),
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
export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
export function redactSecrets(value: string): string { return value.replace(/(?:sk|pk|api)[_-][A-Za-z0-9_-]{12,}|(?:token|password|secret)\s*[:=]\s*[^\s,;]+/gi, "[REDACTED]"); }
