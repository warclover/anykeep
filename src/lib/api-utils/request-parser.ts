/**
 * API 请求解析工具
 *
 * 提供安全的请求体解析和参数验证
 *
 * @version 1.0.0
 * @since 2026-02-05
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * 解析 JSON 请求体（带错误处理）
 *
 * @param request - Next.js Request 对象
 * @param maxSize - 最大请求体大小（字节），默认 10MB
 * @returns 解析后的 JSON 数据
 * @throws {Error} 如果解析失败
 */
export async function safeJsonParse<T = unknown>(
  request: Request,
  maxSize = 10 * 1024 * 1024, // 10MB
): Promise<T> {
  // 检查 Content-Type
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    throw new Error("请求必须是 JSON 格式");
  }

  // 检查 Content-Length
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const length = Number.parseInt(contentLength, 10);
    if (length > maxSize) {
      throw new Error(`请求体过大，最大允许 ${maxSize} 字节`);
    }
  }

  try {
    return (await request.json()) as T;
  } catch (error) {
    logger.error({ error }, "Failed to parse JSON request body");
    throw new Error("无效的 JSON 格式");
  }
}

/**
 * 返回 JSON 解析错误的响应
 *
 * @param error - 错误对象
 * @returns NextResponse 错误响应
 */
export function jsonParseErrorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "无效的 JSON 格式";

  return NextResponse.json(
    { error: message, code: "INVALID_JSON" },
    { status: 400 },
  );
}

/**
 * 安全解析整数参数
 *
 * @param value - 字符串值
 * @param paramName - 参数名称（用于错误消息）
 * @param min - 最小值（可选）
 * @param max - 最大值（可选）
 * @returns 解析后的整数值
 * @throws {Error} 如果解析失败或超出范围
 */
export function safeParseInt(
  value: string | undefined,
  paramName: string,
  min?: number,
  max?: number,
): number {
  if (value === undefined || value === null || value === "") {
    throw new Error(`参数 ${paramName} 不能为空`);
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`参数 ${paramName} 必须是有效的整数`);
  }

  if (min !== undefined && parsed < min) {
    throw new Error(`参数 ${paramName} 不能小于 ${min}`);
  }

  if (max !== undefined && parsed > max) {
    throw new Error(`参数 ${paramName} 不能大于 ${max}`);
  }

  return parsed;
}

/**
 * 验证书签 ID 数组
 *
 * @param ids - ID 数组
 * @returns 验证通过后的数组
 * @throws {Error} 如果验证失败
 */
export function validateBookmarkIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) {
    throw new Error("bookmarkIds 必须是数组");
  }

  const result: number[] = [];

  for (const id of ids) {
    const numId = typeof id === "string" ? Number.parseInt(id, 10) : id;
    if (typeof numId !== "number" || Number.isNaN(numId) || numId <= 0) {
      throw new Error(`无效的书签 ID: ${id}`);
    }
    result.push(numId);
  }

  if (result.length === 0) {
    throw new Error("bookmarkIds 不能为空");
  }

  if (result.length > 1000) {
    throw new Error("单次操作最多支持 1000 个书签");
  }

  return result;
}
