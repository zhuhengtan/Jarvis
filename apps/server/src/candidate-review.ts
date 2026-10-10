import { memoriesForReview, sameMemoryContent, type DynamicStore, type FileMemoryEngine } from "@jarvis/memory";
import type { CandidateReviewContext, MemoryRecord, MemorySourceEvidence } from "@jarvis/shared";

// Unsupported external/file references stay for human review; never fetch arbitrary candidate URLs.
export async function prepareCandidateReview(candidate: MemoryRecord, dynamic: DynamicStore, memory: FileMemoryEngine): Promise<{ context: CandidateReviewContext } | { reason: string }> {
  if (candidate.scope === "project" && (!candidate.projectId || ["maintenance", "unassigned"].includes(candidate.projectId))) {
    return { reason: "请先人工确认候选归属" };
  }
  if (!candidate.sourceRefs.length || candidate.sourceRefs.length > 20) return { reason: "缺少可核验来源或来源过多，请人工审核" };
  const sources: MemorySourceEvidence[] = [];
  for (const id of new Set(candidate.sourceRefs)) {
    const source = await dynamic.getSourceEvidence(id);
    if (!source?.content.trim() || ["maintenance", "unassigned"].includes(source.projectId) || (candidate.scope === "project" && source.projectId !== candidate.projectId)) {
      return { reason: "来源不存在、暂不支持或项目不匹配，请人工审核" };
    }
    sources.push(source);
  }
  const memories = memoriesForReview(candidate, await memory.allMemories());
  if (memories.some(item => sameMemoryContent(item, candidate))) return { reason: "与现有记忆重复，请人工确认" };
  if (memories.some(item => item.kind === candidate.kind && item.title.trim() === candidate.title.trim())) {
    return { reason: "同名记忆内容不同，可能存在冲突，请人工确认" };
  }
  const context = { sources, memories };
  // Do not silently omit evidence or competing memories to fit the model window.
  if (JSON.stringify({ candidate, context }).length > 60_000) return { reason: "完整审核上下文过大，请人工审核" };
  return { context };
}
