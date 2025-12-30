/**
 * LLMIntentClassifier 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { LLMIntentClassifier, createLLMClassifier } from "../llm-classifier";

// Mock the AI SDK and provider router
jest.mock("ai", () => ({
  generateObject: jest.fn().mockResolvedValue({
    object: {},
    finishReason: "stop",
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
}));

jest.mock("@/lib/ai-providers", () => ({
  aiProviderRouter: {
    getModel: jest.fn(),
    selectProvider: jest.fn(),
    executeWithFallback: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { generateObject } from "ai";
import { aiProviderRouter } from "@/lib/ai-providers";

const _mockGenerateObject = generateObject as jest.MockedFunction<
  typeof generateObject
>;
const mockProviderRouter = aiProviderRouter as jest.Mocked<
  typeof aiProviderRouter
>;

describe("LLMIntentClassifier", () => {
  let classifier: LLMIntentClassifier;

  beforeEach(() => {
    jest.clearAllMocks();
    classifier = createLLMClassifier({
      cacheEnabled: false, // Disable cache for most tests
      debug: false,
    });

    // Default mock: provider router returns a model
    mockProviderRouter.getModel.mockReturnValue(
      {} as ReturnType<typeof mockProviderRouter.getModel>,
    );
    mockProviderRouter.selectProvider.mockReturnValue({
      provider: { name: "deepseek" },
      model: {},
      reason: "test",
    } as ReturnType<typeof mockProviderRouter.selectProvider>);
  });

  describe("createLLMClassifier", () => {
    it("should create a classifier with default config", () => {
      const instance = createLLMClassifier();

      expect(instance).toBeInstanceOf(LLMIntentClassifier);
      const config = instance.getConfig();
      expect(config.modelId).toBe("deepseek-chat");
      expect(config.timeoutMs).toBe(5000);
      expect(config.cacheEnabled).toBe(true);
      expect(config.temperature).toBe(0.3);
    });

    it("should create a classifier with custom config", () => {
      const instance = createLLMClassifier({
        modelId: "custom-model",
        timeoutMs: 3000,
        cacheEnabled: false,
        temperature: 0.5,
      });

      const config = instance.getConfig();
      expect(config.modelId).toBe("custom-model");
      expect(config.timeoutMs).toBe(3000);
      expect(config.cacheEnabled).toBe(false);
      expect(config.temperature).toBe(0.5);
    });
  });

  describe("classify", () => {
    it("should classify a message and return result", async () => {
      const mockResult = {
        type: "query" as const,
        subType: "search",
        confidence: 0.9,
        reasoning: "User wants to search",
      };

      mockProviderRouter.executeWithFallback.mockImplementation(
        async (_, _operation) => {
          // Simulate the operation being called
          return mockResult;
        },
      );

      const result = await classifier.classify("搜索 React 相关内容");

      expect(result).not.toBeNull();
      expect(result?.type).toBe("query");
      expect(result?.subType).toBe("search");
      expect(result?.confidence).toBe(0.9);
    });

    it("should return null when classification fails", async () => {
      mockProviderRouter.executeWithFallback.mockRejectedValue(
        new Error("API error"),
      );

      const result = await classifier.classify("some message");

      expect(result).toBeNull();
    });

    it("should handle missing provider gracefully", async () => {
      mockProviderRouter.getModel.mockReturnValue(null);
      mockProviderRouter.selectProvider.mockReturnValue(null);
      mockProviderRouter.executeWithFallback.mockRejectedValue(
        new Error("No provider"),
      );

      const result = await classifier.classify("test message");

      expect(result).toBeNull();
    });
  });

  describe("cache functionality", () => {
    let cachedClassifier: LLMIntentClassifier;

    beforeEach(() => {
      cachedClassifier = createLLMClassifier({
        cacheEnabled: true,
        cacheTTLMs: 60000,
      });
    });

    it("should return cached result for same message", async () => {
      const mockResult = {
        type: "action" as const,
        subType: "delete",
        confidence: 0.85,
        reasoning: "Delete action",
      };

      mockProviderRouter.executeWithFallback.mockResolvedValue(mockResult);

      // First call
      const result1 = await cachedClassifier.classify("删除书签");
      expect(result1).not.toBeNull();
      expect(mockProviderRouter.executeWithFallback).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await cachedClassifier.classify("删除书签");
      expect(result2).toEqual(result1);
      // Should not call API again
      expect(mockProviderRouter.executeWithFallback).toHaveBeenCalledTimes(1);
    });

    it("should normalize cache keys (case insensitive)", async () => {
      const mockResult = {
        type: "query" as const,
        confidence: 0.8,
        reasoning: "Query",
      };

      mockProviderRouter.executeWithFallback.mockResolvedValue(mockResult);

      await cachedClassifier.classify("Test Message");
      await cachedClassifier.classify("test message");
      await cachedClassifier.classify("TEST MESSAGE");

      // All should hit the same cache entry
      expect(mockProviderRouter.executeWithFallback).toHaveBeenCalledTimes(1);
    });

    it("should return cache stats", async () => {
      const mockResult = {
        type: "query" as const,
        confidence: 0.8,
        reasoning: "Query",
      };

      mockProviderRouter.executeWithFallback.mockResolvedValue(mockResult);

      await cachedClassifier.classify("message 1");
      await cachedClassifier.classify("message 2");

      const stats = cachedClassifier.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.activeCount).toBe(2);
      expect(stats.expiredCount).toBe(0);
    });

    it("should clear cache", async () => {
      const mockResult = {
        type: "query" as const,
        confidence: 0.8,
        reasoning: "Query",
      };

      mockProviderRouter.executeWithFallback.mockResolvedValue(mockResult);

      await cachedClassifier.classify("message");
      expect(cachedClassifier.getCacheStats().size).toBe(1);

      cachedClassifier.clearCache();
      expect(cachedClassifier.getCacheStats().size).toBe(0);
    });

    it("should cleanup expired cache entries", async () => {
      // Create classifier with very short TTL for testing
      const shortTTLClassifier = createLLMClassifier({
        cacheEnabled: true,
        cacheTTLMs: 10, // 10ms TTL
      });

      const mockResult = {
        type: "query" as const,
        confidence: 0.8,
        reasoning: "Query",
      };

      mockProviderRouter.executeWithFallback.mockResolvedValue(mockResult);

      await shortTTLClassifier.classify("message");
      expect(shortTTLClassifier.getCacheStats().activeCount).toBe(1);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      const cleaned = shortTTLClassifier.cleanupCache();
      expect(cleaned).toBe(1);
      expect(shortTTLClassifier.getCacheStats().size).toBe(0);
    });
  });

  describe("config management", () => {
    it("should update config", () => {
      const instance = createLLMClassifier();

      instance.updateConfig({
        timeoutMs: 10000,
        temperature: 0.7,
      });

      const config = instance.getConfig();
      expect(config.timeoutMs).toBe(10000);
      expect(config.temperature).toBe(0.7);
      // Other config should remain unchanged
      expect(config.modelId).toBe("deepseek-chat");
    });
  });

  describe("isValidIntentType", () => {
    it("should validate known intent types", () => {
      expect(classifier.isValidIntentType("query")).toBe(true);
      expect(classifier.isValidIntentType("action")).toBe(true);
      expect(classifier.isValidIntentType("organize")).toBe(true);
      expect(classifier.isValidIntentType("analyze")).toBe(true);
      expect(classifier.isValidIntentType("learn")).toBe(true);
      expect(classifier.isValidIntentType("create")).toBe(true);
      expect(classifier.isValidIntentType("chitchat")).toBe(true);
    });

    it("should reject unknown intent types", () => {
      expect(classifier.isValidIntentType("unknown")).toBe(false);
      expect(classifier.isValidIntentType("")).toBe(false);
      expect(classifier.isValidIntentType("QUERY")).toBe(false); // Case sensitive
    });
  });
});

describe("IntentClassifier with LLM fallback", () => {
  // Integration tests with IntentClassifier
  // These test the LLM fallback integration

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should not use LLM when disabled", async () => {
    const { createIntentClassifier } = await import("../intent-classifier");

    const classifier = createIntentClassifier({
      enableLLMFallback: false,
    });

    expect(classifier.isLLMFallbackEnabled()).toBe(false);
    expect(classifier.getLLMClassifier()).toBeNull();
  });

  it("should create LLM classifier when enabled", async () => {
    const { createIntentClassifier } = await import("../intent-classifier");

    const classifier = createIntentClassifier({
      enableLLMFallback: true,
      llmClassifierConfig: {
        cacheEnabled: false,
      },
    });

    expect(classifier.isLLMFallbackEnabled()).toBe(true);
    expect(classifier.getLLMClassifier()).not.toBeNull();
  });

  it("should return null for LLM cache stats when LLM is disabled", async () => {
    const { createIntentClassifier } = await import("../intent-classifier");

    const classifier = createIntentClassifier({
      enableLLMFallback: false,
    });

    expect(classifier.getLLMCacheStats()).toBeNull();
  });

  it("should return 0 when cleaning LLM cache with LLM disabled", async () => {
    const { createIntentClassifier } = await import("../intent-classifier");

    const classifier = createIntentClassifier({
      enableLLMFallback: false,
    });

    expect(classifier.cleanupLLMCache()).toBe(0);
  });
});
