import { newId, now } from "@jarvis/shared";
export class ReflectionEngine {
    candidates(experience) {
        const facts = [...experience.decisions.map((content) => ({ kind: "decision", title: "Session decision", content })), ...experience.failures.map((content) => ({ kind: "constraint", title: "Observed failure", content }))];
        return facts.filter(({ content }) => content.trim()).map((fact) => ({ id: newId("memory"), revision: 1, scope: "project", projectId: experience.projectId, kind: fact.kind, title: fact.title, content: fact.content, status: "candidate", sourceRefs: [experience.id], createdAt: now(), updatedAt: now() }));
    }
}
//# sourceMappingURL=index.js.map