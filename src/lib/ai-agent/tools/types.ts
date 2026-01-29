/**
 * AI Agent Tools 类型定义
 *
 * 定义 Tool 的基础接口和类型
 * 遵循 MCP (Model Context Protocol) 标准
 *
 * @version 2.0.0 - Phase 3: MCP 标准化
 * @since 2025-12-23
 * @updated 2025-12-26 添加 reasoning 参数支持
 * @updated 2025-12-29 添加 MCP 标准特性 (riskLevel, outputSchema, 扩展分类)
 */

import { z } from "zod";

// ============================================
// 基础参数 Schema（包含 reasoning）
// ============================================

/**
 * 通用工具参数基类
 *
 * 所有工具参数可选择性地继承此 Schema，以支持 reasoning 参数
 *
 * @example
 * ```ts
 * const myToolParams = BaseToolParamsSchema.extend({
 *   limit: z.number().optional(),
 * });
 * ```
 */
export const BaseToolParamsSchema = z.object({
  reasoning: z
    .string()
    .optional()
    .describe("选择此工具的理由（内部使用，不展示给用户）"),
});

/**
 * 基础工具参数类型
 */
export type BaseToolParams = z.infer<typeof BaseToolParamsSchema>;

/**
 * 扩展工具参数 Schema 以包含 reasoning
 *
 * @param schema - 原始参数 Schema
 * @returns 包含 reasoning 的扩展 Schema
 */
export function withReasoning<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.extend({
    reasoning: z
      .string()
      .optional()
      .describe("选择此工具的理由（内部使用，不展示给用户）"),
  });
}

/**
 * 提取 reasoning 参数（如果存在）
 *
 * @param params - 工具参数
 * @returns reasoning 字符串或 undefined
 */
export function extractReasoning(params: unknown): string | undefined {
  if (
    params &&
    typeof params === "object" &&
    "reasoning" in params &&
    typeof (params as { reasoning?: unknown }).reasoning === "string"
  ) {
    return (params as { reasoning: string }).reasoning;
  }
  return undefined;
}

// ============================================
// Tool 定义类型
// ============================================

/**
 * Tool 分类 (MCP 标准扩展)
 *
 * 原有分类: query, read, action, search
 * 新增分类: analysis, export, system
 */
export type ToolCategory =
  | "query" // 查询类 (只读，快速)
  | "read" // 读取类 (获取详情)
  | "action" // 操作类 (写入，可能需要确认)
  | "search" // 搜索类 (向量/全文搜索)
  | "analysis" // 分析类 (统计、报告)
  | "export" // 导出类 (数据导出)
  | "system"; // 系统类 (设置、配置)

/**
 * Tool 风险等级 (MCP 标准)
 *
 * 用于决定是否需要用户确认
 */
export type ToolRiskLevel = "low" | "medium" | "high";

/**
 * Tool 定义
 *
 * 注意：parameters 使用 z.ZodType<TParams, z.ZodTypeDef, unknown> 以支持
 * .optional().default() 模式，其中 _input 类型可能包含 undefined
 */
export interface ToolDefinition<TParams = unknown, TOutput = unknown> {
  /** Tool 名称（唯一标识） */
  name: string;
  /** Tool 描述（供 AI 理解用途） */
  description: string;
  /** 参数 Schema（支持 optional + default 模式） */
  parameters: z.ZodType<TParams, z.ZodTypeDef, unknown>;
  /** 输出 Schema（可选，用于类型安全） */
  outputSchema?: z.ZodSchema<TOutput>;
  /** 分类 */
  category: ToolCategory;
  /** 风险等级 (MCP 标准) */
  riskLevel?: ToolRiskLevel;
  /** 是否需要用户确认 (向后兼容，优先使用 riskLevel) */
  requiresConfirmation?: boolean;
  /** 预估执行时间（毫秒） */
  estimatedDurationMs?: number;
}

/**
 * 搜索结果信息
 */
export interface SearchResultInfo {
  /** 搜索查询词 */
  query: string;
  /** 搜索结果书签 ID 列表 */
  resultIds: number[];
}

/**
 * 搜索结果记录回调
 */
export type OnSearchResultsCallback = (info: SearchResultInfo) => void;

/**
 * Tool 执行上下文
 */
export interface ToolContext {
  /** 用户 ID */
  userId: string;
  /** 会话 ID */
  conversationId?: string;
  /** 追踪 ID */
  traceId?: string;
  /** 是否已确认（用于需要确认的操作） */
  confirmed?: boolean;
  /** 确认 ID（用于追踪确认状态） */
  confirmationId?: string;
  /** 搜索结果记录回调（用于上下文保持） */
  onSearchResults?: OnSearchResultsCallback;
}

/**
 * Tool 执行结果元数据
 */
