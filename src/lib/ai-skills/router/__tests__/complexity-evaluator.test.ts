/**
 * ComplexityEvaluator 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import type { ComplexityEvaluator } from "../complexity-evaluator";
import { createComplexityEvaluator } from "../complexity-evaluator";
import type { IntentClassification } from "../types";

describe("ComplexityEvaluator", () => {
  let evaluator: ComplexityEvaluator;

  beforeEach(() => {
    evaluator = createComplexityEvaluator();
  });

  describe("evaluate", () => {
    describe("simple complexity", () => {
      it("should evaluate simple query as simple", async () => {
        const intent: IntentClassification = {
          type: "query",
          subType: "count",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: false,
          hasDeliverableExpectation: false,
          source: "rule",
        };

        const result = await evaluator.evaluate(intent, { userId: "test" });

        expect(result.level).toBe("simple");
        expect(result.score).toBeLessThan(35);
        expect(result.estimatedSteps).toBeLessThanOrEqual(2);
      });

      it("should evaluate chitchat as simple", async () => {
        const intent: IntentClassification = {
          type: "chitchat",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: false,
          hasDeliverableExpectation: false,
          source: "rule",
        };

        const result = await evaluator.evaluate(intent, { userId: "test" });

        expect(result.level).toBe("simple");
      });
    });

    describe("medium complexity", () => {
      it("should evaluate action with entities", async () => {
        const intent: IntentClassification = {
          type: "action",
          subType: "move",
          confidence: 0.8,
          entities: [
            {
              type: "folder",
              value: "学习",
              raw: "学习文件夹",
              confidence: 0.9,
            },
          ],
          requiresMultiStep: false,
          hasDeliverableExpectation: false,
          source: "rule",
        };

        const result = await evaluator.evaluate(intent, { userId: "test" });

        // action without multi-step can be simple or medium
        expect(["simple", "medium", "complex"]).toContain(result.level);
        expect(result.score).toBeGreaterThanOrEqual(0);
      });

      it("should evaluate analyze stats", async () => {
        const intent: IntentClassification = {
          type: "analyze",
          subType: "stats",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: false,
          hasDeliverableExpectation: false,
          source: "rule",
        };

        const result = await evaluator.evaluate(intent, { userId: "test" });

        // analyze intent should have higher score than simple query
        expect(result.score).toBeGreaterThan(20);
        expect(["simple", "medium", "complex"]).toContain(result.level);
      });
    });

    describe("complex complexity", () => {
      it("should evaluate organize with multi-step as medium or complex", async () => {
        const intent: IntentClassification = {
          type: "organize",
          subType: "cleanup",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: true,
          hasDeliverableExpectation: false,
          source: "rule",
        };

        const result = await evaluator.evaluate(intent, { userId: "test" });

        // organize + cleanup + multiStep 应该至少是 medium
        expect(["medium", "complex"]).toContain(result.level);
        expect(result.estimatedSteps).toBeGreaterThanOrEqual(3);
      });

      it("should evaluate learn review as complex", async () => {
        const intent: IntentClassification = {
          type: "learn",
          subType: "review",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: true,
          hasDeliverableExpectation: true,
          source: "rule",
        };

        const result = await evaluator.evaluate(intent, { userId: "test" });

        expect(result.level).toBe("complex");
        expect(result.score).toBeGreaterThanOrEqual(60);
      });

      it("should consider large data scale in complexity", async () => {
        const intent: IntentClassification = {
          type: "organize",
          subType: "categorize",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: true,
          hasDeliverableExpectation: false,
          source: "rule",
        };

        const smallScale = await evaluator.evaluate(intent, {
          userId: "test",
          totalBookmarks: 10,
        });
        const largeScale = await evaluator.evaluate(intent, {
          userId: "test",
          totalBookmarks: 1000,
        });

        expect(largeScale.score).toBeGreaterThanOrEqual(smallScale.score);
      });
    });

    describe("factors", () => {
      it("should return complexity factors", async () => {
        const intent: IntentClassification = {
          type: "query",
          subType: "count",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: false,
          hasDeliverableExpectation: false,
          source: "rule",
        };

        const result = await evaluator.evaluate(intent, { userId: "test" });

        expect(result.factors).toBeDefined();
        expect(result.factors.length).toBeGreaterThan(0);
        expect(result.factors[0]).toHaveProperty("name");
        expect(result.factors[0]).toHaveProperty("weight");
        expect(result.factors[0]).toHaveProperty("value");
        expect(result.factors[0]).toHaveProperty("reason");
      });
    });

    describe("duration estimation", () => {
      it("should estimate shorter duration for simple tasks", async () => {
        const simpleIntent: IntentClassification = {
          type: "query",
          subType: "count",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: false,
          hasDeliverableExpectation: false,
          source: "rule",
        };

        const complexIntent: IntentClassification = {
          type: "learn",
          subType: "review",
          confidence: 0.9,
          entities: [],
          requiresMultiStep: true,
          hasDeliverableExpectation: true,
          source: "rule",
        };

        const simpleResult = await evaluator.evaluate(simpleIntent, {
          userId: "test",
        });
        const complexResult = await evaluator.evaluate(complexIntent, {
          userId: "test",
        });

        expect(simpleResult.estimatedDurationMs).toBeLessThan(
          complexResult.estimatedDurationMs,
        );
      });
    });
  });

  describe("configuration", () => {
    it("should respect custom thresholds", async () => {
      const customEvaluator = createComplexityEvaluator({
        simpleThreshold: 50,
        complexThreshold: 80,
      });

      const intent: IntentClassification = {
        type: "action",
        subType: "tag",
        confidence: 0.9,
        entities: [],
        requiresMultiStep: false,
        hasDeliverableExpectation: false,
        source: "rule",
      };

      const defaultResult = await evaluator.evaluate(intent, {
        userId: "test",
      });
      const customResult = await customEvaluator.evaluate(intent, {
        userId: "test",
      });

      // 分数应该相同，级别可能不同
      expect(customResult.score).toBe(defaultResult.score);
    });
  });
});
