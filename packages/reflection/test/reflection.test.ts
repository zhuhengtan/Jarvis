import { describe, expect, it } from "vitest";
import { ReflectionEngine } from "../src/index.js";

const base = { id: "experience-1", sessionId: "session-1", projectId: "project-a", createdAt: new Date().toISOString() };

describe("reflection evidence shaping", () => {
  it("keeps background, applicability and verification in candidates", () => {
    const [record] = new ReflectionEngine().candidates({
      ...base, summary: "已完成跨 IDE 项目识别验证", decisions: ["统一使用显式 project.json id"], failures: [], nextSteps: [],
    });
    expect(record.title).toContain("统一使用显式 project.json id");
    expect(record.content).toContain("任务总结：已完成跨 IDE 项目识别验证");
    expect(record.applicability).toEqual(["project:project-a"]);
    expect(record.verification).toContain("等待规则审核");
  });

  it("creates a candidate from summary when no decisions or failures exist", () => {
    const records = new ReflectionEngine().candidates({
      ...base, summary: "只写了总结也能沉淀一条候选记忆", decisions: [], failures: [], nextSteps: [],
    });
    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe("fact");
    expect(records[0].title).toContain("只写了总结");
    expect(records[0].content).toContain("只写了总结也能沉淀一条候选记忆");
  });

  it("uses extracted statements as distinct titles and keeps explicit decisions", () => {
    const records = new ReflectionEngine().candidates(
      { ...base, summary: "关闭会话", decisions: ["保留人工审核"], failures: [], nextSteps: [] },
      [{ kind: "workflow", title: "先开 session", content: "非平凡任务先打开 Jarvis session" }],
    );
    expect(records.map((record) => record.title)).toEqual(expect.arrayContaining(["保留人工审核", "先开 session"]));
    expect(records.some((record) => record.kind === "workflow")).toBe(true);
  });
});
