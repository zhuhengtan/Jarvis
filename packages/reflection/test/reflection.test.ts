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

import {
  textSimilarity,
  mergeExtractedProfiles,
  applyProfileDecay,
  buildProfileDigest,
} from "../src/index.js";

describe("profile reflection logic", () => {
  it("computes text similarity accurately", () => {
    expect(textSimilarity("偏好简洁的中文回答", "偏好简洁的中文回答")).toBe(1);
    expect(textSimilarity("偏好简洁中文回答", "偏好简洁的中文回答")).toBeGreaterThan(0.7);
    expect(textSimilarity("喜欢吃苹果", "使用TypeScript重构")).toBeLessThan(0.3);
  });

  it("keeps model-extracted items pending until a person activates them", () => {
    // 1. stated non-sensitive item: starts pending with 0.9 confidence
    const round1 = mergeExtractedProfiles(
      [],
      [
        {
          category: "communication",
          statement: "偏好中文直接回答",
          origin: "stated",
          evidenceExcerpt: "用户说：以后回答我全用中文",
        },
      ],
      "session-1"
    );
    expect(round1).toHaveLength(1);
    expect(round1[0].status).toBe("pending");
    expect(round1[0].origin).toBe("stated");
    expect(round1[0].confidence).toBe(0.9);

    // 2. inferred item: starts pending with 0.5 confidence
    const round2 = mergeExtractedProfiles(
      round1,
      [
        {
          category: "workflow",
          statement: "倾向于先写测试再修改实现",
          origin: "inferred",
          evidenceExcerpt: "用户先运行了vitest",
        },
      ],
      "session-2"
    );
    const inferredItem = round2.find((i) => i.category === "workflow")!;
    expect(inferredItem.status).toBe("pending");
    expect(inferredItem.confidence).toBe(0.5);
    expect(inferredItem.count).toBe(1);

    // 3. repeated inferred item round 2: count 2, confidence 0.6 -> still pending
    const round3 = mergeExtractedProfiles(
      round2,
      [
        {
          category: "workflow",
          statement: "倾向先写测试再修改实现",
          origin: "inferred",
          evidenceExcerpt: "用户又要求先写测试",
        },
      ],
      "session-3"
    );
    const item3 = round3.find((i) => i.category === "workflow")!;
    expect(item3.count).toBe(2);
    expect(item3.confidence).toBe(0.6);
    expect(item3.status).toBe("pending");

    // 4. repeated inferred item round 3: count and confidence rise, status stays pending
    const round4 = mergeExtractedProfiles(
      round3,
      [
        {
          category: "workflow",
          statement: "倾向于先写测试再实现",
          origin: "inferred",
          evidenceExcerpt: "第三次先写测试",
        },
      ],
      "session-4"
    );
    const item4 = round4.find((i) => i.category === "workflow")!;
    expect(item4.count).toBe(3);
    expect(item4.confidence).toBe(0.7);
    expect(item4.status).toBe("pending");
  });

  it("always keeps sensitive trait/life categories pending", () => {
    const res = mergeExtractedProfiles(
      [],
      [
        {
          category: "trait",
          statement: "做事非常严谨细致",
          origin: "stated",
          evidenceExcerpt: "用户自我评价",
        },
        {
          category: "life",
          statement: "习惯熬夜编程到凌晨两点",
          origin: "stated",
          evidenceExcerpt: "用户提到经常凌晨两点还在改bug",
        },
      ],
      "session-1"
    );
    expect(res).toHaveLength(2);
    expect(res[0].status).toBe("pending");
    expect(res[1].status).toBe("pending");
  });

  it("applies decay correctly to old inferred items while preserving stated items", () => {
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    const items = [
      {
        id: "p1",
        category: "communication" as const,
        statement: "喜欢使用表格",
        origin: "inferred" as const,
        confidence: 0.4,
        evidence: [],
        status: "active" as const,
        inject: true,
        count: 3,
        firstSeenAt: oldDate,
        lastSeenAt: oldDate,
        updatedAt: oldDate,
        revision: 1,
      },
      {
        id: "p2",
        category: "communication" as const,
        statement: "不要使用表情符号",
        origin: "stated" as const,
        confidence: 0.9,
        evidence: [],
        status: "active" as const,
        inject: true,
        count: 1,
        firstSeenAt: oldDate,
        lastSeenAt: oldDate,
        updatedAt: oldDate,
        revision: 1,
      },
    ];

    const decayed = applyProfileDecay(items, { decayDays: 90 });
    // p1 confidence decreased from 0.4 to 0.2 (< 0.3) -> disabled
    expect(decayed[0].confidence).toBe(0.2);
    expect(decayed[0].status).toBe("disabled");
    // p2 stated -> untouched
    expect(decayed[1].confidence).toBe(0.9);
    expect(decayed[1].status).toBe("active");
  });

  it("builds profile digest from active non-sensitive items only", () => {
    const items = [
      {
        id: "p1",
        category: "communication" as const,
        statement: "偏好中文直接回答",
        origin: "stated" as const,
        confidence: 0.9,
        evidence: [],
        status: "active" as const,
        inject: true,
        count: 1,
        firstSeenAt: "2026-01-01",
        lastSeenAt: "2026-01-01",
        updatedAt: "2026-01-01",
        revision: 1,
      },
      {
        id: "p2",
        category: "trait" as const,
        statement: "追求极致性能与简洁",
        origin: "stated" as const,
        confidence: 0.9,
        evidence: [],
        status: "active" as const,
        inject: true,
        count: 1,
        firstSeenAt: "2026-01-01",
        lastSeenAt: "2026-01-01",
        updatedAt: "2026-01-01",
        revision: 1,
      },
      {
        id: "p3",
        category: "habit" as const,
        statement: "暂时未启用的习惯",
        origin: "stated" as const,
        confidence: 0.9,
        evidence: [],
        status: "pending" as const,
        inject: true,
        count: 1,
        firstSeenAt: "2026-01-01",
        lastSeenAt: "2026-01-01",
        updatedAt: "2026-01-01",
        revision: 1,
      },
    ];

    const digest = buildProfileDigest(items, { client: "pulse" });
    expect(digest).toContain("偏好中文直接回答");
    expect(digest).not.toContain("追求极致性能与简洁");
    expect(digest).not.toContain("暂时未启用的习惯");
  });

  it("decays by elapsed periods and remains stable across repeated reflections and reloads", () => {
    const item = mergeExtractedProfiles([], [{ category: "workflow", statement: "先审查再修改", origin: "inferred", evidenceExcerpt: "先审查" }], "s1", "2026-01-01T00:00:00.000Z")[0];
    item.status = "active";
    item.confidence = 0.9;
    const first = applyProfileDecay([item], { nowIso: "2026-04-02T00:00:00.000Z" });
    expect(first[0].confidence).toBe(0.7);
    expect(first[0].lastDecayedAt).toBe("2026-04-01T00:00:00.000Z");
    let repeated = JSON.parse(JSON.stringify(first));
    for (let n = 0; n < 20; n++) repeated = applyProfileDecay(repeated, { nowIso: "2026-04-02T00:00:00.000Z" });
    expect(repeated).toEqual(first);
    const next = applyProfileDecay(repeated, { nowIso: "2026-07-01T00:00:00.000Z" });
    expect(next[0].confidence).toBe(0.5);
    const refreshed = mergeExtractedProfiles(next, [{ category: "workflow", statement: "先审查再修改", origin: "inferred", evidenceExcerpt: "还是先审查" }], "s2", "2026-07-01T00:00:00.000Z");
    expect(applyProfileDecay(refreshed, { nowIso: "2026-09-28T00:00:00.000Z" })).toEqual(refreshed);
  });
});
