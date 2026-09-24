import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FilesystemSkillEngine } from "../src/index.js";
const roots: string[] = [];
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "jarvis-skills-safe-")); roots.push(root);
  await mkdir(join(root, "skills")); await mkdir(join(root, "outside"));
  await writeFile(join(root, "outside", "SKILL.md"), "outside fixture");
  return { root, engine: new FilesystemSkillEngine(join(root, "skills")) };
}
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
describe("skill root confinement", () => {
  it.each(["../outside", "..", ".", "/tmp/outside", "a/b", "a\\b", ""])("rejects %j on every engine entry point", async name => {
    const { root, engine } = await fixture();
    await expect(engine.load(name)).rejects.toThrow();
    await expect(engine.loadBundle(name)).rejects.toThrow();
    await expect(engine.delete(name)).rejects.toThrow();
    await expect(engine.saveBundle({ name, content: "overwrite", scripts: [] })).rejects.toThrow();
    expect(await readFile(join(root, "outside", "SKILL.md"), "utf8")).toBe("outside fixture");
  });
  it("rejects directory, SKILL.md and scripts symlinks", async () => {
    const { root, engine } = await fixture();
    await symlink(join(root, "outside"), join(root, "skills", "linked"));
    await expect(engine.load("linked")).rejects.toThrow(/Symlinks/);
    await expect(engine.delete("linked")).rejects.toThrow(/Symlinks/);
    await expect(engine.saveBundle({ name: "linked", content: "bad", scripts: [] })).rejects.toThrow(/Symlinks/);
    await mkdir(join(root, "skills", "local"));
    await symlink(join(root, "outside", "SKILL.md"), join(root, "skills", "local", "SKILL.md"));
    await expect(engine.load("local")).rejects.toThrow(/Symlinks/);
    await expect(engine.saveBundle({ name: "local", content: "bad", scripts: [] })).rejects.toThrow(/Symlinks/);
    await rm(join(root, "skills", "local", "SKILL.md")); await writeFile(join(root, "skills", "local", "SKILL.md"), "local");
    await symlink(join(root, "outside"), join(root, "skills", "local", "scripts"));
    await expect(engine.loadBundle("local")).rejects.toThrow(/Symlinks/);
    await expect(engine.saveBundle({ name: "local", content: "bad", scripts: [] })).rejects.toThrow(/Symlinks/);
    expect(await readFile(join(root, "outside", "SKILL.md"), "utf8")).toBe("outside fixture");
  });
  it("validates script paths even when called without HTTP schemas", async () => {
    const { root, engine } = await fixture();
    await expect(engine.saveBundle({ name: "safe", content: "ok", scripts: [{ filename: "../SKILL.md", content: "bad" }] })).rejects.toThrow();
    await expect(engine.saveBundle({ name: "safe", content: "ok", scripts: [{ filename: "..", content: "bad" }] })).rejects.toThrow();
    expect(await readFile(join(root, "outside", "SKILL.md"), "utf8")).toBe("outside fixture");
  });
});
