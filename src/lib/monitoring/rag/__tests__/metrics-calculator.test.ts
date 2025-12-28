/**
 * RAG 评估指标计算器测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import {
  RAGMetricsCalculator,
  calculateStatistics,
  calculatePercentile,
} from "../metrics-calculator";
import type { EvaluationTestCase, RAGResponse } from "../types";

// ============================================================================
// 测试数据
// ============================================================================

const mockTestCase: EvaluationTestCase = {
  id: "test-001",
  query: "React Hooks 最佳实践",
  expectedKeywords: ["useState", "useEffect", "依赖数组"],
  category: "technical",
  difficulty: "medium",
};

const mockResponse: RAGResponse = {
  answer:
    "React Hooks 的最佳实践包括：1. 使用 useState 管理组件状态；2. useEffect 需要正确设置依赖数组；3. 遵循 Hooks 规则。",
  contexts: [
    "useState 是 React 中最常用的 Hook，用于在函数组件中添加状态。",
    "useEffect 用于处理副作用，依赖数组决定了何时重新执行。",
    "自定义 Hook 可以复用状态逻辑。",
  ],
  latencyMs: 150,
};

const emptyResponse: RAGResponse = {
  answer: "",
  contexts: [],
  latencyMs: 50,
};

const noContextResponse: RAGResponse = {
  answer: "React Hooks 是现代 React 开发的核心特性。",
  contexts: [],
  latencyMs: 100,
};

// ============================================================================
// 测试套件
// ============================================================================

describe("RAGMetricsCalculator", () => {
  let calculator: RAGMetricsCalculator;

  beforeEach(() => {
    calculator = new RAGMetricsCalculator();
  });

  describe("evaluate", () => {
    it("应该返回完整的评估结果", () => {
      const result = calculator.evaluate(mockTestCase, mockResponse);

      expect(result.testCaseId).toBe("test-001");
      expect(result.query).toBe("React Hooks 最佳实践");
      expect(result.scores).toBeDefined();
      expect(result.scores.faithfulness).toBeGreaterThanOrEqual(0);
      expect(result.scores.faithfulness).toBeLessThanOrEqual(1);
      expect(result.scores.answerRelevancy).toBeGreaterThanOrEqual(0);
      expect(result.scores.answerRelevancy).toBeLessThanOrEqual(1);
      expect(result.scores.contextPrecision).toBeGreaterThanOrEqual(0);
      expect(result.scores.contextPrecision).toBeLessThanOrEqual(1);
      expect(result.scores.contextRecall).toBeGreaterThanOrEqual(0);
      expect(result.scores.contextRecall).toBeLessThanOrEqual(1);
      expect(result.evaluatedAt).toBeDefined();
    });

    it("空回答应该返回低分", () => {
      const result = calculator.evaluate(mockTestCase, emptyResponse);

      expect(result.scores.faithfulness).toBe(0);
      expect(result.scores.answerRelevancy).toBe(0);
    });

    it("没有上下文但有回答应该返回较低的忠实度", () => {
      const result = calculator.evaluate(mockTestCase, noContextResponse);

      expect(result.scores.faithfulness).toBeLessThan(0.5);
    });
  });

  describe("Faithfulness 计算", () => {
    it("回答内容在上下文中出现时应该得高分", () => {
      const testCase: EvaluationTestCase = {
        id: "faith-001",
        query: "什么是 useState",
        expectedKeywords: ["useState"],
      };

      const response: RAGResponse = {
        answer: "useState 是 React 中的状态 Hook。",
        contexts: ["useState 是 React 中用于管理状态的 Hook。"],
        latencyMs: 100,
      };

      const result = calculator.evaluate(testCase, response);
      expect(result.scores.faithfulness).toBeGreaterThan(0.5);
    });
  });

  describe("Answer Relevancy 计算", () => {
    it("包含所有期望关键词时应该得高分", () => {
      const testCase: EvaluationTestCase = {
        id: "rel-001",
        query: "React 性能优化",
        expectedKeywords: ["memo", "useMemo", "useCallback"],
      };

      const response: RAGResponse = {
        answer:
          "React 性能优化可以使用 memo、useMemo 和 useCallback 来避免不必要的渲染。",
        contexts: [],
        latencyMs: 100,
      };

      const result = calculator.evaluate(testCase, response);
      expect(result.scores.answerRelevancy).toBeGreaterThan(0.5);
    });

    it("没有期望关键词时应该给中性分数", () => {
      const testCase: EvaluationTestCase = {
        id: "rel-002",
        query: "随便问问",
        expectedKeywords: [],
      };

      const response: RAGResponse = {
        answer: "这是一个回答。",
        contexts: [],
        latencyMs: 100,
      };

      const result = calculator.evaluate(testCase, response);
      // 没有关键词时，关键词部分应该得到 0.5 分
      expect(result.scores.answerRelevancy).toBeGreaterThan(0);
    });
  });

  describe("Context Precision 计算", () => {
    it("相关上下文排在前面时应该得高分", () => {
      const testCase: EvaluationTestCase = {
        id: "prec-001",
        query: "TypeScript 类型",
        expectedKeywords: ["类型", "TypeScript"],
      };

      const response: RAGResponse = {
        answer: "TypeScript 的类型系统很强大。",
        contexts: [
          "TypeScript 是 JavaScript 的超集，添加了类型系统。",
          "类型注解可以帮助开发者发现错误。",
          "其他无关内容。",
        ],
        latencyMs: 100,
      };

      const result = calculator.evaluate(testCase, response);
      expect(result.scores.contextPrecision).toBeGreaterThan(0.5);
    });

    it("空上下文应该返回 0", () => {
      const result = calculator.evaluate(mockTestCase, emptyResponse);
      expect(result.scores.contextPrecision).toBe(0);
    });
  });

  describe("Context Recall 计算", () => {
    it("找到所有期望关键词时应该返回 1", () => {
      const testCase: EvaluationTestCase = {
        id: "recall-001",
        query: "数据库索引",
        expectedKeywords: ["索引", "B-tree"],
      };

      const response: RAGResponse = {
        answer: "数据库索引使用 B-tree 结构。",
        contexts: ["数据库索引通常使用 B-tree 数据结构来加速查询。"],
        latencyMs: 100,
      };

      const result = calculator.evaluate(testCase, response);
      expect(result.scores.contextRecall).toBe(1);
    });

    it("只找到部分关键词时应该返回比例值", () => {
      const testCase: EvaluationTestCase = {
        id: "recall-002",
        query: "数据库索引",
        expectedKeywords: ["索引", "B-tree", "哈希"],
      };

      const response: RAGResponse = {
        answer: "索引很重要。",
        contexts: ["数据库索引可以加速查询。"],
        latencyMs: 100,
      };

      const result = calculator.evaluate(testCase, response);
      expect(result.scores.contextRecall).toBeGreaterThan(0);
      expect(result.scores.contextRecall).toBeLessThan(1);
    });
  });
});

describe("calculateStatistics", () => {
  it("应该正确计算统计信息", () => {
    const values = [1, 2, 3, 4, 5];
    const stats = calculateStatistics(values);

    expect(stats.mean).toBe(3);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(5);
    expect(stats.std).toBeCloseTo(1.414, 2);
  });

  it("空数组应该返回全零", () => {
    const stats = calculateStatistics([]);

    expect(stats.mean).toBe(0);
    expect(stats.min).toBe(0);
    expect(stats.max).toBe(0);
    expect(stats.std).toBe(0);
  });

  it("单个值应该返回正确结果", () => {
    const stats = calculateStatistics([5]);

    expect(stats.mean).toBe(5);
    expect(stats.min).toBe(5);
    expect(stats.max).toBe(5);
    expect(stats.std).toBe(0);
  });
});

describe("calculatePercentile", () => {
  it("应该正确计算百分位数", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    expect(calculatePercentile(values, 50)).toBe(5);
    expect(calculatePercentile(values, 90)).toBe(9);
    expect(calculatePercentile(values, 100)).toBe(10);
  });

  it("空数组应该返回 0", () => {
    expect(calculatePercentile([], 50)).toBe(0);
  });

  it("单个值应该返回该值", () => {
    expect(calculatePercentile([42], 50)).toBe(42);
  });
});
