/**
 * AI 能力端到端验收测试 - 置信度分层
 *
 * 验证置信度分层执行策略的完整链路
 *
 * @module @/__tests__/e2e/ai-capabilities/confidence-tiering
 */

import {
  CONFIDENCE_THRESHOLDS,
  getConfidenceLevel,
  getSuggestedStrategy,
  requiresConfirmation,
  getOperationRiskLevel,
} from "@/lib/shared/types/confidence";
import {
  calculateEnhancedConfidence,
  type EnhancedConfidenceInput,
} from "@/lib/ai-agent/context/enhanced-confidence";

describe("E2E: 置信度分层执行", () => {
  describe("置信度阈值常量", () => {
    it("应该定义正确的阈值", () => {
      expect(CONFIDENCE_THRESHOLDS.HIGH).toBe(0.8);
      expect(CONFIDENCE_THRESHOLDS.MEDIUM).toBe(0.6);
      expect(CONFIDENCE_THRESHOLDS.LOW).toBe(0.6);
    });

    it("HIGH >= MEDIUM >= LOW", () => {
      expect(CONFIDENCE_THRESHOLDS.HIGH).toBeGreaterThanOrEqual(
        CONFIDENCE_THRESHOLDS.MEDIUM,
      );
      expect(CONFIDENCE_THRESHOLDS.MEDIUM).toBeGreaterThanOrEqual(
        CONFIDENCE_THRESHOLDS.LOW,
      );
    });
  });

  describe("getConfidenceLevel", () => {
    const testCases = [
      { confidence: 0.95, expected: "high" },
      { confidence: 0.85, expected: "high" },
      { confidence: 0.8, expected: "high" },
      { confidence: 0.79, expected: "medium" },
      { confidence: 0.7, expected: "medium" },
      { confidence: 0.6, expected: "medium" },
      { confidence: 0.59, expected: "low" },
      { confidence: 0.4, expected: "low" },
      { confidence: 0.1, expected: "low" },
    ];

    it.each(testCases)(
      "置信度 $confidence 应该返回 $expected 级别",
      ({ confidence, expected }) => {
        const level = getConfidenceLevel(confidence);
        expect(level).toBe(expected);
      },
    );
  });

  describe("getSuggestedStrategy", () => {
    it("高置信度应该返回 silent_execute 策略", () => {
      const strategy = getSuggestedStrategy(0.85);
      expect(strategy).toBe("silent_execute");
    });

    it("中置信度应该返回 execute_with_explanation 策略", () => {
      const strategy = getSuggestedStrategy(0.7);
      expect(strategy).toBe("execute_with_explanation");
    });

    it("低置信度应该返回 ask_clarification 策略", () => {
      const strategy = getSuggestedStrategy(0.5);
      expect(strategy).toBe("ask_clarification");
    });

    it("边界值测试", () => {
      expect(getSuggestedStrategy(0.8)).toBe("silent_execute");
      expect(getSuggestedStrategy(0.799)).toBe("execute_with_explanation");
      expect(getSuggestedStrategy(0.6)).toBe("execute_with_explanation");
      expect(getSuggestedStrategy(0.599)).toBe("ask_clarification");
    });
  });

  describe("getOperationRiskLevel", () => {
    it("搜索操作应该是低风险", () => {
      expect(getOperationRiskLevel("search")).toBe("low");
      expect(getOperationRiskLevel("list")).toBe("low");
      expect(getOperationRiskLevel("count")).toBe("low");
      expect(getOperationRiskLevel("get")).toBe("low");
    });

    it("修改操作应该是中风险", () => {
      expect(getOperationRiskLevel("add_tag")).toBe("medium");
      expect(getOperationRiskLevel("move")).toBe("medium");
      expect(getOperationRiskLevel("classify")).toBe("medium");
      expect(getOperationRiskLevel("export")).toBe("medium");
    });

    it("删除操作应该是高风险", () => {
      expect(getOperationRiskLevel("delete")).toBe("high");
      expect(getOperationRiskLevel("batch_delete")).toBe("high");
      expect(getOperationRiskLevel("remove")).toBe("high");
    });

    it("未知操作应该是中风险", () => {
      expect(getOperationRiskLevel("unknown_operation")).toBe("medium");
    });
  });

  describe("requiresConfirmation", () => {
    describe("低风险操作", () => {
      it("高置信度不需要确认", () => {
        expect(requiresConfirmation("search", 0.85)).toBe(false);
      });

      it("中置信度不需要确认", () => {
        expect(requiresConfirmation("search", 0.7)).toBe(false);
      });

      it("低置信度不需要确认", () => {
        expect(requiresConfirmation("search", 0.5)).toBe(false);
      });
    });

    describe("中风险操作", () => {
      it("高置信度不需要确认", () => {
        expect(requiresConfirmation("add_tag", 0.85)).toBe(false);
      });

      it("中置信度不需要确认", () => {
        expect(requiresConfirmation("add_tag", 0.7)).toBe(false);
      });

      it("低置信度需要确认", () => {
        expect(requiresConfirmation("add_tag", 0.5)).toBe(true);
      });
    });

    describe("高风险操作", () => {
      it("高置信度需要确认", () => {
        expect(requiresConfirmation("delete", 0.85)).toBe(true);
      });

      it("中置信度需要确认", () => {
        expect(requiresConfirmation("delete", 0.7)).toBe(true);
      });

      it("低置信度需要确认", () => {
        expect(requiresConfirmation("delete", 0.5)).toBe(true);
      });
    });
  });

  describe("增强置信度计算", () => {
    it("应该正确计算增强置信度", () => {
      const input: EnhancedConfidenceInput = {
        ruleConfidence: 0.75,
        contextRelevance: 0.9,
        entityCompleteness: 0.8,
        messageClarity: 0.85,
        historyMatch: 0.7,
      };

      const result = calculateEnhancedConfidence(input);

      expect(result.enhancedConfidence).toBeDefined();
      expect(result.enhancedConfidence).toBeGreaterThan(0);
      expect(result.enhancedConfidence).toBeLessThanOrEqual(1);
      expect(result.factors).toBeDefined();
      expect(result.level).toBeDefined();
      expect(result.strategy).toBeDefined();
    });

    it("高置信度输入应该产生 silent_execute 策略", () => {
      const input: EnhancedConfidenceInput = {
        ruleConfidence: 0.9,
        contextRelevance: 0.95,
        entityCompleteness: 1.0,
        messageClarity: 0.95,
        historyMatch: 0.9,
      };

      const result = calculateEnhancedConfidence(input);

      expect(result.level).toBe("high");
      expect(result.strategy).toBe("silent_execute");
    });

    it("低置信度输入应该产生 ask_clarification 策略", () => {
      const input: EnhancedConfidenceInput = {
        ruleConfidence: 0.3,
        contextRelevance: 0.4,
        entityCompleteness: 0.5,
        messageClarity: 0.3,
        historyMatch: 0.2,
      };

      const result = calculateEnhancedConfidence(input);

      expect(result.level).toBe("low");
      expect(result.strategy).toBe("ask_clarification");
    });

    it("因素权重应该正确应用", () => {
      const input: EnhancedConfidenceInput = {
        ruleConfidence: 1.0, // 40%
        contextRelevance: 0.0, // 20%
        entityCompleteness: 0.0, // 15%
        messageClarity: 0.0, // 15%
        historyMatch: 0.0, // 10%
      };

      const result = calculateEnhancedConfidence(input);

      // 只有 ruleConfidence 为 1.0，权重 40%
      expect(result.enhancedConfidence).toBeCloseTo(0.4, 1);
    });
  });

  describe("端到端场景", () => {
    it("场景1: 简单查询 → 高置信度 → 静默执行", () => {
      const input: EnhancedConfidenceInput = {
        ruleConfidence: 0.95,
        contextRelevance: 0.9,
        entityCompleteness: 1.0,
        messageClarity: 0.95,
        historyMatch: 0.8,
      };

      const result = calculateEnhancedConfidence(input);

      expect(result.level).toBe("high");
      expect(result.strategy).toBe("silent_execute");
      expect(requiresConfirmation("search", result.enhancedConfidence)).toBe(
        false,
      );
    });

    it("场景2: 模糊请求 → 中置信度 → 执行并解释", () => {
      const input: EnhancedConfidenceInput = {
        ruleConfidence: 0.7,
        contextRelevance: 0.6,
        entityCompleteness: 0.8,
        messageClarity: 0.7,
        historyMatch: 0.5,
      };

      const result = calculateEnhancedConfidence(input);

      expect(result.level).toBe("medium");
      expect(result.strategy).toBe("execute_with_explanation");
    });

    it("场景3: 含糊请求 → 低置信度 → 请求澄清", () => {
      const input: EnhancedConfidenceInput = {
        ruleConfidence: 0.4,
        contextRelevance: 0.5,
        entityCompleteness: 0.3,
        messageClarity: 0.4,
        historyMatch: 0.3,
      };

      const result = calculateEnhancedConfidence(input);

      expect(result.level).toBe("low");
      expect(result.strategy).toBe("ask_clarification");
    });

    it("场景4: 高风险操作即使高置信度也需要确认", () => {
      const input: EnhancedConfidenceInput = {
        ruleConfidence: 0.95,
        contextRelevance: 0.95,
        entityCompleteness: 1.0,
        messageClarity: 0.95,
        historyMatch: 0.9,
      };

      const result = calculateEnhancedConfidence(input);

      expect(result.level).toBe("high");
      // 删除操作始终需要确认
      expect(requiresConfirmation("delete", result.enhancedConfidence)).toBe(
        true,
      );
    });
  });
});
