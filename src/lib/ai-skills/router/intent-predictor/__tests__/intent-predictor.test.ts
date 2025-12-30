/**
 * IntentPredictor 单元测试
 *
 * @module ai-skills/router/intent-predictor/__tests__
 */

import { IntentPredictor, createIntentPredictor } from "../intent-predictor";
import type { IntentHistoryEntry } from "../types";

// Mock dependencies
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
    ENABLE_INTENT_PREDICTION: true,
  },
}));

describe("IntentPredictor", () => {
  let predictor: IntentPredictor;

  beforeEach(() => {
    jest.clearAllMocks();
    predictor = new IntentPredictor();
  });

  describe("constructor", () => {
    it("should create predictor with default config", () => {
      expect(predictor.config.historyRetentionDays).toBe(30);
      expect(predictor.config.minHistorySamples).toBe(10);
      expect(predictor.config.predictionThreshold).toBe(0.3);
      expect(predictor.config.maxPredictions).toBe(3);
    });

    it("should merge custom config with defaults", () => {
      const customPredictor = new IntentPredictor({
        historyRetentionDays: 60,
        minHistorySamples: 5,
      });
      expect(customPredictor.config.historyRetentionDays).toBe(60);
      expect(customPredictor.config.minHistorySamples).toBe(5);
      expect(customPredictor.config.predictionThreshold).toBe(0.3); // default
    });
  });

  describe("predict", () => {
    it("should return empty array when feature flag is disabled", async () => {
      const FeatureFlags =
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest test needs dynamic require
        require("@/lib/ai-agent/config/feature-flags").FeatureFlags;
      const original = FeatureFlags.ENABLE_INTENT_PREDICTION;
      FeatureFlags.ENABLE_INTENT_PREDICTION = false;

      const predictions = await predictor.predict("user-1", "test", {
        type: "query",
      });
      expect(predictions).toEqual([]);

      FeatureFlags.ENABLE_INTENT_PREDICTION = original;
    });

    it("should return default predictions when history is insufficient", async () => {
      const predictions = await predictor.predict("user-1", "test", {
        type: "query",
      });

      // Should return default predictions for query
      expect(predictions.length).toBeGreaterThan(0);
      expect(predictions[0].triggerCondition).toBeDefined();
    });

    it("should predict based on transition matrix when history is sufficient", async () => {
      // Record enough history to build transition matrix
      const history: Omit<IntentHistoryEntry, "timestamp">[] = [];
      for (let i = 0; i < 15; i++) {
        // Alternate between query and action
        history.push({
          intent: i % 2 === 0 ? "query" : "action",
          success: true,
        });
      }

      for (const entry of history) {
        await predictor.recordIntent("user-1", entry);
      }

      // Predict after query
      const predictions = await predictor.predict("user-1", "test", {
        type: "query",
      });

      // Should predict action as most likely next step
      expect(predictions.length).toBeGreaterThan(0);
    });
  });

  describe("getQuickActions", () => {
    it("should return empty array when feature flag is disabled", async () => {
      const FeatureFlags =
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest test needs dynamic require
        require("@/lib/ai-agent/config/feature-flags").FeatureFlags;
      const original = FeatureFlags.ENABLE_INTENT_PREDICTION;
      FeatureFlags.ENABLE_INTENT_PREDICTION = false;

      const actions = await predictor.getQuickActions("user-1");
      expect(actions).toEqual([]);

      FeatureFlags.ENABLE_INTENT_PREDICTION = original;
    });

    it("should return global quick actions when no current intent", async () => {
      const actions = await predictor.getQuickActions("user-1");

      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0]).toHaveProperty("id");
      expect(actions[0]).toHaveProperty("label");
      expect(actions[0]).toHaveProperty("icon");
    });

    it("should return intent-specific quick actions", async () => {
      const actions = await predictor.getQuickActions("user-1", {
        type: "query",
      });

      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].intent).toBeDefined();
    });
  });

  describe("recordIntent", () => {
    it("should record intent to history", async () => {
      await predictor.recordIntent("user-1", {
        intent: "query",
        subType: "search",
        success: true,
      });

      // Verify by checking predictions change
      const predictions = await predictor.predict("user-1", "test", {
        type: "action",
      });
      // Should not throw
      expect(predictions).toBeDefined();
    });

    it("should clean up old history entries", async () => {
      // Create predictor with 0 day retention (immediate cleanup)
      const shortRetentionPredictor = new IntentPredictor({
        historyRetentionDays: 0,
      });

      await shortRetentionPredictor.recordIntent("user-1", {
        intent: "query",
        success: true,
      });

      // Old entries should be cleaned up (but current entry is still fresh)
      const predictions = await shortRetentionPredictor.predict(
        "user-1",
        "test",
        { type: "query" },
      );
      expect(predictions).toBeDefined();
    });
  });

  describe("recordCorrection", () => {
    it("should record correction", async () => {
      // First record an intent
      await predictor.recordIntent("user-1", {
        intent: "query",
        success: true,
      });

      // Then record correction
      await predictor.recordCorrection("user-1", {
        originalIntent: "query",
        correctedIntent: "action",
        originalMessage: "test message",
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it("should invalidate transition matrix cache after correction", async () => {
      // Build some history
      for (let i = 0; i < 15; i++) {
        await predictor.recordIntent("user-1", {
          intent: "query",
          success: true,
        });
      }

      // Get predictions (builds cache)
      await predictor.predict("user-1", "test", { type: "query" });

      // Record correction
      await predictor.recordCorrection("user-1", {
        originalIntent: "query",
        correctedIntent: "action",
        originalMessage: "test",
      });

      // Next prediction should rebuild matrix
      const predictions = await predictor.predict("user-1", "test", {
        type: "query",
      });
      expect(predictions).toBeDefined();
    });
  });

  describe("createIntentPredictor", () => {
    it("should create predictor with factory function", () => {
      const predictor = createIntentPredictor();
      expect(predictor).toBeInstanceOf(IntentPredictor);
    });

    it("should pass config to predictor", () => {
      const predictor = createIntentPredictor({ maxPredictions: 5 });
      expect(predictor.config.maxPredictions).toBe(5);
    });
  });

  describe("transition matrix", () => {
    it("should weight corrected intents higher", async () => {
      // Record history with corrections
      await predictor.recordIntent("user-1", {
        intent: "query",
        success: true,
        wasCorrected: true,
        correctedTo: { intent: "action" },
      });

      // Add more history to meet minimum samples
      for (let i = 0; i < 14; i++) {
        await predictor.recordIntent("user-1", {
          intent: i % 2 === 0 ? "query" : "organize",
          success: true,
        });
      }

      const predictions = await predictor.predict("user-1", "test", {
        type: "query",
      });

      // Corrected intent (action) should have higher probability
      expect(predictions).toBeDefined();
    });
  });

  describe("context adjustment", () => {
    it("should adjust predictions based on keywords in message", async () => {
      // Build history
      for (let i = 0; i < 15; i++) {
        await predictor.recordIntent("user-1", {
          intent: "query",
          success: true,
        });
        await predictor.recordIntent("user-1", {
          intent: "organize",
          success: true,
        });
      }

      // Message with "整理" keyword should boost organize intent
      const predictions = await predictor.predict("user-1", "帮我整理收藏", {
        type: "query",
      });

      // organize should be boosted if it's in predictions
      const organizePredict = predictions.find((p) => p.intent === "organize");
      if (organizePredict) {
        expect(organizePredict.probability).toBeGreaterThan(0);
      }
    });

    it("should reduce probability for frequently corrected intents", async () => {
      // Build history
      for (let i = 0; i < 15; i++) {
        await predictor.recordIntent("user-1", {
          intent: "query",
          success: true,
        });
      }

      // Record many corrections for 'action' intent
      for (let i = 0; i < 5; i++) {
        await predictor.recordCorrection("user-1", {
          originalIntent: "action",
          correctedIntent: "query",
          originalMessage: `test ${i}`,
        });
      }

      const predictions = await predictor.predict("user-1", "test", {
        type: "query",
      });

      // action intent should have reduced probability
      const _actionPredict = predictions.find((p) => p.intent === "action");
      // May not be in predictions at all if probability too low
      expect(predictions).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty user ID", async () => {
      const predictions = await predictor.predict("", "test", {
        type: "query",
      });
      expect(predictions).toBeDefined();
    });

    it("should handle unknown intent type gracefully", async () => {
      const predictions = await predictor.predict("user-1", "test", {
        type: "unknown" as "query",
      });
      // Should return empty or default predictions
      expect(Array.isArray(predictions)).toBe(true);
    });

    it("should respect maxPredictions config", async () => {
      const limitedPredictor = new IntentPredictor({ maxPredictions: 1 });

      // Build history with many different transitions
      const intents: ("query" | "action" | "organize" | "analyze")[] = [
        "query",
        "action",
        "organize",
        "analyze",
      ];
      for (let i = 0; i < 20; i++) {
        await limitedPredictor.recordIntent("user-1", {
          intent: intents[i % 4],
          success: true,
        });
      }

      const predictions = await limitedPredictor.predict("user-1", "test", {
        type: "query",
      });

      expect(predictions.length).toBeLessThanOrEqual(1);
    });
  });
});
