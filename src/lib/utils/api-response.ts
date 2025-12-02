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
 */
export function handleValidationError(
  error: ZodError,
): NextResponse<ApiResponse> {
  const firstError = error.issues[0];
  return errorResponse(
    API_ERROR_CODES.VALIDATION_ERROR,
    firstError.message,
    400,
    error.issues,
  );
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
