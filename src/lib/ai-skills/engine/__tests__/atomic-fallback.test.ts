/**
 * AtomicFallbackHandler 单元测试
 *
 * @module ai-skills/engine/__tests__/atomic-fallback.test
 */

import {
  AtomicFallbackHandler,
  classifyError,
  generateFallbackResponse,
  generateFallbackChunks,
  DEFAULT_ATOMIC_FALLBACK_CONFIG,
} from "../atomic-fallback";
import type { UnifiedStreamChunk } from "../../output/types";

// ============================================
// classifyError 测试
// ============================================

describe("classifyError", () => {
  describe("瞬态错误识别", () => {
    const transientCases: [string, string][] = [
      ["timeout error", "transient"],
      ["network connection failed", "transient"],
      ["ECONNRESET", "transient"],
      ["ETIMEDOUT", "transient"],
      ["ENOTFOUND", "transient"],
      ["socket hang up", "transient"],
      ["rate limit exceeded", "transient"],
      ["HTTP 429 Too Many Requests", "transient"],
      ["HTTP 502 Bad Gateway", "transient"],
      ["HTTP 503 Service Unavailable", "transient"],
      ["HTTP 504 Gateway Timeout", "transient"],
      ["server overloaded", "transient"],
      ["temporarily unavailable", "transient"],
      ["please try again later", "transient"],
    ];

    it.each(transientCases)(
      '"%s" 应被分类为 %s',
      (errorMessage: string, expectedCategory: string) => {
        const result = classifyError(errorMessage);
        expect(result.category).toBe(expectedCategory);
        expect(result.isRetryable).toBe(true);
      },
    );
  });

  describe("永久性错误识别", () => {
    const permanentCases: [string, string][] = [
      ["invalid api key", "permanent"],
      ["unauthorized access", "permanent"],
      ["forbidden resource", "permanent"],
      ["resource not found", "permanent"],
      ["invalid request format", "permanent"],
      ["bad request", "permanent"],
      ["validation failed", "permanent"],
      ["HTTP 401 Unauthorized", "permanent"],
      ["HTTP 403 Forbidden", "permanent"],
      ["HTTP 404 Not Found", "permanent"],
      ["HTTP 400 Bad Request", "permanent"],
    ];

    it.each(permanentCases)(
      '"%s" 应被分类为 %s',
      (errorMessage: string, expectedCategory: string) => {
        const result = classifyError(errorMessage);
        expect(result.category).toBe(expectedCategory);
        expect(result.isRetryable).toBe(false);
      },
    );
  });

  describe("未知错误处理", () => {
    it("未知错误应被分类为 unknown 且不可重试", () => {
      const result = classifyError("some random error occurred");
      expect(result.category).toBe("unknown");
      expect(result.isRetryable).toBe(false);
    });

    it("应支持 Error 对象", () => {
      const error = new Error("network timeout");
      const result = classifyError(error);
      expect(result.category).toBe("transient");
      expect(result.isRetryable).toBe(true);
    });
  });
});

// ============================================
// generateFallbackResponse 测试
// ============================================

describe("generateFallbackResponse", () => {
  it("短输入应返回简洁响应", () => {
    const response = generateFallbackResponse("搜索书签", "timeout");
    expect(response).toContain("抱歉");
    expect(response).toContain("稍后再试");
  });

  it("长输入应返回详细响应", () => {
    const longInput =
      "帮我整理一下所有关于机器学习的书签，按时间排序并生成摘要报告";
    const response = generateFallbackResponse(longInput, "timeout");
    expect(response).toContain("系统遇到了一些问题");
    expect(response).toContain("1.");
    expect(response).toContain("2.");
    expect(response).toContain("3.");
  });

  it("应支持自定义模板", () => {
    const template = "请求失败：{{error}}。您的输入：{{input}}";
    const response = generateFallbackResponse("测试输入", "网络错误", template);
    expect(response).toBe("请求失败：网络错误。您的输入：测试输入");
  });
});

// ============================================
// generateFallbackChunks 测试
// ============================================

