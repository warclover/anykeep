/**
 * EnhancedBlueprintEngine 单元测试
 *
 * 测试 Story 1.1 的验收标准：
 * - AC1: 类继承 OrchestrationSkill 的所有方法
 * - AC2: 添加 getBriefingQuestions() 抽象方法
 * - AC3: 添加 generateOutline() 抽象方法
 * - AC4: 添加 getOutputSchema() 抽象方法
 * - AC5: 文件位置正确
 */

import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import type { OrchestrationStreamChunk } from "../../../ai-skills/output/types";
import type { OrchestrationContext } from "../../../ai-skills/orchestration";
import {
  EnhancedBlueprintEngine,
  type BlueprintExecutionContext,
} from "../enhanced-blueprint-engine";
import type {
  BriefingQuestion,
  BriefingConfig,
  EnhancedBlueprintInput,
  StructuredOutput,
  BlueprintOutline,
  BlueprintTier,
  TargetUserGroup,
} from "../types";

// ============================================================
// Mock Implementation for Testing
// ============================================================

interface TestOutput extends StructuredOutput {
  title: string;
  content: string;
}

/**
 * 测试用具体实现
 */
class TestBlueprint extends EnhancedBlueprintEngine<TestOutput> {
  readonly blueprintId: string = "test-blueprint";
  readonly displayName = "测试蓝图";
  readonly description = "用于单元测试的蓝图实现";
  readonly icon = "🧪";
  readonly tier: BlueprintTier = "free";
  readonly targetUsers: TargetUserGroup[] = ["developer", "general"];

  // BaseSkill required schemas
  readonly inputSchema = z.object({
    materials: z.array(z.any()),
    briefingContext: z.any().optional(),
    customPrompt: z.string().optional(),
    targetLength: z.enum(["short", "medium", "long"]).optional(),
    requestMetadata: z.any().optional(),
  });

  readonly outputSchema = z.object({
    version: z.string(),
    generatedAt: z.date(),
    blueprintId: z.string(),
    title: z.string(),
    content: z.string(),
  });

  readonly briefingConfig: BriefingConfig = {
    enabled: true,
    maxQuestions: 2,
    questions: [
      {
        id: "audience",
        type: "single_choice",
        question: "目标读者？",
        options: [
          { value: "beginner", label: "初学者" },
          { value: "expert", label: "专家" },
        ],
        required: true,
      },
    ],
  };

  getBriefingQuestions(): BriefingQuestion[] {
    return this.briefingConfig.questions;
  }

