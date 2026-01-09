/**
 * ConfirmationInterceptor - 高风险操作确认拦截器
 *
 * 职责：
 * - 在 Tool 执行前检查是否需要用户确认
 * - 对高风险操作生成待确认请求
 * - 支持批量操作阈值检测
 * - 与 ConfirmationHandler 集成管理确认状态
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

import { logger } from "@/lib/logger";
import { confirmationHandler } from "../core/confirmation-handler";
import {
  BATCH_CONFIRMATION_THRESHOLD,
  requiresConfirmation,
  getOperationRiskLevel,
} from "../core/prompts/response-templates";
import type { Tool, ToolContext, ToolResult } from "../tools/types";
import type { PendingConfirmation } from "../tools/types";
import { inferRiskLevel } from "../tools/types";

// ============================================
// 类型定义
// ============================================

/**
 * 拦截检查结果
 */
export interface InterceptCheckResult {
  /** 是否需要确认 */
  requiresConfirmation: boolean;
  /** 风险等级 */
  riskLevel: "low" | "medium" | "high";
  /** 影响数量 */
  affectedCount: number;
  /** 需要确认的原因 */
  reason?: string;
}

/**
 * 拦截结果
 */
export interface InterceptResult {
  /** 是否被拦截 */
  intercepted: boolean;
  /** 待确认信息（如果被拦截） */
  confirmation?: PendingConfirmation;
  /** 原因说明 */
  reason?: string;
}

/**
 * 拦截器配置
 */
export interface ConfirmationInterceptorConfig {
  /** 是否启用拦截 */
  enabled: boolean;
  /** 批量操作确认阈值 */
  batchThreshold: number;
  /** 确认过期时间（毫秒） */
  confirmationExpiryMs: number;
  /** 是否跳过低风险操作确认 */
  skipLowRisk: boolean;
  /** 调试模式（记录详细日志） */
  debug: boolean;
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_CONFIG: ConfirmationInterceptorConfig = {
  enabled: true,
  batchThreshold: BATCH_CONFIRMATION_THRESHOLD,
  confirmationExpiryMs: 5 * 60 * 1000, // 5 minutes
  skipLowRisk: true,
  debug: false,
};

// ============================================
// ConfirmationInterceptor 类
// ============================================

/**
 * 高风险操作确认拦截器
 *
 * 在 Tool 执行前进行风险评估，对需要确认的操作生成待确认请求
 */
export class ConfirmationInterceptor {
  private config: ConfirmationInterceptorConfig;

