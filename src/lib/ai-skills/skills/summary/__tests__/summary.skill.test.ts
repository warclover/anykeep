/**
 * SummarySkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { SummarySkill, summarySkill } from "../summary.skill";
import type { SkillContext } from "../../../core/types";

// Mock 摘要结果
const mockSummaryResult = {
  summary:
    "React 是一个用于构建用户界面的 JavaScript 库，本文介绍了 React 的核心概念。",
  tags: ["React", "前端", "JavaScript", "组件化"],
  structured: {
    tldr: "React 入门必读",
    key_points: ["组件化开发", "虚拟 DOM", "单向数据流"],
    keywords: ["React", "组件", "JSX"],
    sentiment: "positive",
    reading_time: 5,
    action_items: ["安装 React", "创建第一个组件"],
  },
  enhanced: {
    entities: [
      { name: "React", type: "technology", confidence: 0.95 },
      { name: "Facebook", type: "company", confidence: 0.85 },
    ],
    key_data: [{ label: "发布年份", value: "2013", unit: "年" }],
    difficulty: "beginner",
  },
  contentType: "tutorial",
  contentTypeConfidence: 0.9,
  providerUsed: "openai",
  latencyMs: 1500,
};

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({})),
}));

// Mock summary service
jest.mock("@/lib/summary/services/summary.service", () => ({
  getSummaryService: jest.fn(() => ({
    generate: jest.fn(() => Promise.resolve(mockSummaryResult)),
  })),
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

describe("SummarySkill", () => {
  let skill: SummarySkill;

  beforeEach(() => {
    skill = new SummarySkill();
    jest.clearAllMocks();
  });

  describe("metadata", () => {
    it("should have correct id and name", () => {
      expect(skill.metadata.id).toBe("summary");
      expect(skill.metadata.name).toBe("内容摘要");
      expect(skill.metadata.category).toBe("understanding");
    });

    it("should have correct version", () => {
      expect(skill.metadata.version).toBe("1.0.0");
    });

    it("should have capabilities", () => {
      expect(skill.metadata.capabilities).toBeDefined();
      expect(skill.metadata.capabilities).toContain("summary-generation");
      expect(skill.metadata.capabilities).toContain("tag-extraction");
      expect(skill.metadata.capabilities).toContain("keyword-extraction");
      expect(skill.metadata.capabilities).toContain("entity-extraction");
      expect(skill.metadata.capabilities).toContain("content-type-detection");
      expect(skill.metadata.capabilities).toContain("difficulty-assessment");
    });

    it("should not require confirmation", () => {
      expect(skill.metadata.requiresConfirmation).toBe(false);
    });

    it("should have duration estimates", () => {
      expect(skill.metadata.estimatedDurationMs).toBeDefined();
      expect(skill.metadata.maxExecutionTimeMs).toBeDefined();
      expect(skill.metadata.maxExecutionTimeMs).toBeGreaterThan(
        skill.metadata.estimatedDurationMs!,
      );
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

    it("should accept optional description", () => {
      const withDesc = { title: "Test", description: "A description" };
      const result = skill.inputSchema.safeParse(withDesc);
      expect(result.success).toBe(true);
    });

    it("should accept optional content", () => {
      const withContent = { title: "Test", content: "Full content text" };
      const result = skill.inputSchema.safeParse(withContent);
      expect(result.success).toBe(true);
    });

    it("should validate mode options", () => {
      const standardMode = { title: "Test", mode: "standard" };
      const enhancedMode = { title: "Test", mode: "enhanced" };
      const invalidMode = { title: "Test", mode: "invalid" };

      expect(skill.inputSchema.safeParse(standardMode).success).toBe(true);
      expect(skill.inputSchema.safeParse(enhancedMode).success).toBe(true);
      expect(skill.inputSchema.safeParse(invalidMode).success).toBe(false);
    });

    it("should accept needsClassification option", () => {
      const withFlag = { title: "Test", needsClassification: true };
      const result = skill.inputSchema.safeParse(withFlag);
      expect(result.success).toBe(true);
    });
  });

  describe("execute", () => {
    const mockContext: SkillContext = {
      userId: "test-user-id",
      traceId: "test-trace-id",
    };

    it("should generate summary", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.summary).toBeDefined();
      expect(typeof result.data.summary).toBe("string");
      expect(result.data.summary.length).toBeGreaterThan(0);
    });

    it("should extract tags", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.tags).toBeDefined();
      expect(Array.isArray(result.data.tags)).toBe(true);
      expect(result.data.tags.length).toBeGreaterThan(0);
    });

    it("should include structured summary when available", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.structured).toBeDefined();
      expect(result.data.structured?.tldr).toBeDefined();
      expect(result.data.structured?.keyPoints).toBeDefined();
      expect(result.data.structured?.keywords).toBeDefined();
    });

    it("should include enhanced data when available", async () => {
      const input = { title: "React 入门教程", mode: "enhanced" as const };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.enhanced).toBeDefined();
      expect(result.data.enhanced?.entities).toBeDefined();
      expect(result.data.enhanced?.keyData).toBeDefined();
    });

    it("should include content type detection", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.contentType).toBeDefined();
      expect(result.data.contentTypeConfidence).toBeDefined();
    });

    it("should include latency information", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.latencyMs).toBeDefined();
      expect(typeof result.data.latencyMs).toBe("number");
    });

    it("should include provider information", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.providerUsed).toBeDefined();
    });

    it("should include execution metrics", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.metrics).toBeDefined();
      expect(result.metrics?.executionTimeMs).toBeDefined();
    });
  });

  describe("structured summary format", () => {
    const mockContext: SkillContext = {
      userId: "test-user-id",
      traceId: "test-trace-id",
    };

    it("should include keyPoints array", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.structured?.keyPoints).toBeDefined();
      expect(Array.isArray(result.data.structured?.keyPoints)).toBe(true);
    });

    it("should include sentiment when available", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      const validSentiments = ["positive", "neutral", "negative"];
      if (result.data.structured?.sentiment) {
        expect(validSentiments).toContain(result.data.structured.sentiment);
      }
    });

    it("should include reading time estimate", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.structured?.readingTime).toBeDefined();
      expect(typeof result.data.structured?.readingTime).toBe("number");
    });
  });

  describe("enhanced data format", () => {
    const mockContext: SkillContext = {
      userId: "test-user-id",
      traceId: "test-trace-id",
    };

    it("should include entities array", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.enhanced?.entities).toBeDefined();
      expect(Array.isArray(result.data.enhanced?.entities)).toBe(true);
    });

    it("should format entities correctly", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      const entities = result.data.enhanced?.entities;
      if (entities && entities.length > 0) {
        const entity = entities[0];
        expect(entity.name).toBeDefined();
        expect(entity.type).toBeDefined();
      }
    });

    it("should include key data array", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.enhanced?.keyData).toBeDefined();
      expect(Array.isArray(result.data.enhanced?.keyData)).toBe(true);
    });

    it("should include difficulty when available", async () => {
      const input = { title: "React 入门教程" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.enhanced?.difficulty).toBeDefined();
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(summarySkill).toBeInstanceOf(SummarySkill);
      expect(summarySkill.metadata.id).toBe("summary");
    });
  });
});
