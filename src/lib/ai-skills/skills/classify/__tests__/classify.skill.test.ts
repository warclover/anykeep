/**
 * ClassifySkill 单元测试
 *
 * @version 2.0.0 - 适配 classification-v2
 * @since 2025-12-25
 * @updated 2026-03-10
 */

import { ClassifySkill, classifySkill } from "../classify.skill";
import type { SkillContext } from "../../../core/types";

// Mock classification-v2 的 classify 返回值
// 注意：v2 的 confidence 为 0~1 浮点数，skill 层会转换为 0~100
const mockClassifyResult = {
  folderId: 1,
  folderName: "技术文章",
  confidence: 0.85,
  action: "classify" as const,
  reason: "内容与技术文章高度匹配",
  candidates: [
    { folderId: 1, folderName: "技术文章", mergedScore: 0.85 },
    { folderId: 2, folderName: "教程", mergedScore: 0.65 },
  ],
  timing: { totalMs: 150, earlyExitTier: 1 },
};

// Mock classification-v2
jest.mock("@/lib/classification-v2", () => ({
  classify: jest.fn(() => Promise.resolve(mockClassifyResult)),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("ClassifySkill", () => {
  let skill: ClassifySkill;

  beforeEach(() => {
    skill = new ClassifySkill();
    jest.clearAllMocks();
  });

  describe("metadata", () => {
    it("should have correct id and name", () => {
      expect(skill.metadata.id).toBe("classify");
      expect(skill.metadata.name).toBe("内容分类");
      expect(skill.metadata.category).toBe("organizing");
    });

    it("should have correct version", () => {
      expect(skill.metadata.version).toBe("2.0.0");
    });

    it("should have capabilities", () => {
      expect(skill.metadata.capabilities).toBeDefined();
      expect(skill.metadata.capabilities).toContain("vector-matching");
      expect(skill.metadata.capabilities).toContain("tag-boost");
      expect(skill.metadata.capabilities).toContain("ai-selection");
      expect(skill.metadata.capabilities).toContain("cold-start-support");
      expect(skill.metadata.capabilities).toContain("folder-suggestion");
    });

    it("should not require confirmation at skill level", () => {
      expect(skill.metadata.requiresConfirmation).toBe(false);
    });

    it("should have duration estimates", () => {
      expect(skill.metadata.estimatedDurationMs).toBeDefined();
      expect(skill.metadata.maxExecutionTimeMs).toBeDefined();
    });
  });

  describe("schemas", () => {
    it("should have valid input schema", () => {
      expect(skill.inputSchema).toBeDefined();
    });

    it("should have valid output schema", () => {
      expect(skill.outputSchema).toBeDefined();
    });

    it("should validate title input", () => {
      const validInput = { title: "React 入门教程" };
      const result = skill.inputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject empty title", () => {
      const invalidInput = { title: "" };
      const result = skill.inputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should accept optional bookmarkId", () => {
      const withId = { title: "Test", bookmarkId: 123 };
      const withoutId = { title: "Test" };

      expect(skill.inputSchema.safeParse(withId).success).toBe(true);
      expect(skill.inputSchema.safeParse(withoutId).success).toBe(true);
    });

    it("should accept optional summary", () => {
      const withSummary = { title: "Test", summary: "This is a summary" };
      const result = skill.inputSchema.safeParse(withSummary);
      expect(result.success).toBe(true);
    });

    it("should accept optional tags array", () => {
      const withTags = { title: "Test", tags: ["React", "前端"] };
      const result = skill.inputSchema.safeParse(withTags);
      expect(result.success).toBe(true);
    });

    it("should accept optional url", () => {
      const withUrl = { title: "Test", url: "https://example.com" };
      const result = skill.inputSchema.safeParse(withUrl);
      expect(result.success).toBe(true);
    });

    it("should validate url format", () => {
      const invalidUrl = { title: "Test", url: "not-a-url" };
      const result = skill.inputSchema.safeParse(invalidUrl);
      expect(result.success).toBe(false);
    });

    it("should accept enableAI option", () => {
      const withAI = { title: "Test", enableAI: true };
      const withoutAI = { title: "Test", enableAI: false };

      expect(skill.inputSchema.safeParse(withAI).success).toBe(true);
      expect(skill.inputSchema.safeParse(withoutAI).success).toBe(true);
    });
  });

  describe("execute", () => {
    const mockContext: SkillContext = {
      userId: "test-user-id",
      traceId: "test-trace-id",
    };

    it("should execute classification", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.folderId).toBeDefined();
      expect(result.data.folderName).toBeDefined();
      expect(result.data.confidence).toBeDefined();
      expect(result.data.action).toBeDefined();
    });

    it("should return confidence score", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.confidence).toBeGreaterThanOrEqual(0);
      expect(result.data.confidence).toBeLessThanOrEqual(100);
    });

    it("should return action type", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      const validActions = [
        "classify",
        "inbox",
        "suggest",
        "suggest_new",
        "suggest_create",
        "auto_create",
      ];
      expect(validActions).toContain(result.data.action);
    });

    it("should return candidates array", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.candidates).toBeDefined();
      expect(Array.isArray(result.data.candidates)).toBe(true);
    });

    it("should include requiresConfirmation flag", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.requiresConfirmation).toBeDefined();
      expect(typeof result.data.requiresConfirmation).toBe("boolean");
    });

    it("should include reason for classification", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.reason).toBeDefined();
      expect(typeof result.data.reason).toBe("string");
    });

    it("should include execution metrics", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.metrics).toBeDefined();
      expect(result.metrics?.executionTimeMs).toBeDefined();
    });
  });

  describe("confirmation logic", () => {
    const mockContext: SkillContext = {
      userId: "test-user-id",
      traceId: "test-trace-id",
    };

    it("should determine confirmation based on confidence", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      // v2 返回 0.85 → 转换为 85% → 高于 70% 阈值 → 不需要确认
      expect(result.data.requiresConfirmation).toBe(false);
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(classifySkill).toBeInstanceOf(ClassifySkill);
      expect(classifySkill.metadata.id).toBe("classify");
    });
  });

  describe("v2 confidence conversion", () => {
    const mockContext: SkillContext = {
      userId: "test-user-id",
      traceId: "test-trace-id",
    };

    // 引入 classify mock 以便在每个场景中独立设置
    const { classify } = jest.requireMock("@/lib/classification-v2") as {
      classify: jest.Mock;
    };

    it("should convert v2 confidence (0-1) to percentage (0-100)", async () => {
      // v2 返回 0.85 → skill 输出 85
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.confidence).toBe(85);
    });

    it("should handle low confidence correctly", async () => {
      classify.mockResolvedValueOnce({
        ...mockClassifyResult,
        confidence: 0.3,
        action: "inbox",
        folderId: null,
        folderName: null,
      });

      const input = { title: "未知内容" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.confidence).toBe(30);
      expect(result.data.requiresConfirmation).toBe(true);
    });

    it("should handle high confidence (>= 80%) correctly", async () => {
      classify.mockResolvedValueOnce({
        ...mockClassifyResult,
        confidence: 0.92,
        action: "classify",
      });

      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.confidence).toBe(92);
      expect(result.data.action).toBe("classify");
      expect(result.data.requiresConfirmation).toBe(false);
    });

    it("should never return confidence > 100 (overflow detection)", async () => {
      // 即使 v2 返回满分 1.0，转换后也不超过 100
      classify.mockResolvedValueOnce({
        ...mockClassifyResult,
        confidence: 1.0,
      });

      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.confidence).toBe(100);
      expect(result.data.confidence).not.toBeGreaterThan(100);
    });
  });
});
