import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

describe("PostgresDynamicStore SQL", () => {
  it("does not backslash-escape camelCase column aliases", async () => {
    const source = await readFile(fileURLToPath(new URL("../src/index.ts", import.meta.url)), "utf8");
    expect(source).not.toMatch(/AS \\+"/);
  });
});
