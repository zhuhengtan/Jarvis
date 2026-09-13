import { newId, now, type Evaluation, type Experience } from "@jarvis/shared";

/** Deterministic first-pass evaluator. Model providers may add evidence, never overwrite this audit. */
export class EvaluationEngine {
  evaluate(experience: Experience): Evaluation {
    const score = Math.max(0, Math.min(100, 70 + Math.min(20, experience.decisions.length * 5) - Math.min(40, experience.failures.length * 10)));
    const rationale = experience.failures.length ? `Recorded ${experience.failures.length} failure(s); retain for future retrieval.` : "Outcome includes no recorded failure.";
    return { id: newId("evaluation"), sessionId: experience.sessionId, projectId: experience.projectId, score, rationale, createdAt: now() };
  }
}
