import axios from "axios";
import type {
  MemoryRecord,
  Session,
  Event,
  Experience,
  Goal,
  SkillItem,
  OverviewStats,
  ProjectDetail,
  SkillBundle,
} from "../types";

const client = axios.create({
  baseURL: "/v1/admin",
  headers: {
    "Content-Type": "application/json",
  },
});

// Root API client for non-admin endpoints (like /v1/identity/name)
const rootClient = axios.create({
  baseURL: "/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("JARVIS_ADMIN_TOKEN");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

rootClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("JARVIS_ADMIN_TOKEN");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.endsWith("/login")) {
      localStorage.removeItem("JARVIS_ADMIN_TOKEN");
      window.location.href = "/login";
    }
    const message = error.response?.data?.error || error.message || "Request failed";
    return Promise.reject(new Error(message));
  }
);

rootClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error || error.message || "Request failed";
    return Promise.reject(new Error(message));
  }
);

export const api = {
  // Auth
  login: (token: string): Promise<{ success: boolean; token: string; user: { name: string; role: string } }> =>
    client.post("/auth/login", { token }),

  // Overview
  getOverview: (): Promise<OverviewStats> => client.get("/overview"),

  // Candidates
  getCandidates: (projectId?: string): Promise<MemoryRecord[]> =>
    client.get("/candidates", { params: projectId ? { projectId } : {} }),

  updateCandidate: (
    id: string,
    data: { title?: string; content?: string; kind?: string }
  ): Promise<MemoryRecord> => client.put(`/candidates/${encodeURIComponent(id)}`, data),

  promoteCandidate: (id: string, expectedRevision: number): Promise<MemoryRecord> =>
    client.post(`/candidates/${encodeURIComponent(id)}/promote`, { expectedRevision }),

  archiveCandidate: (id: string): Promise<{ success: boolean; record?: MemoryRecord }> =>
    client.post(`/candidates/${encodeURIComponent(id)}/archive`),

  // Memories
  getMemories: (projectId?: string, query?: string): Promise<MemoryRecord[]> =>
    client.get("/memories", { params: { projectId, query } }),

  // Sessions
  getSessions: (params?: { projectId?: string; status?: "active" | "closed"; limit?: number }): Promise<Session[]> =>
    client.get("/sessions", { params }),

  getSessionDetail: (
    id: string
  ): Promise<{ session: Session; events: Event[]; experiences: Experience[] }> =>
    client.get(`/sessions/${encodeURIComponent(id)}`),

  // Projects
  getProjects: (): Promise<ProjectDetail[]> => client.get("/projects"),

  createProject: (data: { workspace: string; name?: string; initialGoal?: string }): Promise<ProjectDetail> =>
    client.post("/projects", data),

  deleteProject: (id: string): Promise<{ success: boolean }> =>
    client.delete(`/projects/${encodeURIComponent(id)}`),

  // Goals
  getGoals: (projectId: string): Promise<Goal[]> =>
    client.get("/goals", { params: { projectId } }),

  // Skills
  getSkills: (query = ""): Promise<SkillItem[]> =>
    client.get("/skills", { params: { query } }),

  getSkillDetail: (name: string): Promise<{ name: string; content: string }> =>
    client.get(`/skills/${encodeURIComponent(name)}`),

  getSkillBundle: (name: string): Promise<SkillBundle> =>
    client.get(`/skills/${encodeURIComponent(name)}/bundle`),

  saveSkillBundle: (bundle: SkillBundle): Promise<{ success: boolean; bundle: SkillBundle }> =>
    client.post("/skills", bundle),

  updateSkillBundle: (name: string, bundle: SkillBundle): Promise<{ success: boolean; bundle: SkillBundle }> =>
    client.put(`/skills/${encodeURIComponent(name)}`, bundle),

  deleteSkill: (name: string): Promise<{ success: boolean }> =>
    client.delete(`/skills/${encodeURIComponent(name)}`),

  // Identity
  setAssistantName: (name: string): Promise<{ assistantName: string }> =>
    rootClient.put("/identity/name", { name }),
};
