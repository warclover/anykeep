/**
 * 输入映射工具
 *
 * 用于解析工作流步骤的输入参数映射
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { getNestedValue } from "./object-utils";

/**
 * 变量上下文接口
 */
export interface VariableContext {
  variables: Record<string, unknown>;
}

/**
 * 解析输入映射
 *
 * 将包含变量引用（${varName}）的映射解析为实际值
 *
 * @param mapping - 输入映射配置
 * @param context - 包含变量的上下文
 * @returns 解析后的值对象
 *
 * @example
 * ```typescript
 * const context = { variables: { foo: "bar", nested: { value: 123 } } };
 * const mapping = { simple: "${foo}", deep: "${nested.value}", literal: "unchanged" };
 * resolveInputMapping(mapping, context);
 * // { simple: "bar", deep: 123, literal: "unchanged" }
 * ```
 */
export function resolveInputMapping(
  mapping: Record<string, string | unknown>,
  context: VariableContext,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(mapping)) {
    if (
      typeof value === "string" &&
      value.startsWith("${") &&
      value.endsWith("}")
    ) {
      // 变量引用：${varName} 或 ${step.output.field}
      const varPath = value.slice(2, -1);
      result[key] = getNestedValue(context.variables, varPath);
    } else {
      result[key] = value;
    }
  }

  return result;
}
