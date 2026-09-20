import { describe, expect, it } from "vitest";
import { parseCandidateReview, parseExtractedFacts, parseOllamaJson, titleFrom } from "../src/index.js";

describe("parseExtractedFacts", () => {
  it("accepts objects, string items and unknown kinds", () => {
    expect(parseExtractedFacts([{ kind: "decision", title: "PG", content: "Use PostgreSQL" }, "plain fact", { kind: "nope", content: "still a fact" }])).toEqual([
      { kind: "decision", title: "PG", content: "Use PostgreSQL" },
      { kind: "fact", title: "plain fact", content: "plain fact" },
      { kind: "fact", title: "still a fact", content: "still a fact" },
    ]);
  });

  it("returns empty for invalid payloads", () => {
    expect(parseExtractedFacts(null)).toEqual([]);
    expect(parseExtractedFacts({})).toEqual([]);
  });
});

describe("titleFrom", () => {
  it("truncates to 40 characters", () => {
    expect(titleFrom("  a".repeat(30)).length).toBeLessThanOrEqual(40);
  });
});

describe("parseCandidateReview", () => {
  it("keeps invalid actions safe and accepts valid decisions", () => {
    expect(parseCandidateReview({ action: "promote", reason: "有来源且内容具体" })).toEqual({ action: "promote", reason: "有来源且内容具体" });
    expect(parseCandidateReview({ action: "delete", reason: "不支持" })).toEqual({ action: "keep", reason: "不支持" });
  });
});

describe("parseOllamaJson", () => {
  it("uses thinking when qwen leaves response empty", () => {
    expect(parseOllamaJson("", '{"action":"keep","reason":"需要人工确认"}')).toEqual({ action: "keep", reason: "需要人工确认" });
  });

  it("strips a JSON code fence and short preamble", () => {
    expect(parseOllamaJson("结果如下：```json\n[{\"content\":\"事实\"}]\n```" )).toEqual([{ content: "事实" }]);
  });
});
