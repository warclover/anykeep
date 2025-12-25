/**
 * AI Actions 执行器（协调器）
 *
 * 职责：
 * - 统一执行 AI 操作请求
 * - 权限验证和审计
 * - 路由到具体处理器
 * - 返回结构化结果
 *
 * @version 2.0.0
 * @since 2025-12-22
 * @updated 2025-12-25 - Refactored into coordinator pattern
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { AIActionType, AIActionRequest, AIActionResult } from "./types";
import {
  isWriteAction as checkWriteAction,
  getDefaultConfirmationRequirement as getConfirmation,
  getActionDescription as getDescription,
} from "./types";

// Import handlers
import {
  bookmarkSearch,
  bookmarkGet,
  bookmarkList,
  bookmarkRelated,
  bookmarkCreate,
  bookmarkUpdate,
  bookmarkMove,
  bookmarkDelete,
  bookmarkRate,
  folderList,
  folderGet,
  folderBookmarks,
  folderCreate,
  folderUpdate,
  folderDelete,
  tagList,
  tagBookmarks,
  tagAdd,
  tagRemove,
  tagBatchAdd,
  tagBatchRemove,
  userPreferences,
  userStats,
} from "./handlers";

// ============================================================================
// 执行上下文
// ============================================================================

/**
 * AI Action 执行上下文
 */
export interface AIActionContext {
  /** 用户 ID */
  userId: string;
  /** 追踪 ID */
  traceId?: string;
  /** 是否已确认（用于写入操作） */
  confirmed?: boolean;
}

// ============================================================================
// AI Action 执行器
// ============================================================================

/**
 * AI Action 执行器类
 */
export class AIActionExecutor {
  private supabase: Awaited<ReturnType<typeof createClient>>;
  private context: AIActionContext;

  private constructor(
    supabase: Awaited<ReturnType<typeof createClient>>,
    context: AIActionContext,
  ) {
    this.supabase = supabase;
    this.context = context;
  }

  /**
   * 创建执行器实例
   */
  static async create(context: AIActionContext): Promise<AIActionExecutor> {
    const supabase = await createClient();
    return new AIActionExecutor(supabase, context);
  }

  /**
   * 执行 AI 操作
   */
  async execute<T extends AIActionType>(
    request: AIActionRequest<T>,
  ): Promise<AIActionResult> {
    const startTime = performance.now();
    const {
      type,
      params,
      requiresConfirmation,
      description: _description,
    } = request;

    logger.info(
      {
        userId: this.context.userId,
        action: type,
        traceId: this.context.traceId,
      },
      `AI Action executing: ${getDescription(type)}`,
    );

    try {
      // 1. 检查是否需要确认
      const needsConfirm = requiresConfirmation ?? getConfirmation(type);

      if (checkWriteAction(type) && needsConfirm && !this.context.confirmed) {
        return this.buildConfirmation(type, params as Record<string, unknown>);
      }

      // 2. 执行具体操作
      const result = await this.executeAction(
        type,
        params as Record<string, unknown>,
      );

      const latencyMs = Math.round(performance.now() - startTime);
      logger.info(
        {
          userId: this.context.userId,
          action: type,
          latencyMs,
          success: result.success,
        },
        `AI Action completed: ${getDescription(type)}`,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(
        {
          userId: this.context.userId,
          action: type,
          error: errorMessage,
        },
        `AI Action failed: ${getDescription(type)}`,
      );

      return {
        success: false,
        error: errorMessage,
        errorCode: "EXECUTION_ERROR",
      };
    }
  }

  /**
   * 构建确认请求
   */
  private buildConfirmation(
    type: AIActionType,
    params: Record<string, unknown>,
  ): AIActionResult {
    const actionDesc = getDescription(type);
    let affectedCount = 1;
    const actions: string[] = [actionDesc];

    // 计算影响数量
    if ("bookmarkIds" in params && Array.isArray(params.bookmarkIds)) {
      affectedCount = params.bookmarkIds.length;
    }
    if ("tags" in params && Array.isArray(params.tags)) {
      actions.push(`涉及 ${params.tags.length} 个标签`);
    }

    return {
      success: false,
      needsConfirmation: true,
      confirmation: {
        message: `确认执行「${actionDesc}」操作？`,
        actions,
        affectedCount,
        reversible: !type.includes("delete"),
      },
    };
  }

  /**
   * 执行具体操作（路由到对应处理器）
   */
  private async executeAction(
    type: AIActionType,
    params: Record<string, unknown>,
  ): Promise<AIActionResult> {
    const { supabase } = this;
    const { userId } = this.context;

    switch (type) {
      // ========== 书签操作 ==========
      case "bookmark:search":
        return bookmarkSearch(supabase, userId, params);
      case "bookmark:get":
        return bookmarkGet(supabase, userId, params);
      case "bookmark:list":
        return bookmarkList(supabase, userId, params);
      case "bookmark:related":
        return bookmarkRelated(supabase, userId, params);
      case "bookmark:create":
        return bookmarkCreate(supabase, userId, params);
      case "bookmark:update":
        return bookmarkUpdate(supabase, userId, params);
      case "bookmark:move":
        return bookmarkMove(supabase, userId, params);
      case "bookmark:delete":
        return bookmarkDelete(supabase, userId, params);
      case "bookmark:rate":
        return bookmarkRate(supabase, userId, params);

      // ========== 文件夹操作 ==========
      case "folder:list":
        return folderList(supabase, userId, params);
      case "folder:get":
        return folderGet(supabase, userId, params);
      case "folder:bookmarks":
        return folderBookmarks(supabase, userId, params);
      case "folder:create":
        return folderCreate(supabase, userId, params);
      case "folder:update":
        return folderUpdate(supabase, userId, params);
      case "folder:delete":
        return folderDelete(supabase, userId, params);

      // ========== 标签操作 ==========
      case "tag:list":
        return tagList(supabase, userId, params);
      case "tag:bookmarks":
        return tagBookmarks(supabase, userId, params);
      case "tag:add":
        return tagAdd(supabase, userId, params);
      case "tag:remove":
        return tagRemove(supabase, userId, params);
      case "tag:batch_add":
        return tagBatchAdd(supabase, userId, params);
      case "tag:batch_remove":
        return tagBatchRemove(supabase, userId, params);

      // ========== 用户操作 ==========
      case "user:preferences":
        return userPreferences(supabase, userId);
      case "user:stats":
        return userStats(supabase, userId, params);

      default:
        return {
          success: false,
          error: `Unknown action type: ${type}`,
          errorCode: "UNKNOWN_ACTION",
        };
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 快捷执行 AI Action
 */
export async function executeAIAction<T extends AIActionType>(
  context: AIActionContext,
  request: AIActionRequest<T>,
): Promise<AIActionResult> {
  const executor = await AIActionExecutor.create(context);
  return executor.execute(request);
}
