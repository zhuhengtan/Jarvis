import { type Evaluation, type Experience } from "@jarvis/shared";
/** Deterministic first-pass evaluator. Model providers may add evidence, never overwrite this audit. */
export declare class EvaluationEngine {
    evaluate(experience: Experience): Evaluation;
}
