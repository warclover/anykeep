/**
 * 慢思考服务测试
 *
 * @module ai-agent/slow-thinking/__tests__
 */

import {
  SlowThinkingService,
  createSlowThinkingService,
} from "../slow-thinking-service";
import type {
  SlowThinkingRouteResult,
  SlowThinkingDynamicContext,
} from "../types";
import { createGenerateTextMock } from "@/lib/test-utils/ai-sdk-mocks";

// Mock dependencies
jest.mock("ai", () => ({
  generateText: jest.fn().mockResolvedValue(
    // 默认返回空文本，具体测试会覆盖
    {
      text: "",
      finishReason: "stop",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      response: {
        id: "default",
        timestamp: new Date(),
        modelId: "mock",
        headers: {},
      },
    },
  ),
}));

jest.mock("@ai-sdk/deepseek", () => ({
  deepseek: jest.fn().mockReturnValue({ id: "mock-deepseek-model" }),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("@/lib/ai-agent/config/feature-flags", () => ({
  FeatureFlags: {
    ENABLE_SLOW_THINKING: true,
    ENABLE_SLOW_THINKING_VISIBLE: true,
  },
}));

jest.mock("@/lib/ai-providers/model-tier-config", () => ({
  MODEL_TIER_CONFIG: {
    fast: {
      id: "fast",
      provider: { name: "deepseek", model: "deepseek-chat" },
    },
    standard: {
      id: "standard",
      provider: { name: "deepseek", model: "deepseek-chat" },
    },
    deep: {
      id: "deep",
      provider: { name: "deepseek", model: "deepseek-reasoner" },
    },
  },
}));

import { generateText } from "ai";

const mockGenerateText = generateText as jest.MockedFunction<
  typeof generateText
>;

describe("SlowThinkingService", () => {
  let service: SlowThinkingService;

  const mockRouteResult: SlowThinkingRouteResult = {
    intent: {
      type: "query",
      subType: "search",
    },
    complexity: {
      level: "medium",
      score: 55,
    },
    mode: "atomic",
  };

  const mockContext: SlowThinkingDynamicContext = {
    stats: { totalBookmarks: 100 },
    recentActivity: { lastSaved: { title: "Test" } },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SlowThinkingService();
  });

  describe("constructor", () => {
    it("should use default config when no config provided", () => {
      expect(service.config.enabled).toBe(true);
      expect(service.config.showToUser).toBe(true);
      expect(service.config.maxThinkingTime).toBe(5000);
      expect(service.config.complexityThreshold).toBe(40);
    });

    it("should merge custom config with defaults", () => {
      const customService = new SlowThinkingService({
        maxThinkingTime: 10000,
        complexityThreshold: 60,
      });
      expect(customService.config.maxThinkingTime).toBe(10000);
      expect(customService.config.complexityThreshold).toBe(60);
      expect(customService.config.enabled).toBe(true); // default
    });
  });

  describe("shouldThink", () => {
    it("should return false when disabled", () => {
      const disabledService = new SlowThinkingService({ enabled: false });
      expect(disabledService.shouldThink(mockRouteResult)).toBe(false);
    });

    it("should return true for always-think intents regardless of complexity", () => {
      const lowComplexityRoute: SlowThinkingRouteResult = {
        ...mockRouteResult,
        intent: { type: "organize" },
        complexity: { level: "simple", score: 20 },
      };
      expect(service.shouldThink(lowComplexityRoute)).toBe(true);
    });

    it("should return true for analyze intent", () => {
      const analyzeRoute: SlowThinkingRouteResult = {
        ...mockRouteResult,
        intent: { type: "analyze" },
        complexity: { level: "simple", score: 10 },
      };
      expect(service.shouldThink(analyzeRoute)).toBe(true);
    });

    it("should return true for learn intent", () => {
      const learnRoute: SlowThinkingRouteResult = {
        ...mockRouteResult,
        intent: { type: "learn" },
        complexity: { level: "simple", score: 10 },
      };
      expect(service.shouldThink(learnRoute)).toBe(true);
    });

    it("should return false when complexity below threshold", () => {
      const simpleRoute: SlowThinkingRouteResult = {
        ...mockRouteResult,
        intent: { type: "query" },
        complexity: { level: "simple", score: 30 },
      };
      expect(service.shouldThink(simpleRoute)).toBe(false);
    });

    it("should return true when complexity above threshold and not simple", () => {
      const complexRoute: SlowThinkingRouteResult = {
        ...mockRouteResult,
        intent: { type: "query" },
        complexity: { level: "medium", score: 50 },
      };
      expect(service.shouldThink(complexRoute)).toBe(true);
    });

    it("should return false for simple level even above threshold", () => {
      const simpleHighScore: SlowThinkingRouteResult = {
        ...mockRouteResult,
        intent: { type: "query" },
        complexity: { level: "simple", score: 45 },
      };
      expect(service.shouldThink(simpleHighScore)).toBe(false);
    });
  });

  describe("shouldShowToUser", () => {
    it("should return true when both config and flag are enabled", () => {
      const showService = new SlowThinkingService({ showToUser: true });
      expect(showService.shouldShowToUser()).toBe(true);
    });

    it("should return false when config showToUser is false", () => {
      const hideService = new SlowThinkingService({ showToUser: false });
      expect(hideService.shouldShowToUser()).toBe(false);
    });
  });

  describe("generateMonologue", () => {
    const validLLMResponse = `
      <thinking>
      1. User wants to search
      2. Context is clear
      </thinking>
      <inferred_intent>用户想搜索内容</inferred_intent>
      <strategy>type: default\ndescription: Standard search</strategy>
      <suggest_route_change>false</suggest_route_change>
      <confidence>80</confidence>
    `;

    beforeEach(() => {
      mockGenerateText.mockResolvedValue(
        createGenerateTextMock({
          text: validLLMResponse,
          finishReason: "stop",
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          response: {
            id: "test-id",
            timestamp: new Date(),
            modelId: "mock-model",
            headers: {},
          },
        }),
      );
    });

    it("should return null when feature flag is disabled", async () => {
      jest.doMock("@/lib/ai-agent/config/feature-flags", () => ({
        FeatureFlags: {
          ENABLE_SLOW_THINKING: false,
        },
      }));

      // Create a new service that checks the flag
      const disabledFlagService = new SlowThinkingService({ enabled: true });

      // Mock the feature flag directly in the test
      const originalFeatureFlags =
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest test needs dynamic require
        require("@/lib/ai-agent/config/feature-flags").FeatureFlags;
      originalFeatureFlags.ENABLE_SLOW_THINKING = false;

      const result = await disabledFlagService.generateMonologue(
        "test",
        mockRouteResult,
        mockContext,
      );

      expect(result).toBeNull();

      // Restore
      originalFeatureFlags.ENABLE_SLOW_THINKING = true;
    });

    it("should return null when shouldThink returns false", async () => {
      const simpleRoute: SlowThinkingRouteResult = {
        ...mockRouteResult,
        intent: { type: "query" },
        complexity: { level: "simple", score: 20 },
      };

      const result = await service.generateMonologue(
        "test",
        simpleRoute,
        mockContext,
      );

      expect(result).toBeNull();
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("should call generateText with correct parameters", async () => {
      await service.generateMonologue("搜索内容", mockRouteResult, mockContext);

      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(callArgs.maxOutputTokens).toBe(1000);
      expect(callArgs.temperature).toBe(0.7);
    });

    it("should return parsed monologue on success", async () => {
      const result = await service.generateMonologue(
        "搜索内容",
        mockRouteResult,
        mockContext,
      );

      expect(result).not.toBeNull();
      expect(result?.inferredIntent).toBe("用户想搜索内容");
      expect(result?.suggestRouteChange).toBe(false);
      expect(result?.confidence).toBe(80);
      expect(result?.thinkingDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("should return default monologue on LLM error", async () => {
      mockGenerateText.mockRejectedValueOnce(new Error("API Error"));

      const result = await service.generateMonologue(
        "test message",
        mockRouteResult,
        mockContext,
      );

      expect(result).not.toBeNull();
      expect(result?.inferredIntent).toBe("test message");
      expect(result?.suggestedStrategy.type).toBe("default");
      expect(result?.confidence).toBe(50);
    });

    it("should return default monologue on invalid LLM output", async () => {
      mockGenerateText.mockResolvedValueOnce(
        createGenerateTextMock({
          text: "invalid output without proper tags",
          finishReason: "stop",
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          response: {
            id: "test-id",
            timestamp: new Date(),
            modelId: "mock-model",
            headers: {},
          },
        }),
      );

      const result = await service.generateMonologue(
        "test message",
        mockRouteResult,
        mockContext,
      );

      expect(result).not.toBeNull();
      // Should fall back to default because validation fails (inferredIntent too short)
      expect(result?.originalInput).toBe("test message");
    });

    it("should handle timeout gracefully", async () => {
      // Create a service with very short timeout
      const shortTimeoutService = new SlowThinkingService({
        maxThinkingTime: 10, // 10ms
      });

      // Make generateText take longer than timeout
      mockGenerateText.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve(
                  createGenerateTextMock({
                    text: validLLMResponse,
                    finishReason: "stop",
                    usage: {
                      inputTokens: 100,
                      outputTokens: 50,
                      totalTokens: 150,
                    },
                    response: {
                      id: "test-id",
                      timestamp: new Date(),
                      modelId: "mock-model",
                      headers: {},
                    },
                  }),
                ),
              100,
            ),
          ),
      );

      const result = await shortTimeoutService.generateMonologue(
        "test",
        mockRouteResult,
        mockContext,
      );

      // Should return default monologue due to timeout
      expect(result).not.toBeNull();
      expect(result?.suggestedStrategy.type).toBe("default");
    });
  });

  describe("createSlowThinkingService", () => {
    it("should create service with default config", () => {
      const service = createSlowThinkingService();
      expect(service).toBeInstanceOf(SlowThinkingService);
      expect(service.config.enabled).toBe(true);
    });

    it("should create service with custom config", () => {
      const service = createSlowThinkingService({ maxThinkingTime: 8000 });
      expect(service.config.maxThinkingTime).toBe(8000);
    });
  });
});
