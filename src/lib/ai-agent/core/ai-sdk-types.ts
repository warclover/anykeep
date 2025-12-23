/**
 * AI SDK 类型适配器
 *
 * 解决 Vercel AI SDK 与项目内部类型系统的兼容性问题
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import type { Tool as VercelTool, ToolSet } from "ai";
import type { z } from "zod";

/**
 * 内部 Tool 类型定义
 * 与 Vercel AI SDK 的 Tool 类型略有不同
 */
export interface InternalTool<TInput = unknown, TOutput = unknown> {
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  execute: (input: TInput) => Promise<TOutput>;
}

/**
 * 将内部 Tool 转换为 Vercel AI SDK Tool
 *
 * 注意：Vercel AI SDK 的 Tool 类型使用 JSON Schema 而非 Zod
 * 但实际运行时，SDK 会自动处理 Zod schema 的转换
 * 这里的类型断言是必要的桥接层
 *
 * @param tool - 内部 Tool 对象
 * @returns Vercel AI SDK 兼容的 Tool
 */
export function toVercelTool<TInput, TOutput>(
  tool: InternalTool<TInput, TOutput>,
): VercelTool<TInput, TOutput> {
  // Vercel AI SDK 在运行时支持 Zod schema，但 TypeScript 类型定义不完全匹配
  // 使用类型断言进行桥接（这是已知的 SDK 类型问题）
  return {
    description: tool.description,
    parameters: tool.inputSchema,
    execute: tool.execute,
  } as unknown as VercelTool<TInput, TOutput>;
}

/**
 * 合并多个 Tool 集合为 ToolSet
 *
 * @param toolSets - 要合并的 Tool 集合
 * @returns 合并后的 ToolSet
 */
export function mergeToolSets(
  ...toolSets: Array<Record<string, unknown>>
): ToolSet {
  const merged: Record<string, unknown> = {};
  for (const set of toolSets) {
    Object.assign(merged, set);
  }
  // ToolSet 是 Record<string, Tool> 的别名
  // 由于我们的 Tool 实现与 SDK 类型有细微差异，需要类型断言
  return merged as ToolSet;
}

/**
 * 类型守卫：检查对象是否为有效的 Tool
 */
export function isValidTool(obj: unknown): obj is InternalTool {
  if (typeof obj !== "object" || obj === null) return false;
  const tool = obj as Record<string, unknown>;
  return (
    typeof tool.description === "string" &&
    typeof tool.execute === "function" &&
    tool.inputSchema !== undefined
  );
}
