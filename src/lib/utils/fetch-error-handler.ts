/**
 * Fetch Error Handler
 * 统一的内容提取错误处理模块
 *
 * @version 1.0.0
 * @since 2025-12-06
 */

import { logger } from "@/lib/logger";

/**
 * 错误上下文类型
 */
export type FetchErrorContext = "jina_reader" | "smart_fetch" | "native_fetch";

/**
 * 错误处理结果
 */
export interface FetchErrorResult {
  /** 错误消息 */
  message: string;
  /** 是否为超时错误 */
  isTimeout: boolean;
  /** 是否为网络错误 */
  isNetworkError: boolean;
  /** 是否为中止错误 */
  isAborted: boolean;
  /** HTTP 状态码（如果有） */
  httpStatus?: number;
}

/**
 * 提取错误消息
 *
 * 统一从各种错误类型中提取可读的错误消息
 *
 * @param error - 捕获的错误
 * @returns 可读的错误消息
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
 * 解析 fetch 错误
 *
 * 分析错误类型，提供更详细的错误信息
 *
 * @param error - 捕获的错误
 * @returns 解析后的错误结果
 */
export function parseFetchError(error: unknown): FetchErrorResult {
  const message = extractErrorMessage(error);
  const lowerMessage = message.toLowerCase();

  // 检测超时
  const isTimeout =
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("timed out") ||
    (error instanceof Error && error.name === "TimeoutError");

  // 检测中止
  const isAborted =
    lowerMessage.includes("aborted") ||
    (error instanceof Error && error.name === "AbortError");

  // 检测网络错误
  const isNetworkError =
    lowerMessage.includes("network") ||
    lowerMessage.includes("fetch failed") ||
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("enotfound") ||
    lowerMessage.includes("dns");

  // 提取 HTTP 状态码
  let httpStatus: number | undefined;
  const httpMatch = message.match(/http[s]?\s*(\d{3})/i);
  if (httpMatch) {
    httpStatus = parseInt(httpMatch[1], 10);
  }

  return {
    message,
    isTimeout,
    isAborted,
    isNetworkError,
    httpStatus,
  };
}

/**
 * 记录 fetch 错误日志
 *
 * 统一的错误日志格式
 *
 * @param context - 错误上下文
 * @param url - 请求的 URL
 * @param error - 捕获的错误
 * @param additionalData - 附加数据
 */
export function logFetchError(
  context: FetchErrorContext,
  url: string,
  error: unknown,
  additionalData?: Record<string, unknown>,
): FetchErrorResult {
  const parsed = parseFetchError(error);

  const logData = {
    url,
    error: parsed.message,
    isTimeout: parsed.isTimeout,
    isNetworkError: parsed.isNetworkError,
    isAborted: parsed.isAborted,
    httpStatus: parsed.httpStatus,
    action: `${context}_failed`,
    ...additionalData,
  };

  // 超时和中止使用 warn，其他错误使用 error
  if (parsed.isTimeout || parsed.isAborted) {
    logger.warn(logData, `${formatContextName(context)}: Request failed`);
  } else {
    logger.error(logData, `${formatContextName(context)}: Request failed`);
  }

  return parsed;
}

/**
 * 格式化上下文名称
 */
function formatContextName(context: FetchErrorContext): string {
  switch (context) {
    case "jina_reader":
      return "Jina Reader";
    case "smart_fetch":
      return "Smart Content Fetcher";
    case "native_fetch":
      return "Native Fetch";
    default:
      return context;
  }
}

/**
 * 创建失败结果的工厂函数
 *
 * 简化创建统一的失败返回结果
 */
export function createFetchFailureResult<T extends { error?: string }>(
  base: Omit<T, "error">,
  error: unknown,
): T {
  return {
    ...base,
    error: extractErrorMessage(error),
  } as T;
}
