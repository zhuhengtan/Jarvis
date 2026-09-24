import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, realpath, symlink, writeFile } from "node:fs/promises";
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
    expect(project.workspace).toBe(await realpath(root));
    expect(project.workspaces).toEqual(expect.arrayContaining([await realpath(root), await realpath(child)]));
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

it("does not inherit metadata across a nested independent Git boundary", async () => {
  const parent = await mkdtemp(join(tmpdir(), "jarvis-boundary-"));
  await initRepo(parent, "https://example.invalid/parent.git");
  await mkdir(join(parent, ".jarvis"));
  await writeFile(join(parent, ".jarvis", "project.json"), JSON.stringify({ id: "parent-project" }));
  const child = join(parent, "child");
  await initRepo(child, "https://example.invalid/child.git");
  await mkdir(join(child, "src"));
  const resolver = new ProjectResolver();
  const childRoot = (await resolver.resolve(child)).project;
  const childSub = (await resolver.resolve(join(child, "src"))).project;
  expect(childRoot.id).not.toBe("parent-project");
  expect(childSub.id).toBe(childRoot.id);
  expect(childSub.gitRemote).toBe("https://example.invalid/child");
});

it("uses one identity for a no-remote repo root, subdirectory and symlink", async () => {
  const parent = await mkdtemp(join(tmpdir(), "jarvis-canonical-"));
  const root = join(parent, "repo"); await mkdir(join(root, "src"), { recursive: true });
  await exec("git", ["init", "-q", root]);
  await symlink(root, join(parent, "alias"));
  const resolver = new ProjectResolver();
  const projects = await Promise.all([root, join(root, "src"), join(parent, "alias")].map(path => resolver.resolve(path)));
  expect(new Set(projects.map(result => result.project.id)).size).toBe(1);
  expect(projects[2].project.workspace).toBe(await realpath(root));
});

it("keeps a wrapper and registered subdirectory bound to the same no-remote repo", async () => {
  const wrapper = await mkdtemp(join(tmpdir(), "jarvis-wrapper-"));
  const repo = join(wrapper, "repo"); await mkdir(join(repo, "src"), { recursive: true });
  await exec("git", ["init", "-q", repo]);
  const resolver = new ProjectResolver();
  const identity = (await resolver.resolve(repo)).project.id;
  expect((await resolver.resolve(wrapper)).project.id).toBe(identity);
  expect((await resolver.register(join(repo, "src"))).id).toBe(identity);
  expect((await resolver.resolve(join(repo, "missing", "sub"))).project.id).toBe(identity);
});
