/**
 * ComplexityEvaluator 单元测试
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

// Jest 测试
import {
  ComplexityEvaluator,
  createComplexityEvaluator,
  COMPLEXITY_THRESHOLDS,
  DATA_SCALE_THRESHOLDS,
} from "../routing/complexity-evaluator";
import type { IntentClassification, RequestContext } from "../types";

// ============================================
// 辅助函数
// ============================================

function createIntent(
  overrides: Partial<IntentClassification> = {},
): IntentClassification {
  return {
    type: "query",
    confidence: 0.8,
    entities: [],
    requiresMultiStep: false,
    hasDeliverableExpectation: false,
    source: "rule",
    ...overrides,
  };
}

// ============================================
// 测试用例
// ============================================

describe("ComplexityEvaluator", () => {
  let evaluator: ComplexityEvaluator;

  beforeEach(() => {
    evaluator = new ComplexityEvaluator();
  });

  describe("evaluate", () => {
    describe("意图类型影响", () => {
      it("chitchat 应该评估为 simple", () => {
        const intent = createIntent({ type: "chitchat" });
        const result = evaluator.evaluate(intent);

        expect(result.level).toBe("simple");
        expect(result.score).toBeLessThanOrEqual(COMPLEXITY_THRESHOLDS.SIMPLE);
      });

      it("query 应该评估为 simple", () => {
        const intent = createIntent({ type: "query" });
        const result = evaluator.evaluate(intent);

        expect(result.level).toBe("simple");
      });

      it("organize 应该评估为 medium 或 complex", () => {
        const intent = createIntent({
          type: "organize",
          requiresMultiStep: true,
        });
        const result = evaluator.evaluate(intent);

        expect(["medium", "complex"]).toContain(result.level);
      });

      it("learn 应该评估为较高复杂度", () => {
        const intent = createIntent({
          type: "learn",
          requiresMultiStep: true,
          hasDeliverableExpectation: true,
        });
        const result = evaluator.evaluate(intent);

        expect(result.score).toBeGreaterThanOrEqual(
          COMPLEXITY_THRESHOLDS.SIMPLE,
        );
      });
    });

    describe("子类型调整", () => {
      it("dedupe 子类型应该增加复杂度", () => {
        const baseIntent = createIntent({ type: "organize" });
        const dedupeIntent = createIntent({
          type: "organize",
          subType: "dedupe",
        });

        const baseResult = evaluator.evaluate(baseIntent);
        const dedupeResult = evaluator.evaluate(dedupeIntent);

        expect(dedupeResult.score).toBeGreaterThan(baseResult.score);
      });

      it("count 子类型应该降低复杂度", () => {
        const baseIntent = createIntent({ type: "query" });
        const countIntent = createIntent({
          type: "query",
          subType: "count",
        });

        const baseResult = evaluator.evaluate(baseIntent);
        const countResult = evaluator.evaluate(countIntent);

        expect(countResult.score).toBeLessThanOrEqual(baseResult.score);
      });
    });

    describe("多步骤需求影响", () => {
      it("requiresMultiStep=true 应该增加复杂度", () => {
        const singleStep = createIntent({ requiresMultiStep: false });
        const multiStep = createIntent({ requiresMultiStep: true });

        const singleResult = evaluator.evaluate(singleStep);
        const multiResult = evaluator.evaluate(multiStep);

        expect(multiResult.score).toBeGreaterThan(singleResult.score);
      });
    });

    describe("交付物期望影响", () => {
      it("hasDeliverableExpectation=true 应该增加复杂度", () => {
        const noDeliverable = createIntent({
          hasDeliverableExpectation: false,
        });
        const withDeliverable = createIntent({
          hasDeliverableExpectation: true,
        });

        const noResult = evaluator.evaluate(noDeliverable);
        const withResult = evaluator.evaluate(withDeliverable);

        expect(withResult.score).toBeGreaterThan(noResult.score);
      });
    });

    describe("数据规模影响", () => {
      it("大量书签应该增加复杂度", () => {
        const intent = createIntent({ type: "organize" });
        const smallContext: Partial<RequestContext> = {
          selectedBookmarks: Array(10).fill(1),
        };
        const largeContext: Partial<RequestContext> = {
          selectedBookmarks: Array(150).fill(1),
        };

        const smallResult = evaluator.evaluate(intent, smallContext);
        const largeResult = evaluator.evaluate(intent, largeContext);

        expect(largeResult.score).toBeGreaterThan(smallResult.score);
      });

      it("bookmarkIds 应该被正确识别", () => {
        const intent = createIntent({ type: "action" });
        const context: Partial<RequestContext> = {
          bookmarkIds: [1, 2, 3, 4, 5],
        };

        const result = evaluator.evaluate(intent, context);

        const dataFactor = result.factors.find((f) => f.name === "data_scale");
        expect(dataFactor?.reason).toContain("5");
      });
    });

    describe("确认需求影响", () => {
      it("delete 操作应该需要确认", () => {
        const deleteIntent = createIntent({
          type: "action",
          subType: "delete",
        });

        const result = evaluator.evaluate(deleteIntent);
        const confirmFactor = result.factors.find(
          (f) => f.name === "confirmation",
        );

        expect(confirmFactor?.reason).toBe("需确认");
      });

      it("search 操作不需要确认", () => {
        const searchIntent = createIntent({
          type: "query",
          subType: "search",
        });

        const result = evaluator.evaluate(searchIntent);
        const confirmFactor = result.factors.find(
          (f) => f.name === "confirmation",
        );

        expect(confirmFactor?.reason).toBe("自动完成");
      });
    });

    describe("估算值", () => {
      it("应该返回预计步骤数", () => {
        const simpleIntent = createIntent({ type: "chitchat" });
        const complexIntent = createIntent({
          type: "learn",
          requiresMultiStep: true,
          hasDeliverableExpectation: true,
        });

        const simpleResult = evaluator.evaluate(simpleIntent);
        const complexResult = evaluator.evaluate(complexIntent);

        expect(simpleResult.estimatedSteps).toBeDefined();
        expect(complexResult.estimatedSteps).toBeGreaterThan(
          simpleResult.estimatedSteps!,
        );
      });

      it("应该返回预计执行时间", () => {
        const intent = createIntent({ type: "analyze" });
        const result = evaluator.evaluate(intent);

        expect(result.estimatedDurationMs).toBeDefined();
        expect(result.estimatedDurationMs).toBeGreaterThan(0);
      });
    });

    describe("因素完整性", () => {
      it("应该返回所有 5 个因素", () => {
        const intent = createIntent();
        const result = evaluator.evaluate(intent);

        expect(result.factors).toHaveLength(5);

        const factorNames = result.factors.map((f) => f.name);
        expect(factorNames).toContain("intent_complexity");
        expect(factorNames).toContain("multi_step");
        expect(factorNames).toContain("deliverable");
        expect(factorNames).toContain("data_scale");
        expect(factorNames).toContain("confirmation");
      });

      it("每个因素应��有完整的属性", () => {
        const intent = createIntent();
        const result = evaluator.evaluate(intent);

        result.factors.forEach((factor) => {
          expect(factor.name).toBeDefined();
          expect(factor.weight).toBeGreaterThan(0);
          expect(factor.weight).toBeLessThanOrEqual(1);
          expect(factor.value).toBeGreaterThanOrEqual(0);
          expect(factor.value).toBeLessThanOrEqual(100);
          expect(factor.reason).toBeDefined();
        });
      });
    });
  });

  describe("自定义阈值", () => {
    it("应该使用自定义简单阈值", () => {
      const customEvaluator = new ComplexityEvaluator({
        simpleThreshold: 50,
      });

      const intent = createIntent({ type: "action" });
      const result = customEvaluator.evaluate(intent);

      // 默认 action 分数约 30-40，使用自定义阈值应该是 simple
      expect(result.level).toBe("simple");
    });

    it("应该使用自定义复杂阈值", () => {
      const customEvaluator = new ComplexityEvaluator({
        complexThreshold: 40,
      });

      const intent = createIntent({
        type: "organize",
        requiresMultiStep: true,
      });
      const result = customEvaluator.evaluate(intent);

      expect(result.level).toBe("complex");
    });
  });
});

describe("createComplexityEvaluator", () => {
  it("应该创建默认配置的评估器", () => {
    const evaluator = createComplexityEvaluator();
    expect(evaluator).toBeInstanceOf(ComplexityEvaluator);
  });

  it("应该创建带配置的评估器", () => {
    const evaluator = createComplexityEvaluator({
      simpleThreshold: 30,
      complexThreshold: 70,
      debug: true,
    });
    expect(evaluator).toBeInstanceOf(ComplexityEvaluator);
  });
});

describe("常量导出", () => {
  it("COMPLEXITY_THRESHOLDS 应该正确导出", () => {
    expect(COMPLEXITY_THRESHOLDS.SIMPLE).toBe(35);
    expect(COMPLEXITY_THRESHOLDS.COMPLEX).toBe(60);
  });

  it("DATA_SCALE_THRESHOLDS 应该正确导出", () => {
    expect(DATA_SCALE_THRESHOLDS.LARGE).toBe(100);
    expect(DATA_SCALE_THRESHOLDS.MEDIUM).toBe(50);
    expect(DATA_SCALE_THRESHOLDS.SMALL).toBe(20);
  });
});
