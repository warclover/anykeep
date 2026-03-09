/**
 * ModeSelector 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import type { ModeSelector } from "../mode-selector";
import { createModeSelector } from "../mode-selector";
import type { IntentClassification, ComplexityEvaluation } from "../types";

describe("ModeSelector", () => {
  let selector: ModeSelector;

  beforeEach(() => {
    selector = createModeSelector();
  });

  describe("select", () => {
    describe("atomic mode selection", () => {
      it("should select atomic for simple queries", () => {
        const intent: IntentClassification = {
          type: "query",
          subType: "count",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: false,
          hasDeliverableExpectation: false,
          source: "rule",
        };

        const complexity: ComplexityEvaluation = {
          level: "simple",
          score: 20,
          factors: [],
          estimatedSteps: 1,
          estimatedDurationMs: 1000,
        };

        const result = selector.select(intent, complexity);

        expect(result.mode).toBe("atomic");
      });

      it("should select atomic for chitchat", () => {
        const intent: IntentClassification = {
          type: "chitchat",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: false,
          hasDeliverableExpectation: false,
          source: "rule",
        };

        const complexity: ComplexityEvaluation = {
          level: "simple",
          score: 10,
          factors: [],
          estimatedSteps: 1,
          estimatedDurationMs: 500,
        };

        const result = selector.select(intent, complexity);

        expect(result.mode).toBe("atomic");
      });

      it("should select atomic for simple actions", () => {
        const intent: IntentClassification = {
          type: "action",
          subType: "tag",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: false,
          hasDeliverableExpectation: false,
          source: "rule",
        };

        const complexity: ComplexityEvaluation = {
          level: "simple",
          score: 25,
          factors: [],
          estimatedSteps: 1,
          estimatedDurationMs: 2000,
        };

        const result = selector.select(intent, complexity);

        expect(result.mode).toBe("atomic");
      });
    });

    describe("orchestration mode selection", () => {
      it("should select orchestration for organize:dedupe with medium complexity", () => {
        const intent: IntentClassification = {
          type: "organize",
          subType: "dedupe",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: true,
          hasDeliverableExpectation: false,
          source: "rule",
        };

        const complexity: ComplexityEvaluation = {
          level: "medium",
          score: 50,
          factors: [],
          estimatedSteps: 3,
          estimatedDurationMs: 15000,
        };

        const result = selector.select(intent, complexity);
        const suggestedSkill = selector.getSuggestedSkill(intent, complexity);

        expect(result.mode).toBe("orchestration");
        expect(suggestedSkill).toBe("duplicate_cleanup");
      });

      it("should select orchestration for create:digest with medium complexity", () => {
        const intent: IntentClassification = {
          type: "create",
          subType: "digest",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: true,
          hasDeliverableExpectation: true,
          source: "rule",
        };

        const complexity: ComplexityEvaluation = {
          level: "medium",
          score: 45,
          factors: [],
          estimatedSteps: 3,
          estimatedDurationMs: 10000,
        };

        const result = selector.select(intent, complexity);
        const suggestedSkill = selector.getSuggestedSkill(intent, complexity);

        expect(result.mode).toBe("orchestration");
        expect(suggestedSkill).toBe("quick_digest");
      });
    });

    describe("disabled skill handling", () => {
      it("should fall back to atomic when skill is explicitly disabled", () => {
        // 禁用 batch_organize skill
        selector.setSkillEnabled("batch_organize", false);

        const intent: IntentClassification = {
          type: "organize",
          subType: "cleanup",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: true,
          hasDeliverableExpectation: false,
          source: "rule",
        };

        const complexity: ComplexityEvaluation = {
          level: "complex",
          score: 70,
          factors: [],
          estimatedSteps: 4,
          estimatedDurationMs: 20000,
        };

        const result = selector.select(intent, complexity);

        // 禁用后，复杂任务应回退到 atomic 模式
        expect(result.mode).toBe("atomic");

        // 恢复启用状态，避免影响其他测试
        selector.setSkillEnabled("batch_organize", true);
      });

      it("should fall back to atomic for disabled skill in default mappings", () => {
        // learn:interview 在默认配置中是禁用的
        const intent: IntentClassification = {
          type: "learn",
          subType: "interview",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: true,
          hasDeliverableExpectation: false,
          source: "rule",
        };

        const complexity: ComplexityEvaluation = {
          level: "complex",
          score: 75,
          factors: [],
          estimatedSteps: 5,
          estimatedDurationMs: 30000,
        };

        const result = selector.select(intent, complexity);

        // learn:interview 禁用 + 复杂任务 → atomic
        expect(result.mode).toBe("atomic");
      });

      it("should use partial mapping when deliverable expected and partial exists", () => {
        // 禁用 learn:interview，但其他 learn 映射仍启用
        const intent: IntentClassification = {
          type: "learn",
          subType: "interview",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: true,
          hasDeliverableExpectation: true, // 期望交付物
          source: "rule",
        };

        const complexity: ComplexityEvaluation = {
          level: "medium",
          score: 50,
          factors: [],
          estimatedSteps: 3,
          estimatedDurationMs: 15000,
        };

        const result = selector.select(intent, complexity);

        // 中等复杂度 + 期望交付物 + 有 partial mapping → orchestration
        expect(result.mode).toBe("orchestration");
      });
    });

    describe("fallback mode", () => {
      it("should provide fallback mode when orchestration selected", () => {
        const intent: IntentClassification = {
          type: "organize",
          subType: "dedupe",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: true,
          hasDeliverableExpectation: true,
          source: "rule",
        };

        const complexity: ComplexityEvaluation = {
          level: "medium",
          score: 55,
          factors: [],
          estimatedSteps: 4,
          estimatedDurationMs: 20000,
        };

        const result = selector.select(intent, complexity);

        expect(result.fallbackMode).toBe("atomic");
      });
    });

    describe("reason", () => {
      it("should provide reason for selection", () => {
        const intent: IntentClassification = {
          type: "query",
          subType: "count",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: false,
          hasDeliverableExpectation: false,
          source: "rule",
        };

        const complexity: ComplexityEvaluation = {
          level: "simple",
          score: 20,
          factors: [],
          estimatedSteps: 1,
          estimatedDurationMs: 1000,
        };

        const result = selector.select(intent, complexity);

        expect(result.reason).toBeDefined();
        expect(result.reason.length).toBeGreaterThan(0);
      });
    });
  });

  describe("getSuggestedSkill", () => {
    it("should return null for atomic mode", () => {
      const intent: IntentClassification = {
        type: "query",
        subType: "count",
        confidence: 0.9,
        entities: [],
        requiresMultiStep: false,
        hasDeliverableExpectation: false,
        source: "rule",
      };

      const complexity: ComplexityEvaluation = {
        level: "simple",
        score: 20,
        factors: [],
        estimatedSteps: 1,
        estimatedDurationMs: 1000,
      };

      const suggestedSkill = selector.getSuggestedSkill(intent, complexity);

      expect(suggestedSkill).toBeNull();
    });

    it("should return skill ID for orchestration mode", () => {
      const intent: IntentClassification = {
        type: "organize",
        subType: "dedupe",
        confidence: 0.9,
        entities: [],
        requiresMultiStep: true,
        hasDeliverableExpectation: true,
        source: "rule",
      };

      const complexity: ComplexityEvaluation = {
        level: "medium",
        score: 55,
        factors: [],
        estimatedSteps: 4,
        estimatedDurationMs: 20000,
      };

      const suggestedSkill = selector.getSuggestedSkill(intent, complexity);

      expect(suggestedSkill).toBe("duplicate_cleanup");
    });
  });

  describe("skill management", () => {
    it("should get enabled skills", () => {
      const enabledSkills = selector.getEnabledSkills();

      expect(enabledSkills.length).toBeGreaterThan(0);
      expect(enabledSkills.every((s) => s.skillId && s.name)).toBe(true);
    });

    it("should be able to enable/disable skills", () => {
      selector.setSkillEnabled("duplicate_cleanup", false);

      const enabledSkills = selector.getEnabledSkills();
      const hasDuplicateCleanup = enabledSkills.some(
        (s) => s.skillId === "duplicate_cleanup",
      );

      expect(hasDuplicateCleanup).toBe(false);

      // Re-enable for other tests
      selector.setSkillEnabled("duplicate_cleanup", true);
    });

    it("should be able to register new skills", () => {
      selector.registerSkill("test:custom", {
        skillId: "custom_skill",
        name: "自定义 Skill",
        minComplexity: "medium",
      });

      const mappings = selector.getAllMappings();

      expect(mappings["test:custom"]).toBeDefined();
      expect(mappings["test:custom"].skillId).toBe("custom_skill");
    });
  });

  describe("edge cases", () => {
    it("should fallback to atomic for unknown intent+subType combinations", () => {
      const intent: IntentClassification = {
        type: "query",
        subType: "unknown_subtype",
        confidence: 0.9,
        entities: [],
        requiresMultiStep: false,
        hasDeliverableExpectation: false,
        source: "rule",
      };

      const complexity: ComplexityEvaluation = {
        level: "medium",
        score: 45,
        factors: [],
        estimatedSteps: 2,
        estimatedDurationMs: 5000,
      };

      const result = selector.select(intent, complexity);

      expect(result.mode).toBe("atomic");
    });
  });
});
