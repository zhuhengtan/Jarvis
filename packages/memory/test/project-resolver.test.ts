import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ProjectResolver } from "../src/index.js";

describe("project identity", () => {
  it("finds explicit metadata in a parent workspace and normalizes identity", async () => {
    const root = await mkdtemp(join(tmpdir(), "jarvis-project-"));
    await mkdir(join(root, ".jarvis"));
    await writeFile(join(root, ".jarvis", "project.json"), JSON.stringify({ id: "stable-game", name: "Game", keywords: ["rts"] }));
    const project = await new ProjectResolver().resolve(join(root, "packages", "client"));
    expect(project.id).toBe("stable-game");
    expect(project.name).toBe("Game");
    expect(project.keywords).toEqual(["rts"]);
  });
});