describe("generateFallbackChunks", () => {
  it("应生成正确的块序列", async () => {
    const chunks: UnifiedStreamChunk[] = [];
    for await (const chunk of generateFallbackChunks(
      "测试输入",
      "网络错误",
      DEFAULT_ATOMIC_FALLBACK_CONFIG,
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(3);

    // 第一个块：降级通知
    expect(chunks[0].type).toBe("fallback");
    if (chunks[0].type === "fallback") {
      expect(chunks[0].data.originalMode).toBe("atomic");
      expect(chunks[0].data.fallbackMode).toBe("static");
    }

    // 第二个块：文本响应
    expect(chunks[1].type).toBe("text");
    if (chunks[1].type === "text") {
      expect(chunks[1].data.text).toBeTruthy();
    }

    // 第三个块：完成
    expect(chunks[2].type).toBe("done");
    if (chunks[2].type === "done") {
      expect(chunks[2].data.success).toBe(false);
    }
  });
});

// ============================================
// AtomicFallbackHandler 测试
// ============================================

describe("AtomicFallbackHandler", () => {
  let handler: AtomicFallbackHandler;

  beforeEach(() => {
    handler = new AtomicFallbackHandler({
      maxRetries: 2,
      retryDelayMs: 10, // 测试中使用短延迟
    });
  });

  describe("配置管理", () => {
    it("应使用默认配置", () => {
      const defaultHandler = new AtomicFallbackHandler();
      const config = defaultHandler.getConfig();
      expect(config.enableRetry).toBe(true);
      expect(config.maxRetries).toBe(2);
      expect(config.enableFallbackResponse).toBe(true);
    });

    it("应支持自定义配置", () => {
      const customHandler = new AtomicFallbackHandler({
        maxRetries: 5,
        enableFallbackResponse: false,
      });
      const config = customHandler.getConfig();
      expect(config.maxRetries).toBe(5);
      expect(config.enableFallbackResponse).toBe(false);
    });

    it("应支持更新配置", () => {
      handler.updateConfig({ maxRetries: 10 });
      expect(handler.getConfig().maxRetries).toBe(10);
    });
  });

  describe("成功执行", () => {
    it("成功时应直接返回结果", async () => {
      const mockExecutor =
        async function* (): AsyncGenerator<UnifiedStreamChunk> {
          yield { type: "text", data: { text: "Hello", isPartial: false } };
          yield { type: "done", data: { success: true } };
        };

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of handler.executeWithRetry(
        mockExecutor,
        "test",
        {},
      )) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0].type).toBe("text");
      expect(chunks[1].type).toBe("done");
    });
  });

  describe("重试逻辑", () => {
    it("瞬态错误应触发重试", async () => {
      let callCount = 0;

      const mockExecutor =
        async function* (): AsyncGenerator<UnifiedStreamChunk> {
          callCount++;
          if (callCount < 3) {
            yield {
              type: "error",
              data: { message: "timeout error", retryable: true },
            };
          } else {
            yield { type: "text", data: { text: "Success", isPartial: false } };
            yield { type: "done", data: { success: true } };
          }
        };

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of handler.executeWithRetry(
        mockExecutor,
        "test",
        {},
      )) {
        chunks.push(chunk);
      }

      expect(callCount).toBe(3); // 初始 + 2次重试
      expect(chunks.some((c) => c.type === "text")).toBe(true);
    });

    it("永久性错误不应重试", async () => {
      let callCount = 0;

      const mockExecutor =
        async function* (): AsyncGenerator<UnifiedStreamChunk> {
          callCount++;
          yield {
            type: "error",
            data: { message: "invalid api key", retryable: false },
          };
        };

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of handler.executeWithRetry(
        mockExecutor,
        "test",
        {},
      )) {
        chunks.push(chunk);
      }

      expect(callCount).toBe(1); // 仅执行一次
    });

    it("超过最大重试次数后应生成降级响应", async () => {
      const mockExecutor =
        async function* (): AsyncGenerator<UnifiedStreamChunk> {
          yield {
            type: "error",
            data: { message: "timeout error", retryable: true },
          };
        };

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of handler.executeWithRetry(
        mockExecutor,
        "test",
        {},
      )) {
        chunks.push(chunk);
      }

      // 应包含 fallback 块
      expect(chunks.some((c) => c.type === "fallback")).toBe(true);
      expect(chunks.some((c) => c.type === "text")).toBe(true);
    });
  });

  describe("禁用重试", () => {
    it("禁用重试时应直接生成降级响应", async () => {
      const noRetryHandler = new AtomicFallbackHandler({
        enableRetry: false,
        retryDelayMs: 10,
      });

      let callCount = 0;
      const mockExecutor =
        async function* (): AsyncGenerator<UnifiedStreamChunk> {
          callCount++;
          yield {
            type: "error",
            data: { message: "timeout error", retryable: true },
          };
        };

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of noRetryHandler.executeWithRetry(
        mockExecutor,
        "test",
        {},
      )) {
        chunks.push(chunk);
      }

      expect(callCount).toBe(1);
      expect(chunks.some((c) => c.type === "fallback")).toBe(true);
    });
  });

  describe("禁用降级响应", () => {
    it("禁用降级响应时应返回错误块", async () => {
      const noFallbackHandler = new AtomicFallbackHandler({
        enableFallbackResponse: false,
        maxRetries: 0,
        retryDelayMs: 10,
      });

      const mockExecutor =
        async function* (): AsyncGenerator<UnifiedStreamChunk> {
          yield {
            type: "error",
            data: { message: "timeout error", retryable: true },
          };
        };

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of noFallbackHandler.executeWithRetry(
        mockExecutor,
        "test",
        {},
      )) {
        chunks.push(chunk);
      }

      expect(chunks.some((c) => c.type === "error")).toBe(true);
      expect(chunks.some((c) => c.type === "fallback")).toBe(false);
    });
  });
});
