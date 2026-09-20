import { newId, now, type Experience, type ExtractedFact, type ExtractedKind, type MemoryKind, type MemoryRecord } from "@jarvis/shared";

const prefixes: Record<ExtractedKind, string> = { decision: "决策", constraint: "问题", fact: "事实", workflow: "流程" };

export function titleFrom(content: string) {
  const compact = content.trim().replace(/\s+/g, " ");
  return compact.slice(0, 40) || "会话结论";
}

export class ReflectionEngine {
  candidates(experience: Experience, extras: ExtractedFact[] = []): MemoryRecord[] {
    const facts: ExtractedFact[] = [];
    const seen = new Set<string>();
    const push = (kind: ExtractedKind, content: string, title?: string) => {
      const trimmed = content.trim();
      const key = trimmed.toLowerCase();
      if (!trimmed || seen.has(key)) return;
      seen.add(key);
      facts.push({ kind, content: trimmed, title: title?.trim() || titleFrom(trimmed) });
    };
    for (const content of experience.decisions) push("decision", content);
    for (const content of experience.failures) push("constraint", content);
    for (const extra of extras) push(extra.kind, extra.content, extra.title);
    if (!facts.length && experience.summary.trim()) push("fact", experience.summary);
    return facts.map((fact) => {
      const prefix = prefixes[fact.kind];
      return {
        id: newId("memory"), revision: 1, scope: "project" as const, projectId: experience.projectId, kind: fact.kind as MemoryKind,
        title: fact.title.slice(0, 40),
        summary: `${prefix}：${fact.content.slice(0, 120)}`,
        content: [`背景：本条结论来自一次已记录的任务经验。`, `${prefix}：${fact.content}`, `任务总结：${experience.summary.trim()}`, `适用范围：仅适用于项目 ${experience.projectId}，除非后续审阅明确提升为全局规则。`, "证据状态：来自会话经验，需结合来源引用复核。"].join("\n"),
        applicability: [`project:${experience.projectId}`], verification: "来源已关联，等待规则审核", status: "candidate" as const, sourceRefs: [experience.id], createdAt: now(), updatedAt: now(),
      };
    });
  }
}
