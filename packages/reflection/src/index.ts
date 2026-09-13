import { newId, now, type Experience, type MemoryRecord } from "@jarvis/shared";

export class ReflectionEngine {
  candidates(experience: Experience): MemoryRecord[] {
    const facts = [...experience.decisions.map((content) => ({ kind: "decision" as const, title: "Session decision", content })), ...experience.failures.map((content) => ({ kind: "constraint" as const, title: "Observed failure", content }))];
    return facts.filter(({ content }) => content.trim()).map((fact) => ({ id: newId("memory"), revision: 1, scope: "project", projectId: experience.projectId, kind: fact.kind, title: fact.title, content: fact.content, status: "candidate", sourceRefs: [experience.id], createdAt: now(), updatedAt: now() }));
  }
}
