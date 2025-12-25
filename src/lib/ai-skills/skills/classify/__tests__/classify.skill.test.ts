/**
 * ClassifySkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { ClassifySkill, classifySkill } from "../classify.skill";
import type { SkillContext } from "../../../core/types";

// Mock 分类结果
const mockClassifyResult = {
  folderId: 1,
  folderName: "技术文章",
  confidence: 85,
  action: "classify" as const,
  reason: "内容与技术文章高度匹配",
  matchType: "profile",
  executionTime: 150,
  candidates: [
    {
      folderId: 1,
      folderName: "技术文章",
      score: 0.85,
      matchType: "profile" as const,
      topTags: ["React", "前端"],
    },
    {
      folderId: 2,
      folderName: "教程",
      score: 0.65,
      matchType: "name" as const,
      topTags: ["入门", "学习"],
    },
  ],
};

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({})),
}));

// Mock classification service
jest.mock(
  "@/lib/classification/services/simple-classification.service",
  () => ({
    createSimpleClassificationService: jest.fn(() => ({
      classify: jest.fn(() => Promise.resolve(mockClassifyResult)),
    })),
  }),
);

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
      expect(skill.metadata.version).toBe("1.0.0");
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
      // 高置信度（85%）不需要确认
      expect(result.data.requiresConfirmation).toBe(false);
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(classifySkill).toBeInstanceOf(ClassifySkill);
      expect(classifySkill.metadata.id).toBe("classify");
    });
  });
});
