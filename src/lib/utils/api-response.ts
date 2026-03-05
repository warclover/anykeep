/**
 * API 响应工具函数
 * 统一 API 响应格式和错误处理
 */

import type { ZodError } from "zod";
import { NextResponse } from "next/server";
import { AUTH, STORAGE } from "@/lib/constants/messages";

/**
 * 标准 API 响应格式
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * API 错误代码
 */
export const API_ERROR_CODES = {
  // 认证错误 (401)
  UNAUTHORIZED: "UNAUTHORIZED",
  // 权限错误 (403)
  FORBIDDEN: "FORBIDDEN",
  // 资源不存在 (404)
  NOT_FOUND: "NOT_FOUND",
  // 请求错误 (400)
  BAD_REQUEST: "BAD_REQUEST",
  // 输入验证错误 (400)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  // 配额超限 (429)
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  // 服务器错误 (500)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  // 数据库错误 (500)
  DATABASE_ERROR: "DATABASE_ERROR",
} as const;

/**
 * 创建成功响应
 */
export function successResponse<T>(
  data: T,
  status = 200,
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status },
  );
}

/**
 * 创建错误响应
 */
export function errorResponse(
  code: string,
  message: string,
  status = 500,
  details?: unknown,
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
    },
    { status },
  );
}

/**
 * 处理 Zod 验证错误
 * 使用可序列化的 details，避免 JSON 后客户端拿到空 error 对象
 */
export function handleValidationError(
  error: ZodError,
): NextResponse<ApiResponse> {
  const firstError = error.issues[0];
  const message =
    typeof firstError?.message === "string" && firstError.message
      ? firstError.message
      : error.issues.map((i) => i.message).join("；") || "校验失败";
  const details = error.issues.map((i) => ({
    path: i.path,
    message: i.message,
  }));
  return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, message, 400, details);
}

/**
 * 处理认证错误
 */
export function unauthorizedError(
  message = AUTH.LOGIN_REQUIRED,
): NextResponse<ApiResponse> {
  return errorResponse(API_ERROR_CODES.UNAUTHORIZED, message, 401);
}

/**
 * 处理权限错误
 */
export function forbiddenError(
  message: string = AUTH.FORBIDDEN,
): NextResponse<ApiResponse> {
  return errorResponse(API_ERROR_CODES.FORBIDDEN, message, 403);
}

/**
 * 处理资源不存在错误
 */
export function notFoundError(
  message = "资源不存在",
): NextResponse<ApiResponse> {
  return errorResponse(API_ERROR_CODES.NOT_FOUND, message, 404);
}

/**
 * 处理请求错误
 */
export function badRequestError(
  message = "请求参数错误",
): NextResponse<ApiResponse> {
  return errorResponse(API_ERROR_CODES.BAD_REQUEST, message, 400);
}

/**
 * 处理配额超限错误
 */
export function quotaExceededError(
  message: string = STORAGE.QUOTA_EXCEEDED,
): NextResponse<ApiResponse> {
  return errorResponse(API_ERROR_CODES.QUOTA_EXCEEDED, message, 429);
}

/**
 * 处理数据库错误
 */
export function databaseError(
  message = "数据库操作失败",
  details?: unknown,
): NextResponse<ApiResponse> {
  return errorResponse(API_ERROR_CODES.DATABASE_ERROR, message, 500, details);
}

/**
 * 处理内部服务器错误
 */
export function internalError(
  message = "服务器内部错误",
  details?: unknown,
): NextResponse<ApiResponse> {
  return errorResponse(API_ERROR_CODES.INTERNAL_ERROR, message, 500, details);
}

/**
 * 安全解析请求体 JSON
 * 如果解析失败，返回 null
 */
export async function safeParseJson<T = unknown>(
  request: Request,
): Promise<{ data: T; error: null } | { data: null; error: string }> {
  try {
    const data = (await request.json()) as T;
    return { data, error: null };
  } catch {
    return { data: null, error: "请求体格式错误，请提供有效的 JSON" };
  }
}

/**
 * 安全解析整数
 * 如果解析失败，返回 null
 */
export function safeParseInt(
  value: string | null | undefined,
  defaultValue?: number,
): number | null {
  if (value === null || value === undefined) {
    return defaultValue ?? null;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    return defaultValue ?? null;
  }
  return parsed;
}
