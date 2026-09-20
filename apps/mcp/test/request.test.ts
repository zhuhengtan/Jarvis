import { describe, expect, it } from "vitest";
import { parseApiJson } from "../src/gateway.js";

describe("parseApiJson", () => {
  it("returns null for an empty Fastify body", () => {
    expect(parseApiJson("")).toBeNull();
    expect(parseApiJson("   \n")).toBeNull();
  });

  it("parses JSON including explicit null", () => {
    expect(parseApiJson("null")).toBeNull();
    expect(parseApiJson('{"title":"goal"}')).toEqual({ title: "goal" });
  });
});