  async *generateOutline(
    _context: BlueprintExecutionContext,
    _input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, BlueprintOutline, unknown> {
    yield* this.reportProgress("outline", 50, "生成大纲中...");

    return {
      title: "测试大纲",
      summary: "这是一个测试大纲",
      nodes: [
        {
          id: "1",
          title: "第一节",
          level: 1,
          description: "第一节内容",
        },
      ],
      totalEstimatedWords: 500,
      generatedBy: "deepseek",
    };
  }

  getOutputSchema(): JSONSchema7 {
    return {
      type: "object",
      properties: {
        version: { type: "string" },
        generatedAt: { type: "string", format: "date-time" },
        blueprintId: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
      },
      required: ["version", "generatedAt", "blueprintId", "title", "content"],
    };
  }

  protected async *generateContent(
    _context: BlueprintExecutionContext,
    _input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, string, unknown> {
    yield* this.reportProgress("content", 50, "生成内容中...");
    return "这是测试内容";
  }

  protected async structureOutput(
    context: BlueprintExecutionContext,
    rawContent: string,
  ): Promise<TestOutput> {
    return {
      version: "1.0.0",
      generatedAt: new Date(),
      blueprintId: this.blueprintId,
      title: context.outline?.title ?? "无标题",
      content: rawContent,
    };
  }
}

/**
 * 禁用 Briefing 的测试蓝图
 */
class NoBriefingBlueprint extends TestBlueprint {
  readonly blueprintId = "no-briefing-blueprint";
  readonly briefingConfig: BriefingConfig = {
    enabled: false,
    maxQuestions: 1,
    questions: [],
  };
}

// ============================================================
// Test Suites
// ============================================================

describe("EnhancedBlueprintEngine", () => {
  let blueprint: TestBlueprint;

  beforeEach(() => {
    blueprint = new TestBlueprint();
  });

  describe("AC1: 继承 OrchestrationSkill", () => {
    it("should have metadata property from OrchestrationSkill", () => {
      expect(blueprint.metadata).toBeDefined();
      expect(blueprint.metadata.id).toBe("test-blueprint");
      expect(blueprint.metadata.name).toBe("测试蓝图");
      expect(blueprint.metadata.category).toBe("learning");
    });

    it("should have parseInput method", () => {
      expect(typeof blueprint.parseInput).toBe("function");
    });

    it("should have executeStream method", () => {
      expect(typeof blueprint.executeStream).toBe("function");
    });

    it("should inherit progress reporting methods", () => {
      // reportProgress is protected, test via metadata
      expect(blueprint.metadata.estimatedDurationMs).toBeGreaterThan(0);
    });
  });

  describe("AC2: getBriefingQuestions 抽象方法", () => {
    it("should return briefing questions array", () => {
      const questions = blueprint.getBriefingQuestions();

      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
    });

    it("should return questions with required properties", () => {
      const questions = blueprint.getBriefingQuestions();
      const question = questions[0];

      expect(question.id).toBeDefined();
      expect(question.type).toBeDefined();
      expect(question.question).toBeDefined();
      expect(typeof question.required).toBe("boolean");
    });

    it("should support different question types", () => {
      const questions = blueprint.getBriefingQuestions();
      const types = questions.map((q) => q.type);

      // At least one question type should be present
      expect(types.length).toBeGreaterThan(0);
    });
  });

  describe("AC3: generateOutline 抽象方法", () => {
    it("should be an async generator function", () => {
      const mockContext: BlueprintExecutionContext = {
        userId: "test-user",
        conversationId: "test-conv",
        params: {},
        stage: "outline",
      };
      const mockInput: EnhancedBlueprintInput = {
        materials: [],
        targetLength: "medium",
      };

      const generator = blueprint.generateOutline(mockContext, mockInput);

      expect(generator[Symbol.asyncIterator]).toBeDefined();
    });

    it("should yield progress chunks and return outline", async () => {
      const mockContext: BlueprintExecutionContext = {
        userId: "test-user",
        conversationId: "test-conv",
        params: {},
        stage: "outline",
      };
      const mockInput: EnhancedBlueprintInput = {
        materials: [],
        targetLength: "medium",
      };

      // Need to initialize progress first
      const steps = [{ id: "outline", name: "生成大纲", weight: 100 }];
      // @ts-expect-error - accessing protected method for testing
      blueprint.initProgress(steps);

      const generator = blueprint.generateOutline(mockContext, mockInput);
      const chunks: OrchestrationStreamChunk[] = [];

      // 收集所有 chunks 并获取最终的 outline
      const collectResults = async () => {
        let result = await generator.next();
        while (!result.done) {
          chunks.push(result.value);
          result = await generator.next();
        }
        return result.value;
      };
      const outline = await collectResults();

      expect(chunks.length).toBeGreaterThan(0);
      expect(outline).toBeDefined();
      expect(outline.title).toBeDefined();
      expect(outline.nodes).toBeDefined();
    });
  });

  describe("AC4: getOutputSchema 抽象方法", () => {
    it("should return a valid JSON Schema", () => {
      const schema = blueprint.getOutputSchema();

      expect(schema).toBeDefined();
      expect(schema.type).toBe("object");
      expect(schema.properties).toBeDefined();
    });

    it("should include required fields for StructuredOutput", () => {
      const schema = blueprint.getOutputSchema();

      expect(schema.properties).toHaveProperty("version");
      expect(schema.properties).toHaveProperty("generatedAt");
      expect(schema.properties).toHaveProperty("blueprintId");
    });

    it("should have required array", () => {
      const schema = blueprint.getOutputSchema();

      expect(Array.isArray(schema.required)).toBe(true);
      expect(schema.required).toContain("version");
    });
  });

  describe("Blueprint Properties", () => {
    it("should have blueprintId property", () => {
      expect(blueprint.blueprintId).toBe("test-blueprint");
    });

    it("should have displayName property", () => {
      expect(blueprint.displayName).toBe("测试蓝图");
    });

    it("should have description property", () => {
      expect(blueprint.description).toBeDefined();
    });

    it("should have icon property", () => {
      expect(blueprint.icon).toBe("🧪");
    });

    it("should have briefingConfig property", () => {
      expect(blueprint.briefingConfig).toBeDefined();
      expect(blueprint.briefingConfig.enabled).toBe(true);
      expect(blueprint.briefingConfig.maxQuestions).toBeLessThanOrEqual(3);
    });

    // Story 1.2 AC: 蓝图元数据必需字段
    it("should have tier property (Story 1.2 AC)", () => {
      expect(blueprint.tier).toBeDefined();
      expect(["free", "pro", "enterprise"]).toContain(blueprint.tier);
    });

    it("should have targetUsers property (Story 1.2 AC)", () => {
      expect(blueprint.targetUsers).toBeDefined();
      expect(Array.isArray(blueprint.targetUsers)).toBe(true);
      expect(blueprint.targetUsers.length).toBeGreaterThan(0);
    });
  });

  describe("getBlueprintMetadata", () => {
    it("should return enhanced blueprint metadata", () => {
      const metadata = blueprint.getBlueprintMetadata();

      expect(metadata.blueprintId).toBe("test-blueprint");
      expect(metadata.displayName).toBe("测试蓝图");
      expect(metadata.icon).toBe("🧪");
      expect(metadata.supportsOutline).toBe(true);
      expect(metadata.briefingEnabled).toBe(true);
    });

    // Story 1.2 AC: 元数据包含 tier 和 targetUsers
    it("should include tier and targetUsers in metadata (Story 1.2 AC)", () => {
      const metadata = blueprint.getBlueprintMetadata();

      expect(metadata.tier).toBe("free");
      expect(metadata.targetUsers).toEqual(["developer", "general"]);
    });

    // Story 1.2 AC: 可选字段正确处理
    it("should handle optional metadata fields (Story 1.2 AC)", () => {
      const metadata = blueprint.getBlueprintMetadata();

      // 可选字段未设置时应为 undefined
      expect(metadata.category).toBeUndefined();
      expect(metadata.priority).toBeUndefined();
      expect(metadata.isNew).toBeUndefined();
      expect(metadata.tags).toBeUndefined();
      expect(metadata.examplePrompts).toBeUndefined();
    });

    it("should correctly identify geek blueprints", () => {
      const metadata = blueprint.getBlueprintMetadata();
      expect(metadata.isGeek).toBe(false);
      // category 是可选字段，TestBlueprint 未设置时应为 undefined
      expect(metadata.category).toBeUndefined();
    });
  });

  describe("parseInput", () => {
    it("should parse input from context params", async () => {
      const mockContext: OrchestrationContext = {
        userId: "test-user",
        conversationId: "test-conv",
        params: {
          materials: [
            {
              bookmarkId: "1",
              title: "Test",
              content: "Content",
              url: "https://example.com",
            },
          ],
          targetLength: "long",
        },
      };

      const input = await blueprint.parseInput("custom prompt", mockContext);

      expect(input.materials).toHaveLength(1);
      expect(input.targetLength).toBe("long");
      expect(input.customPrompt).toBe("custom prompt");
    });

    it("should use defaults when params are empty", async () => {
      const mockContext: OrchestrationContext = {
        userId: "test-user",
        conversationId: "test-conv",
        params: {},
      };

      const input = await blueprint.parseInput("", mockContext);

      expect(input.materials).toEqual([]);
      expect(input.targetLength).toBe("medium");
    });
  });

  describe("Briefing Flow", () => {
    it("should emit confirmation chunk when briefing is enabled and no context provided", async () => {
      const mockContext: OrchestrationContext = {
        userId: "test-user",
        conversationId: "test-conv",
        params: {
          materials: [],
        },
      };

      // @ts-expect-error - accessing protected method for testing
      blueprint.initProgress([{ id: "briefing", name: "收集偏好", weight: 5 }]);

      const generator = blueprint.executeStream(mockContext);
      const chunks: OrchestrationStreamChunk[] = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      const confirmationChunk = chunks.find((c) => c.type === "confirmation");
      expect(confirmationChunk).toBeDefined();
      expect(confirmationChunk?.data.title).toBe("生成前确认");
    });

    it("should skip briefing when disabled", async () => {
      const noBriefing = new NoBriefingBlueprint();
      const mockContext: OrchestrationContext = {
        userId: "test-user",
        conversationId: "test-conv",
        params: {
          materials: [],
        },
      };

      // @ts-expect-error - accessing protected method for testing
      noBriefing.initProgress([
        { id: "outline", name: "生成大纲", weight: 25 },
        { id: "content", name: "生成内容", weight: 60 },
        { id: "structuring", name: "结构化输出", weight: 10 },
      ]);

      const generator = noBriefing.executeStream(mockContext);
      const chunks: OrchestrationStreamChunk[] = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      const confirmationChunk = chunks.find((c) => c.type === "confirmation");
      expect(confirmationChunk).toBeUndefined();

      // Should have done chunk
      const doneChunk = chunks.find((c) => c.type === "done");
      expect(doneChunk).toBeDefined();
    });
  });

  describe("Validation", () => {
    it("should validate briefing config question limit", () => {
      const invalidBlueprint = new (class extends TestBlueprint {
        readonly briefingConfig: BriefingConfig = {
          enabled: true,
          maxQuestions: 3,
          questions: [
            {
              id: "q1",
              type: "text",
              question: "Q1?",
              required: true,
            },
            {
              id: "q2",
              type: "text",
              question: "Q2?",
              required: true,
            },
            {
              id: "q3",
              type: "text",
              question: "Q3?",
              required: true,
            },
            {
              id: "q4",
              type: "text",
              question: "Q4? (exceeds limit)",
              required: true,
            },
          ],
        };
      })();

      expect(() => {
        // @ts-expect-error - accessing protected method for testing
        invalidBlueprint.validateBriefingConfig();
      }).toThrow("Briefing 问题数量超过限制");
    });
  });
});
