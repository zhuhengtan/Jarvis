export type MemoryKind = "preference" | "fact" | "constraint" | "decision" | "identity" | "workflow";
export type MemoryScope = "global" | "project";
export type MemoryStatus = "candidate" | "active" | "archived";

export interface MemoryRecord {
  id: string;
  revision: number;
  scope: MemoryScope;
  projectId?: string;
  kind: MemoryKind;
  title: string;
  content: string;
  summary?: string;
  applicability?: string[];
  verification?: string;
  status: MemoryStatus;
  sourceRefs: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  projectId: string;
  workspace: string;
  client: string;
  task: string;
  mode?: "work" | "maintenance" | "unassigned";
  status: "active" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  sessionId: string;
  type: "observation" | "action" | "result" | "system";
  content: string;
  occurredAt: string;
}

export interface Experience {
  id: string;
  sessionId: string;
  projectId: string;
  summary: string;
  decisions: string[];
  failures: string[];
  nextSteps: string[];
  createdAt: string;
}

export interface Goal {
  id: string;
  projectId?: string;
  title: string;
  status: "active" | "completed" | "blocked";
  updatedAt: string;
}

export interface SkillScript {
  filename: string;
  content: string;
}

export interface SkillBundle {
  name: string;
  description?: string;
  content: string;
  scripts: SkillScript[];
}

export interface SkillItem {
  name: string;
  description?: string;
  scriptCount?: number;
  score?: number;
}

export interface ProjectDetail {
  id: string;
  workspace: string;
  name: string;
  gitRemote?: string;
  description?: string;
  keywords?: string[];
  workspaces?: string[];
  goalsCount: number;
  memoriesCount: number;
  activeGoal?: string;
}

export interface OverviewStats {
  activeSessions: number;
  totalSessions: number;
  pendingCandidates: number;
  activeMemories: number;
  totalSkills: number;
  assistantName: string | null;
  onboardingRequired: boolean;
  capabilities: string[];
}

export interface RuntimeSettings {
  provider: "ollama" | "none";
  ollamaBaseUrl: string;
  ollamaModel: string;
  embeddingProvider: "ollama" | "none";
  embeddingBaseUrl: string;
  embeddingModel: string;
  ragMinScore: number;
  ragMaxResults: number;
  ragMemoryLimit: number;
  ragRecentEventLimit: number;
  ragSkillLimit: number;
  ragIncludeGlobal: boolean;
  autoConsolidation: boolean;
  autoApprovalEnabled: boolean;
  autoApprovalIntervalMinutes: number;
}

export interface ApprovalSweepStatus {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  scanned: number;
  promoted: number;
  archived: number;
  kept: number;
  failed: number;
  remaining: number;
  error: string | null;
}

export interface AutoReviewResult {
  recommendations: Array<{ id: string; title: string; expectedRevision: number; action: "promote" | "archive" | "keep"; reason: string }>;
  total: number;
  promoted: number;
  archived: number;
  kept: number;
  failed: number;
}

export interface RagResult { record: MemoryRecord; score: number; }

export type ProfileCategory = "communication" | "workflow" | "habit" | "taste" | "goal" | "trait" | "life";
export type ProfileOrigin = "stated" | "inferred";
export type ProfileStatus = "active" | "pending" | "disabled";

export interface ProfileEvidence {
  sessionId: string;
  excerpt: string;
  occurredAt: string;
}

export interface ProfileItem {
  id: string;
  category: ProfileCategory;
  statement: string;
  origin: ProfileOrigin;
  confidence: number;
  evidence: ProfileEvidence[];
  status: ProfileStatus;
  inject: boolean;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
  revision: number;
}