  constructor(config: Partial<ConfirmationInterceptorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 检查操作是否需要确认
   *
   * @param tool - Tool 定义
   * @param params - 执行参数
   * @returns 检查结果
   */
  checkRequiresConfirmation(
    tool: Tool,
    params: Record<string, unknown>,
  ): InterceptCheckResult {
    const toolName = tool.definition.name;
    const toolRiskLevel = inferRiskLevel(tool.definition);

    // 从参数中提取影响数量
    const affectedCount = this.extractAffectedCount(params);

    // 检查 Tool 定义中的 requiresConfirmation 标志
    if (tool.definition.requiresConfirmation) {
      return {
        requiresConfirmation: true,
        riskLevel: toolRiskLevel,
        affectedCount,
        reason: "Tool 定义要求确认",
      };
    }

    // 检查操作名称的风险等级
    const operationRiskLevel = getOperationRiskLevel(toolName);

    // 高风险操作始终需要确认
    if (operationRiskLevel === "high") {
      return {
        requiresConfirmation: true,
        riskLevel: "high",
        affectedCount,
        reason: `高风险操作: ${toolName}`,
      };
    }

    // 检查批量操作阈值
    if (affectedCount > this.config.batchThreshold) {
      return {
        requiresConfirmation: true,
        riskLevel: toolRiskLevel,
        affectedCount,
        reason: `批量操作超过阈值: ${affectedCount} > ${this.config.batchThreshold}`,
      };
    }

    // 中等风险操作在特定条件下需要确认
    if (operationRiskLevel === "medium" && !this.config.skipLowRisk) {
      // 如果配置为不跳过低风险，中等风险也需要确认
      return {
        requiresConfirmation: true,
        riskLevel: "medium",
        affectedCount,
        reason: `中等风险操作: ${toolName}`,
      };
    }

    // 使用通用确认检查
    const needsConfirmation = requiresConfirmation(toolName, affectedCount);

    return {
      requiresConfirmation: needsConfirmation,
      riskLevel: toolRiskLevel,
      affectedCount,
      reason: needsConfirmation ? "通用风险检查触发" : undefined,
    };
  }

  /**
   * 拦截 Tool 执行
   *
   * @param tool - Tool 定义
   * @param params - 执行参数
   * @param context - 执行上下文
   * @returns 拦截结果
   */
  async intercept(
    tool: Tool,
    params: Record<string, unknown>,
    context: ToolContext,
  ): Promise<InterceptResult> {
    // 检查是否启用
    if (!this.config.enabled) {
      return { intercepted: false };
    }

    const toolName = tool.definition.name;
    const checkResult = this.checkRequiresConfirmation(tool, params);

    if (this.config.debug) {
      logger.debug(
        {
          toolName,
          checkResult,
          params: Object.keys(params),
        },
        "ConfirmationInterceptor: Check result",
      );
    }

    // 不需要确认，允许执行
    if (!checkResult.requiresConfirmation) {
      return { intercepted: false };
    }

    // 生成确认 ID
    const confirmationId = crypto.randomUUID();

    // 构建待确认信息
    const confirmation: PendingConfirmation = {
      confirmationId,
      toolName,
      description: this.generateDescription(tool, params, checkResult),
      impactSummary: this.generateImpactSummary(tool, params, checkResult),
      affectedItems: this.extractAffectedItems(params),
      params,
      expiresAt: new Date(Date.now() + this.config.confirmationExpiryMs),
      riskLevel: checkResult.riskLevel,
    };

    // 存储待确认请求
    await this.storeConfirmation(confirmation, context);

    logger.info(
      {
        confirmationId,
        toolName,
        riskLevel: checkResult.riskLevel,
        affectedCount: checkResult.affectedCount,
        userId: context.userId,
      },
      "ConfirmationInterceptor: Operation intercepted for confirmation",
    );

    return {
      intercepted: true,
      confirmation,
      reason: checkResult.reason,
    };
  }

  /**
   * 创建确认等待结果
   *
   * 返回给 LLM 的结果，表示操作需要用户确认
   *
   * @param confirmation - 待确认信息
   * @returns Tool 结果
   */
  createConfirmationResult(confirmation: PendingConfirmation): ToolResult {
    return {
      success: true,
      data: {
        __pendingConfirmation: confirmation,
        message: `操作需要确认。确认 ID: ${confirmation.confirmationId}`,
        status: "pending_confirmation",
      },
    };
  }

  /**
   * 检查确认状态
   *
   * @param confirmationId - 确认 ID
   * @param userId - 用户 ID
   * @returns 确认状态
   */
  async checkConfirmationStatus(
    confirmationId: string,
    userId: string,
  ): Promise<{
    status: "pending" | "confirmed" | "cancelled" | "expired" | "not_found";
    confirmation?: PendingConfirmation;
  }> {
    const stored = confirmationHandler.get(confirmationId, userId);

    if (!stored) {
      return { status: "not_found" };
    }

    // 检查是否过期
    if (new Date() > stored.confirmation.expiresAt) {
      // 自动取消过期的确认
      confirmationHandler.cancel(confirmationId, userId);
      return { status: "expired", confirmation: stored.confirmation };
    }

    return { status: stored.state, confirmation: stored.confirmation };
  }

  /**
   * 确认操作
   *
   * @param confirmationId - 确认 ID
   * @param userId - 用户 ID
   * @returns 确认结果
   */
  async confirm(
    confirmationId: string,
    userId: string,
  ): Promise<{
    success: boolean;
    confirmation?: PendingConfirmation;
    error?: string;
  }> {
    const stored = confirmationHandler.get(confirmationId, userId);

    if (!stored) {
      return { success: false, error: "确认请求不存在或已过期" };
    }

    // 检查是否过期
    if (new Date() > stored.confirmation.expiresAt) {
      confirmationHandler.cancel(confirmationId, userId);
      return { success: false, error: "确认请求已过期" };
    }

    // 标记为已确认
    const result = confirmationHandler.confirm(confirmationId, userId);

    if (result.success) {
      logger.info(
        { confirmationId, userId },
        "ConfirmationInterceptor: Operation confirmed",
      );
      return { success: true, confirmation: stored.confirmation };
    }

    return { success: false, error: result.error || "确认失败" };
  }

  /**
   * 取消确认
   *
   * @param confirmationId - 确认 ID
   * @param userId - 用户 ID
   * @returns 取消结果
   */
  async cancel(
    confirmationId: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const result = confirmationHandler.cancel(confirmationId, userId);

    if (result.success) {
      logger.info(
        { confirmationId, userId },
        "ConfirmationInterceptor: Operation cancelled",
      );
      return { success: true };
    }

    return { success: false, error: result.error || "确认请求不存在" };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ConfirmationInterceptorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): ConfirmationInterceptorConfig {
    return { ...this.config };
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 从参数中提取影响数量
   */
  private extractAffectedCount(params: Record<string, unknown>): number {
    // 常见的批量操作参数
    const countFields = [
      "ids",
      "bookmarkIds",
      "folderIds",
      "tagIds",
      "items",
      "targets",
    ];

    for (const field of countFields) {
      if (Array.isArray(params[field])) {
        return (params[field] as unknown[]).length;
      }
    }

    // 检查 count 字段
    if (typeof params.count === "number") {
      return params.count;
    }

    // 单个操作
    return 1;
  }

  /**
   * 从参数中提取受影响的项目
   */
  private extractAffectedItems(
    params: Record<string, unknown>,
  ): Array<{ id: number | string; title: string }> | undefined {
    // 检查是否有明确的受影响项目列表
    if (Array.isArray(params.affectedItems)) {
      return params.affectedItems as Array<{
        id: number | string;
        title: string;
      }>;
    }

    // 检查 IDs 列表
    const idFields = ["ids", "bookmarkIds", "folderIds"];
    for (const field of idFields) {
      if (Array.isArray(params[field])) {
        const ids = params[field] as (number | string)[];
        // 只返回前 10 个，避免列表过长
        return ids.slice(0, 10).map((id) => ({
          id,
          title: `项目 ${id}`,
        }));
      }
    }

    return undefined;
  }

  /**
   * 生成操作描述
   */
  private generateDescription(
    tool: Tool,
    params: Record<string, unknown>,
    checkResult: InterceptCheckResult,
  ): string {
    const toolName = tool.definition.name;
    const toolDescription = tool.definition.description;

    // 基于工具名称生成友好描述
    const actionDescriptions: Record<string, string> = {
      delete_bookmark: "删除书签",
      batch_delete_bookmarks: "批量删除书签",
      delete_folder: "删除文件夹",
      remove_tag: "移除标签",
      clear_folder: "清空文件夹",
      move_bookmarks: "移动书签",
      batch_move: "批量移动",
      batch_add_tags: "批量添加标签",
      batch_remove_tags: "批量移除标签",
    };

    const action = actionDescriptions[toolName] || toolDescription;

    if (checkResult.affectedCount > 1) {
      return `${action}（共 ${checkResult.affectedCount} 项）`;
    }

    return action;
  }

  /**
   * 生成影响摘要
   */
  private generateImpactSummary(
    tool: Tool,
    params: Record<string, unknown>,
    checkResult: InterceptCheckResult,
  ): string {
    const { riskLevel, affectedCount } = checkResult;

    const riskLabels: Record<string, string> = {
      low: "低风险",
      medium: "中等风险",
      high: "高风险",
    };

    let summary = `${riskLabels[riskLevel]}操作`;

    if (affectedCount > 1) {
      summary += `，将影响 ${affectedCount} 个项目`;
    }

    // 高风险操作的额外警告
    if (riskLevel === "high") {
      summary += "。此操作不可撤销，请确认后再执行。";
    }

    return summary;
  }

  /**
   * 存储确认请求
   */
  private async storeConfirmation(
    confirmation: PendingConfirmation,
    context: ToolContext,
  ): Promise<void> {
    // 使用 ConfirmationHandler 存储
    confirmationHandler.store(confirmation, {
      userId: context.userId,
      conversationId: context.conversationId,
    });
  }
}

// ============================================
// 单例实例
// ============================================

/**
 * 全局确认拦截器实例
 */
export const confirmationInterceptor = new ConfirmationInterceptor();

// ============================================
// 工厂函数
// ============================================

/**
 * 创建确认拦截器
 */
export function createConfirmationInterceptor(
  config?: Partial<ConfirmationInterceptorConfig>,
): ConfirmationInterceptor {
  return new ConfirmationInterceptor(config);
}
