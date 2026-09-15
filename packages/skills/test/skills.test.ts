import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FilesystemSkillEngine } from "../src/index.js";

describe("FilesystemSkillEngine", () => {
  let tmp: string;
  let engine: FilesystemSkillEngine;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "jarvis-skills-test-"));
    engine = new FilesystemSkillEngine(tmp);
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("extracts multiline YAML folded description properly", async () => {
    const skillDir = join(tmp, "card-game");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "SKILL.md"),
      `---
name: card-game
description: >
  Build a card game: card data, deck/hand/discard zones, draw/shuffle/reshuffle, a turn structure,
  costs, and effect resolution. Use for a deckbuilder, TCG/CCG, or roguelike deckbuilder.
---

# Card Game
Content here.`,
      "utf8"
    );

    const results = await engine.search("deckbuilder");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("card-game");
    expect(results[0].description).toBe(
      "Build a card game: card data, deck/hand/discard zones, draw/shuffle/reshuffle, a turn structure, costs, and effect resolution. Use for a deckbuilder, TCG/CCG, or roguelike deckbuilder."
    );
  });

  it("extracts single-line YAML description", async () => {
    const skillDir = join(tmp, "memory-review");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "SKILL.md"),
      `---
name: memory-review
description: 记忆梳理、提炼与审核技能。
---

# 记忆梳理`,
      "utf8"
    );

    const results = await engine.search("梳理");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("memory-review");
    expect(results[0].description).toBe("记忆梳理、提炼与审核技能。");
  });

  it("falls back to first non-comment line when no YAML frontmatter", async () => {
    const skillDir = join(tmp, "weather");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "SKILL.md"),
      `# 天气预报

查询用户指定地点的当前天气或未来预报。`,
      "utf8"
    );

    const results = await engine.search("天气");
    expect(results).toHaveLength(1);
    expect(results[0].description).toBe("查询用户指定地点的当前天气或未来预报。");
  });
});
