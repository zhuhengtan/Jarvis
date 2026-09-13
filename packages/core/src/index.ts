import type { ContextPackage, Event, Goal, MemoryRecord, ProjectIdentity, Session } from "@jarvis/shared";

export interface MemoryEngine { recall(input: { projectId: string; query: string; limit: number }): Promise<MemoryRecord[]>; observe(input: Omit<Event, "id" | "occurredAt">): Promise<Event>; promote(input: { record: MemoryRecord; expectedRevision: number }): Promise<MemoryRecord>; consolidate(): Promise<{ promoted: number; archived: number }>; }
export interface ContextEngine { build(input: { session: Session; project: ProjectIdentity; task: string; tokenBudget: number }): Promise<ContextPackage>; }
export interface GoalEngine { active(projectId: string): Promise<Goal | undefined>; }
export interface SkillEngine { search(query: string, limit?: number): Promise<Array<{ name: string; description: string }>>; load(name: string): Promise<string | undefined>; }
export interface CognitiveProvider { name: string; healthy(): Promise<boolean>; extract(input: string): Promise<string[]>; }
