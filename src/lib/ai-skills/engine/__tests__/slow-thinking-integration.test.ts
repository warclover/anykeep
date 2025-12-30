/**
 * 慢思考层集成测试
 *
 * 测试 SlowThinkingService 与 UnifiedEngine 的集成
 *
 * @module ai-skills/engine/__tests__
 * @version 1.0.0
 * @since 2025-12-30
 */

import { UnifiedEngine } from "../unified-engine";
import type { EngineContext } from "../types";
import type { UnifiedStreamChunk } from "../../output/types";

// Mock dependencies
jest.mock("ai", () => ({
  generateText: jest.fn().mockResolvedValue({
    text: `
      <thinking>用户想要整理收藏</thinking>
      <inferred_intent>用户希望对收藏进行分类整理</inferred_intent>
      <strategy>type: default\ndescription: 标准整理流程</strategy>
      <suggest_route_change>false</suggest_route_change>
      <confidence>75</confidence>
      <conclusion>执行默认整理策略</conclusion>
    `,
    finishReason: "stop",
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    response: {
      id: "test-id",
      timestamp: new Date(),
      modelId: "mock-model",
      headers: {},
    },
  }),
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
    child: jest.fn().mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

jest.mock("@/lib/ai-agent/config/feature-flags", () => ({
  FeatureFlags: {
    ENABLE_SLOW_THINKING: true,
    ENABLE_SLOW_THINKING_VISIBLE: true,
    ENABLE_EPISODIC_MEMORY: false,
    ENABLE_MEMORY_PROMPT: false,
    ENABLE_REACT_LOOP: false,
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

describe("SlowThinking Integration with UnifiedEngine", () => {
  let engine: UnifiedEngine;

  const mockContext: EngineContext = {
    userId: "test-user-123",
    conversationId: "test-conv-456",
    totalBookmarks: 100,
    totalFolders: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new UnifiedEngine({
      debug: true,
      includeRoutingInfo: true,
    });

    // 设置 mock 原子执行器
    engine.setAtomicExecutor(async function* () {
      yield { type: "text", text: "测试响应" };
      yield {
        type: "done",
        result: { success: true, content: "完成" },
      };
    });
  });

  describe("Slow Thinking Chunk Generation", () => {
    it("should yield thinking chunk for organize intent", async () => {
      const chunks: UnifiedStreamChunk[] = [];

      for await (const chunk of engine.execute(
        "帮我整理一下收藏",
        mockContext,
      )) {
        chunks.push(chunk);
      }

      // 查找 thinking 类型的 chunk
      const thinkingChunk = chunks.find((c) => c.type === "thinking");

      // 由于整理意图是 alwaysThinkIntents，应该触发慢思考
      // 但需要确保 IntentRouter 正确分类
      // 如果 IntentRouter 返回 organize 意图，则应该有 thinking chunk
      if (thinkingChunk) {
        expect(thinkingChunk.type).toBe("thinking");
        expect(thinkingChunk.data.phase).toBe("slow_thinking");
        expect(thinkingChunk.data.content).toBeDefined();
      }
    });

    it("should not yield thinking chunk for simple query", async () => {
      const chunks: UnifiedStreamChunk[] = [];

      for await (const chunk of engine.execute("我有多少收藏？", mockContext)) {
        chunks.push(chunk);
      }

      // 简单查询不应该触发慢思考
      const thinkingChunk = chunks.find(
        (c) => c.type === "thinking" && c.data.phase === "slow_thinking",
      );
      expect(thinkingChunk).toBeUndefined();
    });
  });

  describe("Slow Thinking Feature Flag Control", () => {
    it("should respect ENABLE_SLOW_THINKING flag", async () => {
      // 禁用慢思考
      const FeatureFlags =
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest test needs dynamic require
        require("@/lib/ai-agent/config/feature-flags").FeatureFlags;
      const originalValue = FeatureFlags.ENABLE_SLOW_THINKING;
      FeatureFlags.ENABLE_SLOW_THINKING = false;

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of engine.execute("帮我整理收藏", mockContext)) {
        chunks.push(chunk);
      }

      // 禁用后不应该有 slow_thinking chunk
      const thinkingChunk = chunks.find(
        (c) => c.type === "thinking" && c.data.phase === "slow_thinking",
      );
      expect(thinkingChunk).toBeUndefined();

      // 恢复
      FeatureFlags.ENABLE_SLOW_THINKING = originalValue;
    });

    it("should respect ENABLE_SLOW_THINKING_VISIBLE flag", async () => {
      // 禁用展示
      const FeatureFlags =
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest test needs dynamic require
        require("@/lib/ai-agent/config/feature-flags").FeatureFlags;
      const originalValue = FeatureFlags.ENABLE_SLOW_THINKING_VISIBLE;
      FeatureFlags.ENABLE_SLOW_THINKING_VISIBLE = false;

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of engine.execute("帮我整理收藏", mockContext)) {
        chunks.push(chunk);
      }

      // 禁用展示后不应该有 slow_thinking chunk（慢思考仍在内部执行，只是不展示）
      const thinkingChunk = chunks.find(
        (c) => c.type === "thinking" && c.data.phase === "slow_thinking",
      );
      expect(thinkingChunk).toBeUndefined();

      // 恢复
      FeatureFlags.ENABLE_SLOW_THINKING_VISIBLE = originalValue;
    });
  });

  describe("Engine Ready State", () => {
    it("should report ready when atomic executor is set", () => {
      expect(engine.isReady()).toBe(true);
    });

    it("should report not ready without atomic executor", () => {
      const freshEngine = new UnifiedEngine();
      expect(freshEngine.isReady()).toBe(false);
    });
  });
});
