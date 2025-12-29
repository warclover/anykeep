/**
 * Brain-Sync Active Recall 错误处理模块
 *
 * 提供统一的错误码、错误消息和错误处理工具函数
 *
 * @module tools/active-recall/errors
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { ToolErrorResult } from "../types";
import { logger } from "@/lib/logger";

// ============================================
// 错误码定义
// ============================================

/**
 * Brain-Sync 错误码枚举
 */
export const BrainSyncErrorCodes = {
  // 数据库相关
  DB_ERROR: "DB_ERROR",
  DB_CONNECTION_FAILED: "DB_CONNECTION_FAILED",
  DB_QUERY_TIMEOUT: "DB_QUERY_TIMEOUT",

  // 资源相关
  NOT_FOUND: "NOT_FOUND",
  BOOKMARK_NOT_FOUND: "BOOKMARK_NOT_FOUND",
  FLASHCARD_NOT_FOUND: "FLASHCARD_NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",

  // 内容相关
  INSUFFICIENT_CONTENT: "INSUFFICIENT_CONTENT",
  CONTENT_TOO_SHORT: "CONTENT_TOO_SHORT",
  CONTENT_INVALID: "CONTENT_INVALID",

  // AI 生成相关
  GENERATION_FAILED: "GENERATION_FAILED",
  AI_SERVICE_UNAVAILABLE: "AI_SERVICE_UNAVAILABLE",
  AI_RATE_LIMITED: "AI_RATE_LIMITED",
  QUALITY_CHECK_FAILED: "QUALITY_CHECK_FAILED",

  // 验证相关
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_PARAMS: "INVALID_PARAMS",

  // 业务逻辑相关
  ALREADY_EXISTS: "ALREADY_EXISTS",
  LIMIT_EXCEEDED: "LIMIT_EXCEEDED",
  FEATURE_DISABLED: "FEATURE_DISABLED",

  // 通用错误
  EXECUTION_ERROR: "EXECUTION_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type BrainSyncErrorCode =
  (typeof BrainSyncErrorCodes)[keyof typeof BrainSyncErrorCodes];

// ============================================
// 错误消息模板
// ============================================

/**
 * 用户友好的错误消息模板
 */
const ERROR_MESSAGES: Record<BrainSyncErrorCode, string> = {
  [BrainSyncErrorCodes.DB_ERROR]: "数据库操作失败，请稍后重试",
  [BrainSyncErrorCodes.DB_CONNECTION_FAILED]: "无法连接数据库，请检查网络连接",
  [BrainSyncErrorCodes.DB_QUERY_TIMEOUT]: "数据库查询超时，请稍后重试",

  [BrainSyncErrorCodes.NOT_FOUND]: "请求的资源不存在",
  [BrainSyncErrorCodes.BOOKMARK_NOT_FOUND]: "书签不存在或无权访问",
  [BrainSyncErrorCodes.FLASHCARD_NOT_FOUND]: "复习卡片不存在或无权访问",
  [BrainSyncErrorCodes.UNAUTHORIZED]: "无权限执行此操作",

  [BrainSyncErrorCodes.INSUFFICIENT_CONTENT]: "内容不足，无法生成复习卡片",
  [BrainSyncErrorCodes.CONTENT_TOO_SHORT]: "内容过短，至少需要 50 个字符",
  [BrainSyncErrorCodes.CONTENT_INVALID]: "内容格式无效",

  [BrainSyncErrorCodes.GENERATION_FAILED]: "AI 生成失败，请稍后重试",
  [BrainSyncErrorCodes.AI_SERVICE_UNAVAILABLE]: "AI 服务暂时不可用",
  [BrainSyncErrorCodes.AI_RATE_LIMITED]: "AI 请求过于频繁，请稍后重试",
  [BrainSyncErrorCodes.QUALITY_CHECK_FAILED]: "生成内容未通过质量检查",

  [BrainSyncErrorCodes.VALIDATION_ERROR]: "参数验证失败",
  [BrainSyncErrorCodes.INVALID_PARAMS]: "无效的参数",

  [BrainSyncErrorCodes.ALREADY_EXISTS]: "资源已存在",
  [BrainSyncErrorCodes.LIMIT_EXCEEDED]: "已达到使用限制",
  [BrainSyncErrorCodes.FEATURE_DISABLED]: "此功能已禁用",

  [BrainSyncErrorCodes.EXECUTION_ERROR]: "执行过程中发生错误",
  [BrainSyncErrorCodes.UNKNOWN_ERROR]: "发生未知错误，请联系支持",
};

// ============================================
// 错误处理工具函数
// ============================================

/**
 * 错误处理上下文
 */
interface ErrorContext {
  toolName: string;
  userId: string;
  params?: Record<string, unknown>;
  traceId?: string;
}

/**
 * 创建标准化的错误结果
 *
 * @param errorCode - 错误码
 * @param context - 错误上下文
 * @param details - 额外详情（可选，用于日志记录）
 */
export function createErrorResult(
  errorCode: BrainSyncErrorCode,
  context: ErrorContext,
  details?: string,
): ToolErrorResult {
  const userMessage = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.UNKNOWN_ERROR;

  // 记录错误日志
  logger.error(
    {
      errorCode,
      toolName: context.toolName,
      userId: context.userId,
      params: context.params,
      traceId: context.traceId,
      details,
    },
    `${context.toolName}: ${errorCode}`,
  );

  return {
    success: false,
    error: userMessage,
    errorCode,
  };
}

/**
 * 从 Supabase 错误推断错误码
 */
export function inferErrorCodeFromSupabaseError(error: {
  message?: string;
  code?: string;
}): BrainSyncErrorCode {
  const message = error.message?.toLowerCase() || "";
  const code = error.code?.toLowerCase() || "";

  // 连接错误
  if (message.includes("connection") || code.includes("connection")) {
    return BrainSyncErrorCodes.DB_CONNECTION_FAILED;
  }

  // 超时错误
  if (message.includes("timeout") || code.includes("timeout")) {
    return BrainSyncErrorCodes.DB_QUERY_TIMEOUT;
  }

  // 权限错误
  if (message.includes("not found") || message.includes("does not exist")) {
    return BrainSyncErrorCodes.NOT_FOUND;
  }

  if (message.includes("unauthorized") || message.includes("permission")) {
    return BrainSyncErrorCodes.UNAUTHORIZED;
  }

  // 默认数据库错误
  return BrainSyncErrorCodes.DB_ERROR;
}

/**
 * 从通用异常推断错误码
 */
export function inferErrorCodeFromException(
  error: unknown,
): BrainSyncErrorCode {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // AI 相关错误
    if (message.includes("rate limit") || message.includes("429")) {
      return BrainSyncErrorCodes.AI_RATE_LIMITED;
    }

    if (message.includes("service unavailable") || message.includes("503")) {
      return BrainSyncErrorCodes.AI_SERVICE_UNAVAILABLE;
    }

    // 验证错误
    if (message.includes("validation") || message.includes("invalid")) {
      return BrainSyncErrorCodes.VALIDATION_ERROR;
    }
  }

  return BrainSyncErrorCodes.EXECUTION_ERROR;
}

/**
 * 安全地提取错误消息
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error";
}

/**
 * 包装异步执行并处理错误
 *
 * @param fn - 异步执行函数
 * @param context - 错误上下文
 * @returns Tool 执行结果
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: ErrorContext,
): Promise<T | ToolErrorResult> {
  try {
    return await fn();
  } catch (error) {
    const errorCode = inferErrorCodeFromException(error);
    return createErrorResult(errorCode, context, extractErrorMessage(error));
  }
}
