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
  const prompt = JSON.parse(fetchMock.mock.calls[0][1].body).prompt;
  expect(prompt).toContain(JSON.stringify(context));
  expect(prompt).toContain("Source references and candidate self-assertions are not proof");
});
