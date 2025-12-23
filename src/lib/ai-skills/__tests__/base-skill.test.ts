/**
 * BaseSkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import { z } from "zod";
import {
  BaseSkill,
  SkillValidationError,
  SkillTimeoutError,
} from "../core/base-skill";
import type { SkillMetadata, SkillContext } from "../core/types";

// ============================================
// 测试用 Mock Skill
// ============================================

interface MockInput {
  query: string;
  limit?: number;
}

interface MockOutput {
  results: string[];
  total: number;
}

class MockSkill extends BaseSkill<MockInput, MockOutput> {
  metadata: SkillMetadata = {
    id: "mock-skill",
    name: "Mock Skill",
    description: "A mock skill for testing",
    category: "utility",
    version: "1.0.0",
    author: "Test",
    capabilities: ["test"],
  };

  inputSchema = z.object({
    query: z.string().min(1),
    limit: z.number().optional().default(10),
  });

  outputSchema = z.object({
    results: z.array(z.string()),
    total: z.number(),
  });

  // 可配置的执行行为
  public mockExecuteImpl: (
    input: MockInput,
    context: SkillContext,
  ) => Promise<MockOutput> = async (input) => ({
    results: [`Result for: ${input.query}`],
    total: 1,
  });

  protected async executeInternal(
    input: MockInput,
    context: SkillContext,
  ): Promise<MockOutput> {
    return this.mockExecuteImpl(input, context);
  }
}

// 慢速 Skill 用于测试超时
class SlowSkill extends BaseSkill<MockInput, MockOutput> {
  metadata: SkillMetadata = {
    id: "slow-skill",
    name: "Slow Skill",
    description: "A slow skill for testing timeout",
    category: "utility",
    version: "1.0.0",
    author: "Test",
    capabilities: ["test"],
    maxExecutionTimeMs: 100, // 100ms 超时
  };

  inputSchema = z.object({
    query: z.string().min(1),
    limit: z.number().optional().default(10),
  });

  outputSchema = z.object({
    results: z.array(z.string()),
    total: z.number(),
  });

  protected async executeInternal(): Promise<MockOutput> {
    // 故意延迟超过超时时间
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { results: [], total: 0 };
  }
}

// ============================================
// 测试套件
// ============================================

describe("BaseSkill", () => {
  let skill: MockSkill;
  let context: SkillContext;

  beforeEach(() => {
    skill = new MockSkill();
    context = {
      userId: "test-user-123",
      debug: false,
    };
  });

  describe("execute", () => {
    it("should execute successfully with valid input", async () => {
      const result = await skill.execute({ query: "test" }, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.results).toContain("Result for: test");
        expect(result.data.total).toBe(1);
        expect(result.metrics.executionTimeMs).toBeGreaterThanOrEqual(0);
      }
    });

    it("should apply default values from schema", async () => {
      const result = await skill.execute({ query: "test" }, context);

      expect(result.success).toBe(true);
    });

    it("should fail with invalid input", async () => {
      const result = await skill.execute({ query: "" } as MockInput, context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Input validation failed");
        expect(result.errorCode).toBe("INPUT_VALIDATION_ERROR");
      }
    });

    it("should track execution metrics", async () => {
      const result = await skill.execute({ query: "test" }, context);

      expect(result.metrics).toBeDefined();
      expect(typeof result.metrics.executionTimeMs).toBe("number");
      expect(result.metrics.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should handle execution errors gracefully", async () => {
      skill.mockExecuteImpl = async () => {
        throw new Error("Execution failed");
      };

      const result = await skill.execute({ query: "test" }, context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Execution failed");
        expect(result.errorCode).toBe("UNKNOWN_ERROR");
      }
    });

    it("should detect network errors", async () => {
      skill.mockExecuteImpl = async () => {
        throw new Error("network connection failed");
      };

      const result = await skill.execute({ query: "test" }, context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe("NETWORK_ERROR");
      }
    });
  });

  describe("timeout handling", () => {
    it("should timeout when execution takes too long", async () => {
      const slowSkill = new SlowSkill();

      const result = await slowSkill.execute({ query: "test" }, context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("timed out");
        expect(result.errorCode).toBe("TIMEOUT_ERROR");
      }
    });

    it("should respect context maxExecutionTime", async () => {
      skill.mockExecuteImpl = async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { results: [], total: 0 };
      };

      const result = await skill.execute(
        { query: "test" },
        {
          ...context,
          maxExecutionTime: 50, // 50ms 超时
        },
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe("TIMEOUT_ERROR");
      }
    });
  });

  describe("validateInput", () => {
    it("should return validated input for valid data", () => {
      const input = skill.validateInput({ query: "test", limit: 5 });

      expect(input.query).toBe("test");
      expect(input.limit).toBe(5);
    });

    it("should throw SkillValidationError for invalid data", () => {
      expect(() => skill.validateInput({ query: "" })).toThrow(
        SkillValidationError,
      );
    });

    it("should apply default values", () => {
      const input = skill.validateInput({ query: "test" });

      expect(input.limit).toBe(10); // default value
    });
  });

  describe("validateOutput", () => {
    it("should return validated output for valid data", () => {
      const output = skill.validateOutput({ results: ["a", "b"], total: 2 });

      expect(output.results).toEqual(["a", "b"]);
      expect(output.total).toBe(2);
    });

    it("should throw SkillValidationError for invalid output", () => {
      expect(() =>
        skill.validateOutput({ results: "invalid", total: 1 }),
      ).toThrow(SkillValidationError);
    });
  });

  describe("toTool", () => {
    it("should convert skill to Vercel AI SDK tool", () => {
      const tool = skill.toTool();

      expect(tool).toBeDefined();
      expect(tool.description).toBe("A mock skill for testing");
      expect(tool.execute).toBeInstanceOf(Function);
    });

    it("should execute tool successfully", async () => {
      const tool = skill.toTool(() => context);

      // Vercel AI SDK Tool execute requires two arguments: args and options
      // Using non-null assertion since we know execute is defined
      const result = await tool.execute!(
        { query: "test", limit: 5 },
        {} as never,
      );

      expect(result).toEqual({
        results: ["Result for: test"],
        total: 1,
      });
    });

    it("should throw error when tool execution fails", async () => {
      skill.mockExecuteImpl = async () => {
        throw new Error("Tool execution failed");
      };

      const tool = skill.toTool(() => context);

      await expect(
        tool.execute!({ query: "test" }, {} as never),
      ).rejects.toThrow("Tool execution failed");
    });
  });
});

describe("Error Classes", () => {
  describe("SkillValidationError", () => {
    it("should create with message and code", () => {
      const error = new SkillValidationError("Test error", "TEST_CODE");

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.name).toBe("SkillValidationError");
    });
  });

  describe("SkillTimeoutError", () => {
    it("should create with message", () => {
      const error = new SkillTimeoutError("Timeout error");

      expect(error.message).toBe("Timeout error");
      expect(error.name).toBe("SkillTimeoutError");
    });
  });
});
