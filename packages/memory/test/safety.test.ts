import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileMemoryEngine, JsonlDynamicStore, MarkdownMemoryStore, ProjectResolver } from "../src/index.js";

const roots: string[] = [];
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "jarvis-safety-")); roots.push(root);
  const store = new MarkdownMemoryStore(join(root, "memory"));
  const engine = new FileMemoryEngine(store, new JsonlDynamicStore(join(root, "runtime")));
  return { root, store, engine };
}
const input = { scope: "project" as const, projectId: "a", kind: "fact" as const, title: "Reviewed fixture", content: "unverified speculation ".repeat(8), sourceRefs: ["nonexistent-source"] };
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

describe("memory path boundaries", () => {
  it.each(["../outside", "../../outside", "/tmp/outside", "a/b", "a\\b", "..", ".", ""])("rejects unsafe project ID %j at reads and writes", async projectId => {
    const { root, engine, store } = await fixture();
    await expect(engine.saveCandidate({ ...input, projectId })).rejects.toThrow();
    await expect(store.list("project", projectId)).rejects.toThrow();
    await mkdir(join(root, "workspace", ".jarvis"), { recursive: true });
    await writeFile(join(root, "workspace", ".jarvis", "project.json"), JSON.stringify({ id: projectId }));
    await expect(new ProjectResolver().resolve(join(root, "workspace"))).rejects.toThrow();
  });
  it("rejects symlinked project directories and record files", async () => {
    const { root, engine, store } = await fixture();
    await mkdir(join(root, "outside")); await mkdir(join(root, "memory", "projects"), { recursive: true });
    await symlink(join(root, "outside"), join(root, "memory", "projects", "a"));
    await expect(engine.saveCandidate(input)).rejects.toThrow(/Symlinks/);
    await expect(store.list("project", "a")).rejects.toThrow(/Symlinks/);
    const c = await engine.saveCandidate({ ...input, projectId: "b" });
    const path = join(root, "memory", "projects", "b", `${c.id}.md`);
    const original = await readFile(path, "utf8"); await writeFile(join(root, "outside", "source.md"), original); await rm(path);
    await symlink(join(root, "outside", "source.md"), path);
    await expect(engine.promote({ record: c, expectedRevision: 1 })).rejects.toThrow();
    expect(await readFile(join(root, "outside", "source.md"), "utf8")).toBe(original);
  });
});

describe("review and revision boundaries", () => {
  it("never automatically promotes even long source-labelled candidates", async () => {
    const { engine } = await fixture();
    for (const projectId of ["a", "maintenance", "unassigned"]) await engine.saveCandidate({ ...input, projectId });
    expect(await engine.consolidate()).toEqual({ promoted: 0, archived: 0 });
    expect((await engine.candidates()).length).toBe(3);
  });
  it("rejects stale edits and promotion, including edits from another store instance", async () => {
    const { root, engine } = await fixture();
    const other = new FileMemoryEngine(new MarkdownMemoryStore(join(root, "memory")), new JsonlDynamicStore(join(root, "runtime")));
    const old = await engine.saveCandidate(input);
    const edited = await other.updateCandidate(old.id, { content: "new evidence" }, old.revision);
    expect(edited.revision).toBe(2);
    await expect(engine.promote({ record: old, expectedRevision: 1 })).rejects.toThrow(/revision conflict/);
    await expect(engine.updateCandidate(old.id, { content: "stale edit" }, 1)).rejects.toThrow(/revision conflict/);
    const active = await engine.promote({ record: edited, expectedRevision: 2 });
    expect(active.content).toBe("new evidence"); expect(active.revision).toBe(3);
    await expect(other.updateCandidate(active.id, { content: "bypass review" }, 3)).rejects.toThrow(/Only candidate/);
    await expect(engine.promote({ record: active, expectedRevision: 3 })).rejects.toThrow(/Only a current candidate/);
  });
  it("invalidates snapshots after archive or reassign", async () => {
    const { engine } = await fixture();
    const archived = await engine.saveCandidate(input);
    expect((await engine.archiveCandidate(archived.id, 1)).revision).toBe(2);
    await expect(engine.promote({ record: archived, expectedRevision: 1 })).rejects.toThrow(/revision conflict/);
    const c = await engine.saveCandidate(input);
    const moved = await engine.reassignCandidate(c.id, "b", 1);
    expect(moved.revision).toBe(2); expect(moved.applicability).toEqual(["project:b"]);
    await expect(engine.promote({ record: c, expectedRevision: 1 })).rejects.toThrow(/revision conflict/);
    expect((await engine.promote({ record: moved, expectedRevision: 2 })).projectId).toBe("b");
  });
  it.each(["maintenance", "unassigned"])("requires a concrete project before explicit promotion of %s", async projectId => {
    const { engine } = await fixture(); const c = await engine.saveCandidate({ ...input, projectId });
    await expect(engine.promote({ record: c, expectedRevision: 1 })).rejects.toThrow(/concrete project/);
  });
  it("allows only one concurrent promotion of the same revision", async () => {
    const { engine } = await fixture(); const c = await engine.saveCandidate(input);
    const results = await Promise.allSettled([engine.promote({ record: c, expectedRevision: 1 }), engine.promote({ record: c, expectedRevision: 1 })]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect((await engine.allMemories())[0].revision).toBe(2);
  });
});
