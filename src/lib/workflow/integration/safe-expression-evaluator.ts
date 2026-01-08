/**
 * 安全表达式求值器
 *
 * 使用 expr-eval 替代 new Function()，避免代码注入风险
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { Parser } from "expr-eval";
import { logger } from "@/lib/logger";

/**
 * 表达式验证结果
 */
export interface ExpressionValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 安全表达式求值器
 *
 * 使用 expr-eval 替代 new Function()，避免代码注入风险
 */
export class SafeExpressionEvaluator {
  private parser: Parser;

  constructor() {
    // 创建受限的表达式解析器
    this.parser = new Parser({
      operators: {
        // 允许的操作符
        comparison: true, // ==, !=, <, >, <=, >=
        logical: true, // &&, ||, !
        conditional: true, // ? :
        add: true,
        subtract: true,
        multiply: true,
        divide: true,
        // 禁止的操作符
        remainder: false, // 禁止 %
        power: false, // 禁止 ^
        concatenate: true,
        in: true,
      },
    });

    // 添加安全的内置函数
    this.registerBuiltinFunctions();
  }

  /**
   * 注册内置函数
   */
  private registerBuiltinFunctions(): void {
    // includes - 检查数组是否包含元素
    this.parser.functions.includes = (arr: unknown[], item: unknown) =>
      Array.isArray(arr) && arr.includes(item);

    // length - 获取数组或字符串长度
    this.parser.functions.length = (val: unknown) => {
      if (Array.isArray(val)) return val.length;
      if (typeof val === "string") return val.length;
      return 0;
    };

    // isEmpty - 检查值是否为空
    this.parser.functions.isEmpty = (val: unknown) =>
      val === null ||
      val === undefined ||
      val === "" ||
      (Array.isArray(val) && val.length === 0);

    // startsWith - 检查字符串是否以指定前缀开头
    this.parser.functions.startsWith = (str: string, prefix: string) =>
      typeof str === "string" && str.startsWith(prefix);

    // endsWith - 检查字符串是否以指定后缀结尾
    this.parser.functions.endsWith = (str: string, suffix: string) =>
      typeof str === "string" && str.endsWith(suffix);

    // contains - 检查字符串是否包含子串
    this.parser.functions.contains = (str: string, substr: string) =>
      typeof str === "string" && str.includes(substr);

    // not - 逻辑非
    this.parser.functions.not = (val: unknown) => !val;

    // min - 最小值
    this.parser.functions.min = (...args: number[]) => Math.min(...args);

    // max - 最大值
    this.parser.functions.max = (...args: number[]) => Math.max(...args);

    // abs - 绝对值
    this.parser.functions.abs = (val: number) => Math.abs(val);

    // floor - 向下取整
    this.parser.functions.floor = (val: number) => Math.floor(val);

    // ceil - 向上取整
    this.parser.functions.ceil = (val: number) => Math.ceil(val);

    // round - 四舍五入
    this.parser.functions.round = (val: number) => Math.round(val);
  }

  /**
   * 安全地评估条件表达式
   *
   * @param expression 条件表达式，例如 "count > 10 && status == 'active'"
   * @param variables 变量上下文
   * @returns 布尔结果
   */
  evaluate(expression: string, variables: Record<string, unknown>): boolean {
    try {
      // 解析表达式
      const parsed = this.parser.parse(expression);

      // 评估表达式
      const result = parsed.evaluate(variables as Record<string, number>);

      // 强制转换为布尔值
      return Boolean(result);
    } catch (error) {
      logger.warn(
        { expression, error },
        "SafeExpressionEvaluator: Expression evaluation failed",
      );
      return false;
    }
  }

  /**
   * 评估表达式并返回任意类型结果
   *
   * @param expression 表达式
   * @param variables 变量上下文
   * @returns 表达式结果
   */
  evaluateAny(expression: string, variables: Record<string, unknown>): unknown {
    try {
      const parsed = this.parser.parse(expression);
      return parsed.evaluate(variables as Record<string, number>);
    } catch (error) {
      logger.warn(
        { expression, error },
        "SafeExpressionEvaluator: Expression evaluation failed",
      );
      return undefined;
    }
  }

  /**
   * 验证表达式是否安全有效
   */
  validate(expression: string): ExpressionValidationResult {
    try {
      this.parser.parse(expression);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Invalid expression",
      };
    }
  }
}

// 单例导出
let evaluatorInstance: SafeExpressionEvaluator | null = null;

export function getSafeExpressionEvaluator(): SafeExpressionEvaluator {
  if (!evaluatorInstance) {
    evaluatorInstance = new SafeExpressionEvaluator();
  }
  return evaluatorInstance;
}

/**
 * 便捷函数：安全评估条件
 */
export function safeEvaluateCondition(
  expression: string,
  variables: Record<string, unknown>,
): boolean {
  return getSafeExpressionEvaluator().evaluate(expression, variables);
}
