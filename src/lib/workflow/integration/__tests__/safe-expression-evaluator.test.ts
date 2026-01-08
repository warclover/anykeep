/**
 * SafeExpressionEvaluator 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  SafeExpressionEvaluator,
  getSafeExpressionEvaluator,
  safeEvaluateCondition,
} from "../safe-expression-evaluator";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("SafeExpressionEvaluator", () => {
  let evaluator: SafeExpressionEvaluator;

  beforeEach(() => {
    evaluator = new SafeExpressionEvaluator();
  });

  describe("evaluate", () => {
    describe("comparison operators", () => {
      it("should evaluate greater than", () => {
        expect(evaluator.evaluate("count > 10", { count: 15 })).toBe(true);
        expect(evaluator.evaluate("count > 10", { count: 5 })).toBe(false);
      });

      it("should evaluate less than", () => {
        expect(evaluator.evaluate("count < 10", { count: 5 })).toBe(true);
        expect(evaluator.evaluate("count < 10", { count: 15 })).toBe(false);
      });

      it("should evaluate greater than or equal", () => {
        expect(evaluator.evaluate("count >= 10", { count: 10 })).toBe(true);
        expect(evaluator.evaluate("count >= 10", { count: 15 })).toBe(true);
        expect(evaluator.evaluate("count >= 10", { count: 5 })).toBe(false);
      });

      it("should evaluate less than or equal", () => {
        expect(evaluator.evaluate("count <= 10", { count: 10 })).toBe(true);
        expect(evaluator.evaluate("count <= 10", { count: 5 })).toBe(true);
        expect(evaluator.evaluate("count <= 10", { count: 15 })).toBe(false);
      });

      it("should evaluate equality", () => {
        // expr-eval 主要支持数值比较
        expect(evaluator.evaluate("status == 1", { status: 1 })).toBe(true);
        expect(evaluator.evaluate("status == 1", { status: 0 })).toBe(false);
      });

      it("should evaluate inequality", () => {
        expect(evaluator.evaluate("status != 1", { status: 0 })).toBe(true);
        expect(evaluator.evaluate("status != 1", { status: 1 })).toBe(false);
      });
    });

    describe("logical operators", () => {
      // expr-eval 使用 'and' 和 'or' 关键字，而不是 && 和 ||
      it("should evaluate AND using 'and' keyword", () => {
        expect(
          evaluator.evaluate("count > 10 and active == 1", {
            count: 15,
            active: 1,
          }),
        ).toBe(true);
        expect(
          evaluator.evaluate("count > 10 and active == 1", {
            count: 15,
            active: 0,
          }),
        ).toBe(false);
      });

      it("should evaluate OR using 'or' keyword", () => {
        expect(
          evaluator.evaluate("count > 10 or active == 1", {
            count: 5,
            active: 1,
          }),
        ).toBe(true);
        expect(
          evaluator.evaluate("count > 10 or active == 1", {
            count: 5,
            active: 0,
          }),
        ).toBe(false);
      });

      it("should evaluate NOT", () => {
        expect(evaluator.evaluate("not(flag)", { flag: false })).toBe(true);
        expect(evaluator.evaluate("not(flag)", { flag: true })).toBe(false);
      });
    });

    describe("arithmetic operators", () => {
      it("should evaluate addition", () => {
        expect(evaluator.evaluate("a + b > 10", { a: 5, b: 6 })).toBe(true);
      });

      it("should evaluate subtraction", () => {
        expect(evaluator.evaluate("a - b > 0", { a: 10, b: 5 })).toBe(true);
      });

      it("should evaluate multiplication", () => {
        expect(evaluator.evaluate("a * b > 20", { a: 5, b: 5 })).toBe(true);
      });

      it("should evaluate division", () => {
        expect(evaluator.evaluate("a / b > 2", { a: 10, b: 3 })).toBe(true);
      });
    });

    describe("conditional operator", () => {
      it("should evaluate ternary operator", () => {
        expect(evaluator.evaluate("flag ? 1 : 0", { flag: true })).toBe(true);
        expect(evaluator.evaluate("flag ? 1 : 0", { flag: false })).toBe(false);
      });
    });
  });

  describe("builtin functions", () => {
    describe("includes", () => {
      it("should check array inclusion with numbers", () => {
        expect(evaluator.evaluate("includes(arr, 1)", { arr: [1, 2, 3] })).toBe(
          true,
        );
        expect(evaluator.evaluate("includes(arr, 4)", { arr: [1, 2, 3] })).toBe(
          false,
        );
      });

      it("should handle non-array input", () => {
        expect(evaluator.evaluate("includes(num, 1)", { num: 123 })).toBe(
          false,
        );
      });
    });

    describe("length", () => {
      it("should get array length", () => {
        expect(evaluator.evaluate("length(arr) > 2", { arr: [1, 2, 3] })).toBe(
          true,
        );
      });

      it("should get string length", () => {
        expect(evaluator.evaluate("length(str) > 3", { str: "hello" })).toBe(
          true,
        );
      });

      it("should handle arrays correctly", () => {
        expect(evaluator.evaluate("length(arr) == 3", { arr: [1, 2, 3] })).toBe(
          true,
        );
      });
    });

    describe("isEmpty", () => {
      it("should check empty string", () => {
        expect(evaluator.evaluate("isEmpty(val)", { val: "" })).toBe(true);
      });

      it("should check empty array", () => {
        expect(evaluator.evaluate("isEmpty(val)", { val: [] })).toBe(true);
      });

      it("should return false for non-empty values", () => {
        expect(evaluator.evaluate("isEmpty(val)", { val: "hello" })).toBe(
          false,
        );
        expect(evaluator.evaluate("isEmpty(val)", { val: [1, 2] })).toBe(false);
      });

      it("should return false for numbers", () => {
        expect(evaluator.evaluate("isEmpty(val)", { val: 0 })).toBe(false);
        expect(evaluator.evaluate("isEmpty(val)", { val: 123 })).toBe(false);
      });
    });

    describe("string functions", () => {
      it("should check startsWith", () => {
        expect(
          evaluator.evaluate("startsWith(str, 'hello')", {
            str: "hello world",
          }),
        ).toBe(true);
        expect(
          evaluator.evaluate("startsWith(str, 'world')", {
            str: "hello world",
          }),
        ).toBe(false);
      });

      it("should check endsWith", () => {
        expect(
          evaluator.evaluate("endsWith(str, 'world')", { str: "hello world" }),
        ).toBe(true);
        expect(
          evaluator.evaluate("endsWith(str, 'hello')", { str: "hello world" }),
        ).toBe(false);
      });

      it("should check contains", () => {
        expect(
          evaluator.evaluate("contains(str, 'lo wo')", { str: "hello world" }),
        ).toBe(true);
        expect(
          evaluator.evaluate("contains(str, 'xyz')", { str: "hello world" }),
        ).toBe(false);
      });
    });

    describe("math functions", () => {
      it("should calculate min", () => {
        expect(evaluator.evaluate("min(a, b) == 5", { a: 5, b: 10 })).toBe(
          true,
        );
      });

      it("should calculate max", () => {
        expect(evaluator.evaluate("max(a, b) == 10", { a: 5, b: 10 })).toBe(
          true,
        );
      });

      it("should calculate abs", () => {
        expect(evaluator.evaluate("abs(val) == 5", { val: -5 })).toBe(true);
      });

      it("should calculate floor", () => {
        expect(evaluator.evaluate("floor(val) == 3", { val: 3.7 })).toBe(true);
      });

      it("should calculate ceil", () => {
        expect(evaluator.evaluate("ceil(val) == 4", { val: 3.2 })).toBe(true);
      });

      it("should calculate round", () => {
        expect(evaluator.evaluate("round(val) == 4", { val: 3.5 })).toBe(true);
        expect(evaluator.evaluate("round(val) == 3", { val: 3.4 })).toBe(true);
      });
    });
  });

  describe("evaluateAny", () => {
    it("should return numeric result", () => {
      const result = evaluator.evaluateAny("a + b", { a: 5, b: 3 });
      expect(result).toBe(8);
    });

    it("should return string result", () => {
      const result = evaluator.evaluateAny("str", { str: "hello" });
      expect(result).toBe("hello");
    });

    it("should return undefined for invalid expression", () => {
      const result = evaluator.evaluateAny("invalid[syntax", {});
      expect(result).toBeUndefined();
    });
  });

  describe("validate", () => {
    it("should return valid for correct expressions", () => {
      expect(evaluator.validate("a > 10")).toEqual({ valid: true });
      expect(evaluator.validate("a and b")).toEqual({ valid: true });
      expect(evaluator.validate("length(arr) > 0")).toEqual({ valid: true });
    });

    it("should return invalid for syntax errors", () => {
      const result = evaluator.validate("a > > 10");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return invalid for unmatched parentheses", () => {
      const result = evaluator.validate("(a > 10");
      expect(result.valid).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should return false for invalid expressions in evaluate", () => {
      expect(evaluator.evaluate("invalid[syntax", {})).toBe(false);
    });

    it("should return false for runtime errors", () => {
      // expr-eval 对未定义变量有不同的处理方式
      expect(evaluator.evaluate("unknownFunc()", {})).toBe(false);
    });
  });

  describe("singleton", () => {
    it("should return same instance", () => {
      const instance1 = getSafeExpressionEvaluator();
      const instance2 = getSafeExpressionEvaluator();
      expect(instance1).toBe(instance2);
    });
  });

  describe("convenience function", () => {
    it("should evaluate condition using convenience function", () => {
      expect(safeEvaluateCondition("count > 10", { count: 15 })).toBe(true);
      expect(safeEvaluateCondition("count > 10", { count: 5 })).toBe(false);
    });
  });

  describe("complex expressions", () => {
    it("should evaluate complex nested conditions", () => {
      // 使用 and 和 or 关键字
      const result = evaluator.evaluate(
        "(count > 10 and active == 1) or priority == 1",
        { count: 5, active: 0, priority: 1 },
      );
      expect(result).toBe(true);
    });

    it("should evaluate workflow-like conditions", () => {
      // 模拟工作流条件：未分类书签 > 50 且 本周活动 < 5
      const result = evaluator.evaluate(
        "untaggedCount > 50 and weeklyActivity < 5",
        { untaggedCount: 60, weeklyActivity: 2 },
      );
      expect(result).toBe(true);
    });

    it("should evaluate array-based conditions", () => {
      // 模拟工作流条件：数组包含检查使用 includes 函数
      const result = evaluator.evaluate("includes(platforms, 1)", {
        platforms: [1, 2, 3],
      });
      expect(result).toBe(true);
    });
  });
});
