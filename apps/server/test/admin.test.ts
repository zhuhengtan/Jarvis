import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JarvisRuntime } from "../src/runtime.js";
import { adminRoutes } from "../src/routes/admin.js";

describe("Admin API Routes", () => {
  let tmp: string;
  let runtime: JarvisRuntime;
  let app: ReturnType<typeof Fastify>;
  const adminToken = "test-admin-secret";

  beforeAll(async () => {
    process.env.JARVIS_ADMIN_KEY = adminToken;
    tmp = await mkdtemp(join(tmpdir(), "jarvis-admin-test-"));
    runtime = await JarvisRuntime.create({
      assistantName: "TestJarvis",
      memoryRoot: join(tmp, "memory"),
      skillsRoot: join(tmp, "skills"),
    });

    app = Fastify();
    await app.register(cors);
    await app.register(adminRoutes, { prefix: "/v1/admin", runtime });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await rm(tmp, { recursive: true, force: true });
  });

  it("fails login with invalid token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/admin/auth/login",
      payload: { token: "wrong" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("succeeds login with valid token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/admin/auth/login",
      payload: { token: adminToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.token).toBe(adminToken);
  });

  it("rejects unauthorized access to protected endpoints", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/overview",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns overview stats when authorized", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/overview",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.assistantName).toBe("TestJarvis");
    expect(typeof data.activeSessions).toBe("number");
  });

  it("reads and updates runtime settings and exposes RAG search", async () => {
    const settingsRes = await app.inject({
      method: "GET",
      url: "/v1/admin/settings",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(settingsRes.statusCode).toBe(200);
    const settings = settingsRes.json();
    expect(settings.embeddingModel).toBe("nomic-embed-text");

    const updateRes = await app.inject({
      method: "PUT",
      url: "/v1/admin/settings",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { ...settings, embeddingProvider: "ollama", ragMinScore: 2 },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().ragMinScore).toBe(2);

    const ragRes = await app.inject({
      method: "GET",
      url: "/v1/admin/rag/search?query=",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(ragRes.statusCode).toBe(200);
    expect(Array.isArray(ragRes.json())).toBe(true);
  });

  it("manages candidates: list, edit, and promote", async () => {
    // 1. Create a session & candidate
    const sessionRes = await runtime.openSession({
      workspace: tmp,
      client: "test-client",
      task: "Test Task",
    });
    const candidate = await runtime.rememberCandidate(sessionRes.session.id, {
      kind: "preference",
      title: "Draft Preference",
      content: "Draft memory content",
      sourceRefs: ["session_test"],
      scope: "project",
    });

    // 2. List candidates via admin API
    const listRes = await app.inject({
      method: "GET",
      url: "/v1/admin/candidates",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const candidates = listRes.json();
    expect(candidates.some((c: any) => c.id === candidate.id)).toBe(true);

    // 3. Edit candidate via admin API
    const editRes = await app.inject({
      method: "PUT",
      url: `/v1/admin/candidates/${candidate.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: "Updated Preference Title",
        content: "Updated memory content",
      },
    });
    expect(editRes.statusCode).toBe(200);
    expect(editRes.json().title).toBe("Updated Preference Title");

    // 4. Promote candidate via admin API
    const promoteRes = await app.inject({
      method: "POST",
      url: `/v1/admin/candidates/${candidate.id}/promote`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { expectedRevision: 1 },
    });
    expect(promoteRes.statusCode).toBe(200);
    expect(promoteRes.json().status).toBe("active");
  });

  it("archives candidate successfully", async () => {
    const sessionRes = await runtime.openSession({
      workspace: tmp,
      client: "test-client-2",
      task: "Test Task 2",
    });
    const candidate = await runtime.rememberCandidate(sessionRes.session.id, {
      kind: "decision",
      title: "Decision to Archive",
      content: "Content to archive",
      sourceRefs: [],
      scope: "project",
    });

    const archiveRes = await app.inject({
      method: "POST",
      url: `/v1/admin/candidates/${candidate.id}/archive`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(archiveRes.statusCode).toBe(200);
    expect(archiveRes.json().record.status).toBe("archived");
  });

  it("lists sessions and projects", async () => {
    const sessionsRes = await app.inject({
      method: "GET",
      url: "/v1/admin/sessions",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(sessionsRes.statusCode).toBe(200);
    expect(Array.isArray(sessionsRes.json())).toBe(true);

    const projectsRes = await app.inject({
      method: "GET",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(projectsRes.statusCode).toBe(200);
    expect(Array.isArray(projectsRes.json())).toBe(true);
  });

  it("registers and deletes projects", async () => {
    const projectWorkspace = join(tmp, "test-registered-project");
    const regRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        workspace: projectWorkspace,
        name: "Custom Registered Project",
        initialGoal: "Build new features",
      },
    });
    expect(regRes.statusCode).toBe(200);
    const project = regRes.json();
    expect(project.name).toBe("Custom Registered Project");

    // Verify it lists in GET /v1/admin/projects
    const listRes = await app.inject({
      method: "GET",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const projects = listRes.json();
    expect(projects.some((p: any) => p.id === project.id)).toBe(true);

    // Delete project
    const delRes = await app.inject({
      method: "DELETE",
      url: `/v1/admin/projects/${project.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(delRes.statusCode).toBe(200);
  });

  it("creates, retrieves, and deletes skill bundle with scripts", async () => {
    const skillName = "code-review-pro";
    const saveRes = await app.inject({
      method: "POST",
      url: "/v1/admin/skills",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: skillName,
        description: "Comprehensive code review skill with verify script",
        content: "# Code Review\n\nRun scripts/verify.sh before approving.",
        scripts: [
          {
            filename: "verify.sh",
            content: "#!/bin/bash\necho 'Running verification...'\nexit 0\n",
          },
        ],
      },
    });
    expect(saveRes.statusCode).toBe(200);

    // Load bundle
    const bundleRes = await app.inject({
      method: "GET",
      url: `/v1/admin/skills/${skillName}/bundle`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(bundleRes.statusCode).toBe(200);
    const bundle = bundleRes.json();
    expect(bundle.name).toBe(skillName);
    expect(bundle.scripts.length).toBe(1);
    expect(bundle.scripts[0].filename).toBe("verify.sh");
    expect(bundle.scripts[0].content).toContain("Running verification");

    // Delete skill
    const delRes = await app.inject({
      method: "DELETE",
      url: `/v1/admin/skills/${skillName}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().success).toBe(true);
  });
});
