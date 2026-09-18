import { newId, now, type Experience, type MemoryRecord } from "@jarvis/shared";

export class ReflectionEngine {
  candidates(experience: Experience): MemoryRecord[] {
    const facts = [
      ...experience.decisions.map((content) => ({ kind: "decision" as const, title: "经过验证的会话决策", content, prefix: "决策" })),
      ...experience.failures.map((content) => ({ kind: "constraint" as const, title: "可复用的问题与限制", content, prefix: "问题" })),
    ];
    return facts.filter(({ content }) => content.trim()).map((fact) => ({
      id: newId("memory"), revision: 1, scope: "project", projectId: experience.projectId, kind: fact.kind,
      title: fact.title,
      summary: `${fact.prefix}：${fact.content.slice(0, 120)}`,
      content: [`背景：本条结论来自一次已记录的任务经验。`, `${fact.prefix}：${fact.content.trim()}`, `任务总结：${experience.summary.trim()}`, `适用范围：仅适用于项目 ${experience.projectId}，除非后续审阅明确提升为全局规则。`, "证据状态：来自会话经验，需结合来源引用复核。"].join("\n"),
      applicability: [`project:${experience.projectId}`], verification: "来源已关联，等待规则审核", status: "candidate", sourceRefs: [experience.id], createdAt: now(), updatedAt: now()
    }));
  }
}
