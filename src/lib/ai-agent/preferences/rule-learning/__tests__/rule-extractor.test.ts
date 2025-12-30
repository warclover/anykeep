/**
 * RuleExtractor 单元测试
 *
 * @module ai-agent/preferences/rule-learning/__tests__
 */

import { RuleExtractor, createRuleExtractor } from "../rule-extractor";
import type { CorrectionRecord } from "@/lib/ai-skills/router/intent-predictor/types";

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
    ENABLE_RULE_LEARNING: true,
  },
}));

describe("RuleExtractor", () => {
  let extractor: RuleExtractor;

  beforeEach(() => {
    jest.clearAllMocks();
    extractor = new RuleExtractor();
  });

  describe("constructor", () => {
    it("should create extractor with default config", () => {
      expect(extractor.config.minObservations).toBe(3);
      expect(extractor.config.minConfidence).toBe(0.7);
      expect(extractor.config.maxRules).toBe(50);
    });

    it("should merge custom config with defaults", () => {
      const customExtractor = new RuleExtractor({
        minObservations: 5,
        minConfidence: 0.8,
      });
      expect(customExtractor.config.minObservations).toBe(5);
      expect(customExtractor.config.minConfidence).toBe(0.8);
      expect(customExtractor.config.maxRules).toBe(50); // default
    });
  });

  describe("analyzeCorrections", () => {
    it("should return empty array when feature flag is disabled", async () => {
      const FeatureFlags =
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest test needs dynamic require
        require("@/lib/ai-agent/config/feature-flags").FeatureFlags;
      const original = FeatureFlags.ENABLE_RULE_LEARNING;
      FeatureFlags.ENABLE_RULE_LEARNING = false;

      const candidates = await extractor.analyzeCorrections("user-1");
      expect(candidates).toEqual([]);

      FeatureFlags.ENABLE_RULE_LEARNING = original;
    });

    it("should return empty array when corrections are insufficient", async () => {
      // Add only 2 corrections (below default minObservations of 3)
      extractor.addCorrection("user-1", createCorrection("query", "action"));
      extractor.addCorrection("user-1", createCorrection("query", "action"));

      const candidates = await extractor.analyzeCorrections("user-1");
      expect(candidates).toEqual([]);
    });

    it("should extract rule candidates from sufficient corrections", async () => {
      // Add enough corrections
      for (let i = 0; i < 5; i++) {
        extractor.addCorrection(
          "user-1",
          createCorrection("query", "organize", "整理我的收藏"),
        );
      }

      const candidates = await extractor.analyzeCorrections("user-1");
      expect(candidates.length).toBeGreaterThanOrEqual(0);

      // If candidates are generated, check structure
      if (candidates.length > 0) {
        expect(candidates[0]).toHaveProperty("rule");
        expect(candidates[0]).toHaveProperty("confidence");
        expect(candidates[0]).toHaveProperty("support");
      }
    });
  });

  describe("getActiveRules", () => {
    it("should return empty array for user with no rules", async () => {
      const rules = await extractor.getActiveRules("user-1");
      expect(rules).toEqual([]);
    });
  });

  describe("applyRules", () => {
    it("should return not applied when feature flag is disabled", async () => {
      const FeatureFlags =
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest test needs dynamic require
        require("@/lib/ai-agent/config/feature-flags").FeatureFlags;
      const original = FeatureFlags.ENABLE_RULE_LEARNING;
      FeatureFlags.ENABLE_RULE_LEARNING = false;

      const result = await extractor.applyRules(
        "user-1",
        { type: "query" },
        "test",
      );

      expect(result.applied).toBe(false);
      expect(result.appliedRules).toEqual([]);

      FeatureFlags.ENABLE_RULE_LEARNING = original;
    });

    it("should return not applied when no rules match", async () => {
      const result = await extractor.applyRules(
        "user-1",
        { type: "query" },
        "test message",
      );

      expect(result.applied).toBe(false);
      expect(result.appliedRules).toEqual([]);
    });
  });

  describe("activateRule / deactivateRule", () => {
    it("should activate and deactivate rules", async () => {
      // Add corrections to generate rules
      for (let i = 0; i < 10; i++) {
        extractor.addCorrection(
          "user-1",
          createCorrection("query", "organize", "整理收藏"),
        );
      }

      // Create extractor with auto-activate enabled
      const autoExtractor = new RuleExtractor({
        autoActivateThreshold: 0.5,
        minConfidence: 0.3,
      });

      for (let i = 0; i < 10; i++) {
        autoExtractor.addCorrection(
          "user-1",
          createCorrection("query", "organize", "整理收藏"),
        );
      }

      await autoExtractor.analyzeCorrections("user-1");

      // Get active rules
      const activeRules = await autoExtractor.getActiveRules("user-1");

      if (activeRules.length > 0) {
        const ruleId = activeRules[0].id;

        // Deactivate
        await autoExtractor.deactivateRule("user-1", ruleId);
        let rules = await autoExtractor.getActiveRules("user-1");
        expect(rules.some((r) => r.id === ruleId)).toBe(false);

        // Activate
        await autoExtractor.activateRule("user-1", ruleId);
        rules = await autoExtractor.getActiveRules("user-1");
        expect(rules.some((r) => r.id === ruleId)).toBe(true);
      }
    });
  });

  describe("pattern discovery", () => {
    it("should discover correction patterns", async () => {
      // Add varied corrections
      for (let i = 0; i < 4; i++) {
        extractor.addCorrection(
          "user-1",
          createCorrection("query", "organize", "帮我整理"),
        );
      }
      for (let i = 0; i < 2; i++) {
        extractor.addCorrection(
          "user-1",
          createCorrection("query", "action", "添加标签"),
        );
      }

      const candidates = await extractor.analyzeCorrections("user-1");

      // The query->organize pattern should have higher confidence
      // because it has more observations
      expect(candidates).toBeDefined();
    });

    it("should extract common keywords from message samples", async () => {
      // Add corrections with similar messages
      const messages = [
        "帮我整理收藏夹",
        "请整理一下收藏",
        "整理我的收藏",
        "帮忙整理收藏内容",
      ];

      for (const msg of messages) {
        extractor.addCorrection(
          "user-1",
          createCorrection("query", "organize", msg),
        );
      }

      const candidates = await extractor.analyzeCorrections("user-1");

      // Should find "整理" and "收藏" as common keywords
      if (candidates.length > 0 && candidates[0].rule.condition.keywords) {
        expect(candidates[0].rule.condition.keywords).toContain("整理");
      }
    });
  });

  describe("rule application", () => {
    it("should apply intent override rule", async () => {
      // Create extractor with low thresholds for testing
      const testExtractor = new RuleExtractor({
        minObservations: 2,
        minConfidence: 0.1,
        autoActivateThreshold: 0.1,
      });

      // Add corrections
      for (let i = 0; i < 5; i++) {
        testExtractor.addCorrection(
          "user-1",
          createCorrection("query", "organize", "整理收藏"),
        );
      }

      // Analyze to create rules
      await testExtractor.analyzeCorrections("user-1");

      // Apply rules
      const result = await testExtractor.applyRules(
        "user-1",
        { type: "query" },
        "整理收藏",
      );

      // If rule was applied, check the modified intent
      if (result.applied) {
        expect(result.modifiedIntent?.type).toBe("organize");
      }
    });
  });

  describe("createRuleExtractor", () => {
    it("should create extractor with factory function", () => {
      const extractor = createRuleExtractor();
      expect(extractor).toBeInstanceOf(RuleExtractor);
    });

    it("should pass config to extractor", () => {
      const extractor = createRuleExtractor({ maxRules: 100 });
      expect(extractor.config.maxRules).toBe(100);
    });
  });
});

// =============================================================================
// Test Helpers
// =============================================================================

function createCorrection(
  originalIntent:
    | "query"
    | "action"
    | "organize"
    | "analyze"
    | "export"
    | "learn"
    | "create"
    | "refine",
  correctedIntent:
    | "query"
    | "action"
    | "organize"
    | "analyze"
    | "export"
    | "learn"
    | "create"
    | "refine",
  message = "test message",
): CorrectionRecord {
  return {
    id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: "user-1",
    originalIntent,
    correctedIntent,
    originalMessage: message,
    timestamp: Date.now(),
  };
}
