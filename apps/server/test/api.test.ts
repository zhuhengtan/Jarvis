import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { JarvisRuntime } from "../src/runtime.js";
import { publicRoutes } from "../src/routes/api.js";

const exec = promisify(execFile);

describe("public API routes", () => {
  let tmp: string;
  let runtime: JarvisRuntime;
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    tmp = await mkdtemp(join(tmpdir(), "jarvis-api-test-"));
    runtime = await JarvisRuntime.create({
      assistantName: "TestJarvis",
      memoryRoot: join(tmp, "memory"),
      skillsRoot: join(tmp, "skills"),
    });
    app = Fastify();
    await app.register(cors);
    await app.register(publicRoutes, { runtime });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await rm(tmp, { recursive: true, force: true });
  });

  it("returns JSON null when a project has no active goal", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/goals/active?projectId=project-missing",
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.trim()).toBe("null");
    expect(res.json()).toBeNull();
  });

  it("returns the active goal after creation", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/v1/goals",
      payload: { projectId: "project-api", title: "Ship P0 fixes" },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().title).toBe("Ship P0 fixes");

    const res = await app.inject({
      method: "GET",
      url: "/v1/goals/active?projectId=project-api",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ projectId: "project-api", title: "Ship P0 fixes", status: "active" });
  });

  it("surfaces identityWarning when opening an ambiguous multi-repo workspace", async () => {
    const parent = join(tmp, "multi-workspace");
    await mkdir(join(parent, "searxng"), { recursive: true });
    await mkdir(join(parent, "open-webui"), { recursive: true });
    await exec("git", ["init", "-q", join(parent, "searxng")]);
    await exec("git", ["-C", join(parent, "searxng"), "remote", "add", "origin", "https://github.com/searxng/searxng.git"]);
    await exec("git", ["init", "-q", join(parent, "open-webui")]);
    await exec("git", ["-C", join(parent, "open-webui"), "remote", "add", "origin", "https://github.com/open-webui/open-webui.git"]);

    const opened = await runtime.openSession({ client: "test", workspace: parent, task: "audit identity" });
    expect(opened.identityWarning).toMatch(/多个嵌套项目/);
    expect(opened.containedProjects?.map((item) => item.name).sort()).toEqual(["open-webui", "searxng"]);
    expect(opened.project.gitRemote).toBeUndefined();
  });
});
