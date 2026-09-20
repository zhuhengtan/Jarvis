import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ProjectResolver } from "../src/index.js";

const exec = promisify(execFile);

async function initRepo(dir: string, remote: string) {
  await mkdir(dir, { recursive: true });
  await exec("git", ["init", "-q", dir]);
  await exec("git", ["-C", dir, "remote", "add", "origin", remote]);
}

describe("project identity", () => {
  it("finds explicit metadata in a parent workspace and normalizes identity", async () => {
    const root = await mkdtemp(join(tmpdir(), "jarvis-project-"));
    await mkdir(join(root, ".jarvis"));
    await writeFile(join(root, ".jarvis", "project.json"), JSON.stringify({ id: "stable-game", name: "Game", keywords: ["rts"] }));
    const { project } = await new ProjectResolver().resolve(join(root, "packages", "client"));
    expect(project.id).toBe("stable-game");
    expect(project.name).toBe("Game");
    expect(project.keywords).toEqual(["rts"]);
  });

  it("binds a non-git parent to a unique nested project.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "jarvis-nested-meta-"));
    const child = join(root, "app");
    await mkdir(join(child, ".jarvis"), { recursive: true });
    await writeFile(join(child, ".jarvis", "project.json"), JSON.stringify({ id: "unique-app", name: "App" }));
    const { project, identityWarning } = await new ProjectResolver().resolve(root);
    expect(project.id).toBe("unique-app");
    expect(project.name).toBe("App");
    expect(project.workspace).toBe(root);
    expect(project.workspaces).toEqual(expect.arrayContaining([root, child]));
    expect(identityWarning).toBeUndefined();
  });

  it("prefers a unique nested project.json among multiple git children", async () => {
    const parent = await mkdtemp(join(tmpdir(), "jarvis-meta-wins-"));
    await initRepo(join(parent, "Jarvis"), "git@github.com:zhuhengtan/Jarvis.git");
    await initRepo(join(parent, "searxng"), "https://github.com/searxng/searxng.git");
    await mkdir(join(parent, "Jarvis", ".jarvis"), { recursive: true });
    await writeFile(join(parent, "Jarvis", ".jarvis", "project.json"), JSON.stringify({ id: "jarvis", name: "Jarvis" }));
    const { project, identityWarning } = await new ProjectResolver().resolve(parent);
    expect(project.id).toBe("jarvis");
    expect(project.name).toBe("Jarvis");
    expect(identityWarning).toBeUndefined();
  });

  it("prefers a same-named git child over other nested repositories", async () => {
    const parent = join(await mkdtemp(join(tmpdir(), "jarvis-same-")), "Jarvis");
    await initRepo(join(parent, "Jarvis"), "git@github.com:zhuhengtan/Jarvis.git");
    await initRepo(join(parent, "searxng"), "https://github.com/searxng/searxng.git");
    const { project, identityWarning, containedProjects } = await new ProjectResolver().resolve(parent);
    expect(project.gitRemote).toBe("https://github.com/zhuhengtan/jarvis");
    expect(project.id).toMatch(/^project_/);
    expect(identityWarning).toBeUndefined();
    expect(containedProjects).toBeUndefined();
  });

  it("warns instead of binding when multiple nested git repos are ambiguous", async () => {
    const parent = await mkdtemp(join(tmpdir(), "jarvis-multi-"));
    await initRepo(join(parent, "searxng"), "https://github.com/searxng/searxng.git");
    await initRepo(join(parent, "open-webui"), "https://github.com/open-webui/open-webui.git");
    const { project, identityWarning, containedProjects } = await new ProjectResolver().resolve(parent);
    expect(project.id.startsWith("project_")).toBe(true);
    expect(project.gitRemote).toBeUndefined();
    expect(identityWarning).toMatch(/多个嵌套项目/);
    expect(containedProjects?.map((item) => item.name).sort()).toEqual(["open-webui", "searxng"]);
    expect(containedProjects?.some((item) => item.gitRemote?.includes("searxng"))).toBe(true);
  });
});
