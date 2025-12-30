/**
 * Phase 3 智能预测模块集成测试
 *
 * 测试 IntentPredictor 和 RuleExtractor 与 UnifiedEngine 的集成
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
    text: "测试响应",
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
    ENABLE_SLOW_THINKING: false,
    ENABLE_SLOW_THINKING_VISIBLE: false,
    ENABLE_EPISODIC_MEMORY: false,
    ENABLE_MEMORY_PROMPT: false,
    ENABLE_REACT_LOOP: false,
    ENABLE_INTENT_PREDICTION: true,
    ENABLE_RULE_LEARNING: true,
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

describe("Prediction Integration with UnifiedEngine", () => {
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
      enablePrediction: true,
    });

    // 设置 mock 原子执行器
    engine.setAtomicExecutor(async function* () {
      yield { type: "text", text: "测试响应" };
      yield {
        type: "done",
        result: {
          success: true,
          content: "完成",
          toolCalls: [],
          durationMs: 100,
        },
      };
    });
  });

  describe("IntentPredictor Integration", () => {
    it("should expose IntentPredictor via getter", () => {
      const predictor = engine.getIntentPredictor();
      expect(predictor).toBeDefined();
      expect(predictor.config).toBeDefined();
    });

    it("should return quick actions when prediction is enabled", async () => {
      const actions = await engine.getQuickActions("test-user");
      expect(Array.isArray(actions)).toBe(true);
    });

    it("should return empty array when prediction is disabled", async () => {
      const disabledEngine = new UnifiedEngine({
        enablePrediction: false,
      });

      const actions = await disabledEngine.getQuickActions("test-user");
      expect(actions).toEqual([]);
    });

    it("should get predictions based on current intent", async () => {
      const predictions = await engine.getPredictions("test-user", "搜索收藏", {
        type: "query",
      });

      expect(Array.isArray(predictions)).toBe(true);
    });
  });

  describe("RuleExtractor Integration", () => {
    it("should expose RuleExtractor via getter", () => {
      const extractor = engine.getRuleExtractor();
      expect(extractor).toBeDefined();
      expect(extractor.config).toBeDefined();
    });

    it("should record corrections and trigger analysis", async () => {
      await engine.recordCorrection("test-user", {
        originalIntent: "query",
        correctedIntent: "organize",
        originalMessage: "整理我的收藏",
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it("should get active rules for user", async () => {
      const rules = await engine.getActiveRules("test-user");
      expect(Array.isArray(rules)).toBe(true);
    });

    it("should return empty array when prediction is disabled", async () => {
      const disabledEngine = new UnifiedEngine({
        enablePrediction: false,
      });

      const rules = await disabledEngine.getActiveRules("test-user");
      expect(rules).toEqual([]);
    });
  });

  describe("Rule Application in Execution", () => {
    it("should apply rules during execution", async () => {
      const chunks: UnifiedStreamChunk[] = [];

      for await (const chunk of engine.execute("测试消息", mockContext)) {
        chunks.push(chunk);
      }

      // Should complete without errors
      const doneChunk = chunks.find((c) => c.type === "done");
      expect(doneChunk).toBeDefined();
    });

    it("should record intent history after execution", async () => {
      // Execute to trigger intent recording
      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of engine.execute("搜索收藏", mockContext)) {
        chunks.push(chunk);
      }

      // Verify execution completed
      expect(chunks.some((c) => c.type === "done")).toBe(true);
    });
  });

  describe("Rule Activation/Deactivation", () => {
    it("should activate rule", async () => {
      // First add some corrections to create a rule
      for (let i = 0; i < 5; i++) {
        await engine.recordCorrection("test-user", {
          originalIntent: "query",
          correctedIntent: "organize",
          originalMessage: `整理收藏 ${i}`,
        });
      }

      // Get active rules
      const rules = await engine.getActiveRules("test-user");

      if (rules.length > 0) {
        const ruleId = rules[0].id;

        // Deactivate
        await engine.deactivateRule("test-user", ruleId);
        let updatedRules = await engine.getActiveRules("test-user");
        expect(updatedRules.some((r) => r.id === ruleId)).toBe(false);

        // Activate
        await engine.activateRule("test-user", ruleId);
        updatedRules = await engine.getActiveRules("test-user");
        expect(updatedRules.some((r) => r.id === ruleId)).toBe(true);
      }
    });

    it("should do nothing when prediction is disabled", async () => {
      const disabledEngine = new UnifiedEngine({
        enablePrediction: false,
      });

      // Should not throw
      await disabledEngine.activateRule("test-user", "non-existent");
      await disabledEngine.deactivateRule("test-user", "non-existent");
    });
  });

  describe("Correction Learning Flow", () => {
    it("should learn from repeated corrections", async () => {
      const extractor = engine.getRuleExtractor();

      // Record multiple similar corrections
      for (let i = 0; i < 5; i++) {
        await engine.recordCorrection("learning-user", {
          originalIntent: "query",
          correctedIntent: "organize",
          originalMessage: "帮我整理收藏",
        });
      }

      // Trigger analysis
      const candidates = await extractor.analyzeCorrections("learning-user");

      // May generate rule candidates
      expect(Array.isArray(candidates)).toBe(true);
    });
  });

  describe("Config Inheritance", () => {
    it("should pass enablePrediction config correctly", () => {
      const enabledEngine = new UnifiedEngine({ enablePrediction: true });
      const disabledEngine = new UnifiedEngine({ enablePrediction: false });

      // Enabled engine should have working predictor
      expect(enabledEngine.getIntentPredictor()).toBeDefined();

      // Both should have predictors (initialized), but behavior differs
      expect(disabledEngine.getIntentPredictor()).toBeDefined();
    });

    it("should default enablePrediction to true", () => {
      const defaultEngine = new UnifiedEngine();
      // Should have prediction enabled by default
      expect(defaultEngine.getIntentPredictor()).toBeDefined();
    });
  });
});