export interface ToolResultMetadata {
  /** 执行时间（毫秒） */
  executionTimeMs: number;
  /** 影响的记录数 */
  affectedCount?: number;
  /** 是否从缓存返回 */
  fromCache?: boolean;
}

/**
 * Tool 执行成功结果
 */
export interface ToolSuccessResult<T = unknown> {
  success: true;
  data: T;
  metadata?: ToolResultMetadata;
}

/**
 * Tool 执行失败结果
 */
export interface ToolErrorResult {
  success: false;
  error: string;
  errorCode?: string;
  metadata?: ToolResultMetadata;
}

/**
 * Tool 执行结果
 */
export type ToolResult<T = unknown> = ToolSuccessResult<T> | ToolErrorResult;

// ============================================
// 确认流程类型
// ============================================

/**
 * 待确认操作详情
 */
export interface PendingConfirmation {
  /** 确认 ID */
  confirmationId: string;
  /** Tool 名称 */
  toolName: string;
  /** 操作描述（用户友好） */
  description: string;
  /** 影响范围说明 */
  impactSummary: string;
  /** 具体影响的项目列表 */
  affectedItems?: Array<{
    id: number | string;
    title: string;
  }>;
  /** 操作参数（用于确认后执行） */
  params: unknown;
  /** 过期时间 */
  expiresAt: Date;
  /** 风险等级 */
  riskLevel: "low" | "medium" | "high";
}

/**
 * 需要确认的 Tool 结果
 */
export interface ToolConfirmationResult {
  success: true;
  requiresConfirmation: true;
  confirmation: PendingConfirmation;
}

/**
 * 确认操作的响应
 */
export interface ConfirmationResponse {
  /** 确认 ID */
  confirmationId: string;
  /** 用户选择：确认或取消 */
  action: "confirm" | "cancel";
}

/**
 * 完整的 Tool 结果（包含确认流程）
 */
export type ToolResultWithConfirmation<T = unknown> =
  | ToolSuccessResult<T>
  | ToolErrorResult
  | ToolConfirmationResult;

/**
 * Tool 接口
 */
export interface Tool<TParams = unknown, TResult = unknown> {
  /** Tool 定义 */
  definition: ToolDefinition<TParams, TResult>;
  /** 执行函数 */
  execute: (
    params: TParams,
    context: ToolContext,
  ) => Promise<ToolResult<TResult>>;
}

// ============================================
// Tool 注册表类型
// ============================================

/**
 * Tool 注册表统计
 */
export interface ToolRegistryStats {
  totalTools: number;
  byCategory: Record<ToolCategory, number>;
  byRiskLevel?: Record<ToolRiskLevel, number>;
}

/**
 * Tool 简要信息
 */
export interface ToolSummary {
  name: string;
  description: string;
  category: ToolCategory;
  riskLevel: ToolRiskLevel;
  requiresConfirmation: boolean;
}

// ============================================
// Vercel AI SDK 兼容类型
// ============================================

/**
 * 转换为 Vercel AI SDK tool 格式
 *
 * 注意：Vercel AI SDK 实际使用 parameters 而非 inputSchema
 */
export interface VercelAITool {
  description: string;
  parameters: z.ZodSchema;
  execute?: (args: unknown) => Promise<unknown>;
}

// ============================================
// MCP 标准辅助函数
// ============================================

/**
 * 根据 Tool 定义推断风险等级
 *
 * 规则：
 * - 如果显式指定 riskLevel，使用它
 * - 如果 requiresConfirmation 为 true，返回 "high"
 * - 根据 category 推断默认风险等级
 */
export function inferRiskLevel(definition: ToolDefinition): ToolRiskLevel {
  // 显式指定
  if (definition.riskLevel) {
    return definition.riskLevel;
  }

  // 向后兼容
  if (definition.requiresConfirmation) {
    return "high";
  }

  // 根据分类推断
  const categoryRisk: Record<ToolCategory, ToolRiskLevel> = {
    query: "low",
    read: "low",
    search: "low",
    analysis: "low",
    export: "medium",
    action: "medium",
    system: "medium",
  };

  return categoryRisk[definition.category] || "low";
}

/**
 * 判断 Tool 是否需要用户确认
 *
 * 规则：
 * - 如果显式指定 requiresConfirmation，使用它
 * - 如果 riskLevel 为 "high"，需要确认
 */
export function toolRequiresConfirmation(definition: ToolDefinition): boolean {
  if (definition.requiresConfirmation !== undefined) {
    return definition.requiresConfirmation;
  }

  return inferRiskLevel(definition) === "high";
}

/**
 * 获取分类的默认风险等级
 */
export function getCategoryDefaultRisk(category: ToolCategory): ToolRiskLevel {
  const defaults: Record<ToolCategory, ToolRiskLevel> = {
    query: "low",
    read: "low",
    search: "low",
    analysis: "low",
    export: "medium",
    action: "medium",
    system: "medium",
  };

  return defaults[category];
}
