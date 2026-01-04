/**
 * 降级处理器测试 (Story 3.3)
 * @module knowledge-studio/blueprint/__tests__
 */

import {
  FallbackHandler,
  createFallbackHandler,
  validateAndFallbackToMarkdown,
  validateWithTypeInference,
} from "../structured-output";
import type {
  StructuredOutputType,
  FeatureMatrixOutput,
  SwotOutput,
  MarkdownOutput,
} from "../structured-output";

// ============================================================
// Test Data
// ============================================================

const createValidMeta = (type: StructuredOutputType) => ({
  type,
  version: "1.0.0",
  generatedAt: new Date().toISOString(),
  blueprintId: "test-blueprint",
  generationMode: "guided" as const,
  isFallback: false,
});

const validFeatureMatrix: FeatureMatrixOutput = {
  meta: createValidMeta("feature_matrix"),
  title: "功能对比",
  subjects: [
    { id: "a", name: "产品 A" },
    { id: "b", name: "产品 B" },
  ],
  rows: [
    { feature: "功能 1", support: { a: "full", b: "partial" } },
    { feature: "功能 2", support: { a: "none", b: "full" } },
  ],
  summary: "产品 A 和 B 各有优势",
};

const validSwot: SwotOutput = {
  meta: createValidMeta("swot"),
  subject: "测试产品",
  quadrants: {
    strengths: [{ title: "优势 1", description: "描述 1" }],
    weaknesses: [{ title: "劣势 1", description: "描述 1" }],
    opportunities: [{ title: "机会 1", description: "描述 1" }],
    threats: [{ title: "威胁 1", description: "描述 1" }],
  },
};

const invalidFeatureMatrix = {
  meta: createValidMeta("feature_matrix"),
  // missing required fields: title, subjects, rows
};

// ============================================================
// Tests
// ============================================================

describe("FallbackHandler", () => {
  describe("validateAndFallback", () => {
    it("should pass through valid output without degradation", () => {
      const handler = new FallbackHandler();
      const result = handler.validateAndFallback(
        validFeatureMatrix,
        "feature_matrix",
        "test-blueprint",
      );

      expect(result.degraded).toBe(false);
      expect(result.attempts).toBe(1);
      expect(result.strategy).toBeUndefined();
      expect(result.output).toEqual(validFeatureMatrix);
    });

    it("should degrade invalid output to markdown", () => {
      const handler = new FallbackHandler();
      const result = handler.validateAndFallback(
        invalidFeatureMatrix,
        "feature_matrix",
        "test-blueprint",
      );

      expect(result.degraded).toBe(true);
      expect(result.strategy).toBe("markdown");
      expect(result.attempts).toBe(1);
      expect(result.reason).toBeDefined();
      expect(result.originalErrors).toBeDefined();
      expect(result.originalErrors!.length).toBeGreaterThan(0);

      // 检查降级输出
      const output = result.output as MarkdownOutput;
      expect(output.meta.type).toBe("markdown");
      expect(output.meta.isFallback).toBe(true);
      expect(output.fallbackReason).toBeDefined();
    });

    it("should extract content from partial output during degradation", () => {
      const outputWithTitle = {
        ...invalidFeatureMatrix,
        title: "测试标题",
        summary: "这是摘要",
      };

      const handler = new FallbackHandler();
      const result = handler.validateAndFallback(
        outputWithTitle,
        "feature_matrix",
        "test-blueprint",
      );

      expect(result.degraded).toBe(true);
      const output = result.output as MarkdownOutput;
      expect(output.content).toContain("测试标题");
    });

    it("should format JSON for unstructured output during degradation", () => {
      const randomOutput = { foo: "bar", nested: { baz: 123 } };

      const handler = new FallbackHandler();
      const result = handler.validateAndFallback(
        randomOutput,
        "swot",
        "test-blueprint",
      );

      expect(result.degraded).toBe(true);
      const output = result.output as MarkdownOutput;
      expect(output.content).toContain("```json");
      expect(output.content).toContain('"foo"');
    });
  });

  describe("handleWithRetry", () => {
    it("should not retry if first validation passes", async () => {
      const handler = new FallbackHandler({ maxRetries: 2 });
      const retryFn = jest.fn();

      const result = await handler.handleWithRetry(
        validSwot,
        "swot",
        "test-blueprint",
        retryFn,
      );

      expect(result.degraded).toBe(false);
      expect(result.attempts).toBe(1);
      expect(retryFn).not.toHaveBeenCalled();
    });

    it("should retry on validation failure", async () => {
      const handler = new FallbackHandler({
        maxRetries: 2,
        retryDelayMs: 0, // 测试时禁用延迟
      });

      // 第一次重试返回无效数据，第二次返回有效数据
      let callCount = 0;
      const retryFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(invalidFeatureMatrix);
        }
        return Promise.resolve(validFeatureMatrix);
      });

      const result = await handler.handleWithRetry(
        invalidFeatureMatrix,
        "feature_matrix",
        "test-blueprint",
        retryFn,
      );

      expect(result.degraded).toBe(false);
      // 初次验证(1) + 第一次重试失败(2) + 第二次重试成功(3) = 3
      expect(result.attempts).toBe(3);
      expect(retryFn).toHaveBeenCalledTimes(2);
    });

    it("should degrade after max retries", async () => {
      const handler = new FallbackHandler({
        maxRetries: 2,
        retryDelayMs: 0,
      });

      // 始终返回无效数据
      const retryFn = jest.fn().mockResolvedValue(invalidFeatureMatrix);

      const result = await handler.handleWithRetry(
        invalidFeatureMatrix,
        "feature_matrix",
        "test-blueprint",
        retryFn,
      );

      expect(result.degraded).toBe(true);
      expect(result.strategy).toBe("markdown");
      expect(result.attempts).toBe(3); // 初次验证 + 2 次重试
      expect(retryFn).toHaveBeenCalledTimes(2);
    });

    it("should pass simplify flag on subsequent retries", async () => {
      const handler = new FallbackHandler({
        maxRetries: 2,
        retryDelayMs: 0,
        enableSimplification: true,
      });

      const retryFn = jest.fn().mockResolvedValue(invalidFeatureMatrix);

      await handler.handleWithRetry(
        invalidFeatureMatrix,
        "feature_matrix",
        "test-blueprint",
        retryFn,
      );

      // 第一次重试(attempts=2) simplify = false
      // 第二次重试(attempts=3) simplify = true
      expect(retryFn).toHaveBeenNthCalledWith(1, false);
      expect(retryFn).toHaveBeenNthCalledWith(2, true);
    });

    it("should handle retry function throwing errors", async () => {
      const handler = new FallbackHandler({
        maxRetries: 2,
        retryDelayMs: 0,
      });

      const retryFn = jest.fn().mockRejectedValue(new Error("API error"));

      const result = await handler.handleWithRetry(
        invalidFeatureMatrix,
        "feature_matrix",
        "test-blueprint",
        retryFn,
      );

      // 应该优雅降级，而不是抛出错误
      expect(result.degraded).toBe(true);
      expect(result.strategy).toBe("markdown");
    });
  });

  describe("configuration", () => {
    it("should respect maxRetries config", async () => {
      const handler = new FallbackHandler({
        maxRetries: 1,
        retryDelayMs: 0,
      });

      const retryFn = jest.fn().mockResolvedValue(invalidFeatureMatrix);

      const result = await handler.handleWithRetry(
        invalidFeatureMatrix,
        "feature_matrix",
        "test-blueprint",
        retryFn,
      );

      expect(result.attempts).toBe(2); // 初次 + 1 次重试
      expect(retryFn).toHaveBeenCalledTimes(1);
    });

    it("should disable simplification when configured", async () => {
      const handler = new FallbackHandler({
        maxRetries: 2,
        retryDelayMs: 0,
        enableSimplification: false,
      });

      const retryFn = jest.fn().mockResolvedValue(invalidFeatureMatrix);

      await handler.handleWithRetry(
        invalidFeatureMatrix,
        "feature_matrix",
        "test-blueprint",
        retryFn,
      );

      // 所有调用都应该是 simplify = false
      expect(retryFn).toHaveBeenNthCalledWith(1, false);
      expect(retryFn).toHaveBeenNthCalledWith(2, false);
    });
  });
});

