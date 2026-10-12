import { memoriesForReview, sameMemoryContent, type DynamicStore, type FileMemoryEngine } from "@jarvis/memory";
import type { CandidateReviewContext, MemoryRecord, MemorySourceEvidence } from "@jarvis/shared";

const reviewContextLimit = 60_000;

function reviewSize(candidate: MemoryRecord, sources: MemorySourceEvidence[], memories: MemoryRecord[]) {
  return JSON.stringify({ candidate, context: { sources, memories } }).length;
}

// Unsupported external/file references stay for human review; never fetch arbitrary candidate URLs.
// Oversized packets are kept for a person. Do not drop competing memory bodies and then auto-decide.
export async function prepareCandidateReview(candidate: MemoryRecord, dynamic: DynamicStore, memory: FileMemoryEngine, knownRecords?: MemoryRecord[]): Promise<{ context: CandidateReviewContext; snapshot: Array<{ id: string; revision: number }> } | { reason: string }> {
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
  const memories = memoriesForReview(candidate, knownRecords ?? await memory.allMemories());
  if (memories.some(item => sameMemoryContent(item, candidate))) return { reason: "与现有记忆重复，请人工确认" };
  if (memories.some(item => item.kind === candidate.kind && item.title.trim() === candidate.title.trim())) {
    return { reason: "同名记忆内容不同，可能存在冲突，请人工确认" };
  }
  if (reviewSize(candidate, sources, memories) > reviewContextLimit) return { reason: "完整审核上下文过大，请人工审核" };
  return { context: { sources, memories }, snapshot: memories.map(item => ({ id: item.id, revision: item.revision })) };
}
