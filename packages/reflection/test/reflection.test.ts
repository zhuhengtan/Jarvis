import { describe, expect, it } from "vitest";
import { ReflectionEngine } from "../src/index.js";

describe("reflection evidence shaping", () => {
  it("keeps background, applicability and verification in candidates", () => {
    const [record] = new ReflectionEngine().candidates({
      id: "experience-1", sessionId: "session-1", projectId: "project-a",
      summary: "已完成跨 IDE 项目识别验证", decisions: ["统一使用显式 project.json id"], failures: [], nextSteps: [], createdAt: new Date().toISOString()
    });
    expect(record.content).toContain("任务总结：已完成跨 IDE 项目识别验证");
    expect(record.applicability).toEqual(["project:project-a"]);
    expect(record.verification).toContain("等待规则审核");
  });
});