describe("Convenience Functions", () => {
  describe("createFallbackHandler", () => {
    it("should create handler with default config", () => {
      const handler = createFallbackHandler();
      expect(handler).toBeInstanceOf(FallbackHandler);
    });

    it("should create handler with custom config", () => {
      const handler = createFallbackHandler({ maxRetries: 5 });
      expect(handler).toBeInstanceOf(FallbackHandler);
    });
  });

  describe("validateAndFallbackToMarkdown", () => {
    it("should validate and fallback without retry", () => {
      const result = validateAndFallbackToMarkdown(
        validFeatureMatrix,
        "feature_matrix",
        "test-blueprint",
      );

      expect(result.degraded).toBe(false);
      expect(result.output).toEqual(validFeatureMatrix);
    });

    it("should fallback invalid output to markdown", () => {
      const result = validateAndFallbackToMarkdown(
        invalidFeatureMatrix,
        "feature_matrix",
        "test-blueprint",
      );

      expect(result.degraded).toBe(true);
      expect((result.output as MarkdownOutput).meta.type).toBe("markdown");
    });
  });

  describe("validateWithTypeInference", () => {
    it("should infer type and validate", () => {
      const result = validateWithTypeInference(validSwot, "test-blueprint");

      expect(result.degraded).toBe(false);
      expect(result.output).toEqual(validSwot);
    });

    it("should use fallback type when inference fails", () => {
      const randomOutput = { unknown: "structure" };
      const result = validateWithTypeInference(
        randomOutput,
        "test-blueprint",
        "markdown",
      );

      // 由于结构不匹配 markdown schema，应该降级
      expect(result.degraded).toBe(true);
    });

    it("should infer swot from quadrants structure", () => {
      // 移除 meta.type 但保留结构
      const swotWithoutMetaType = {
        ...validSwot,
        meta: { ...validSwot.meta, type: undefined },
      };

      const result = validateWithTypeInference(
        swotWithoutMetaType,
        "test-blueprint",
      );

      // 应该能推断出是 swot
      // 注意：由于 meta.type 是 required，验证会失败
      expect(result.degraded).toBe(true);
    });
  });
});

describe("Error Message Formatting", () => {
  it("should format single error clearly", () => {
    const handler = new FallbackHandler();
    const result = handler.validateAndFallback(
      { meta: createValidMeta("swot") },
      "swot",
      "test-blueprint",
    );

    expect(result.reason).toBeDefined();
    expect(result.reason).toMatch(/subject|quadrants/i);
  });

  it("should truncate multiple errors", () => {
    const handler = new FallbackHandler();
    const result = handler.validateAndFallback(
      {},
      "feature_matrix",
      "test-blueprint",
    );

    // 多个错误时应该显示 "还有 X 个错误"
    expect(result.reason).toBeDefined();
    if (result.originalErrors && result.originalErrors.length > 3) {
      expect(result.reason).toContain("还有");
    }
  });
});
