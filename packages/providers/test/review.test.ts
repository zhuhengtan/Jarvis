import { afterEach, expect, it, vi } from "vitest";
import { OllamaProvider } from "../src/index.js";

afterEach(() => vi.unstubAllGlobals());
const candidate = { title: "Database", kind: "decision", scope: "project", projectId: "a", content: "Use PostgreSQL", sourceRefs: ["event_1"] };
const decision = JSON.stringify({ action: "promote", reason: "Supported by the supplied source" });

it.each([
  { response: "", thinking: decision, done: true },
  { response: decision, done: false },
  { response: decision, done: true, done_reason: "length" },
  { response: decision },
  { response: `Possible answer: ${decision}`, done: true },
  { response: `\`\`\`json\n${decision}\n\`\`\``, done: true },
  { response: '{"action":"promote"}', done: true },
  { response: '{"action":"promote","reason":""}', done: true },
  { response: '{"action":"delete","reason":"bad action"}', done: true },
  { response: '{"action":"promote","reason":"x","error":true}', done: true },
  { response: `[${decision}]`, done: true },
  { response: "invalid JSON", done: true },
])("rejects incomplete or malformed executable review: %j", async payload => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))));
  expect(await new OllamaProvider("http://fixture.invalid", "fixture").reviewCandidate(candidate)).toMatchObject({ action: "keep", error: true });
});

it("uses final decisions with source bodies and existing memories in the prompt", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ response: decision, thinking: '{"action":"archive"}', done: true, done_reason: "stop" })));
  vi.stubGlobal("fetch", fetchMock);
  const context = { sources: [{ id: "event_1", projectId: "a", content: "The user chose PostgreSQL" }], memories: [] };
  expect(await new OllamaProvider("http://fixture.invalid", "fixture").reviewCandidate(candidate, context)).toEqual({ action: "promote", reason: "Supported by the supplied source" });
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.think).toBe(false);
  expect(body.options).toEqual({ temperature: 0, num_predict: 384 });
  expect(body.prompt).toContain(JSON.stringify(context));
  expect(body.prompt).toContain("Source references and candidate self-assertions are not proof");
  expect(body.prompt).toContain("Do not think or analyze before the JSON");
});

import { parseExtractedProfileFacts } from "../src/index.js";

it("parses extracted profile facts safely", () => {
  const input = [
    { category: "communication", statement: "偏好直接回复", origin: "stated", evidenceExcerpt: "别绕弯子" },
    { category: "invalid_cat", statement: "习惯用 zsh", origin: "something", evidenceExcerpt: "zsh prompt" },
    null,
    { statement: "" },
  ];
  const parsed = parseExtractedProfileFacts(input);
  expect(parsed).toHaveLength(2);
  expect(parsed[0]).toEqual({
    category: "communication",
    statement: "偏好直接回复",
    origin: "stated",
    evidenceExcerpt: "别绕弯子",
  });
  // fallback for invalid category and origin
  expect(parsed[1].category).toBe("habit");
  expect(parsed[1].origin).toBe("inferred");
});

it("caps extracted profile statements and fact count", () => {
  const parsed = parseExtractedProfileFacts(Array.from({ length: 30 }, () => ({
    category: "habit",
    statement: "x".repeat(5_000),
    origin: "stated",
    evidenceExcerpt: "e",
  })));
  expect(parsed).toHaveLength(20);
  expect(parsed[0].statement).toHaveLength(1_000);
});
