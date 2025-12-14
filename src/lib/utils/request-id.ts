/**
 * Request ID Utilities
 *
 * 提供请求追踪 ID 的获取和生成功能
 * 用于 API 路由日志关联和错误追踪
 *
 * @version 1.0.0
 * @since 2025-12-14
 */

import { headers } from "next/headers";

/**
 * 请求 ID Header 名称
 */
export const REQUEST_ID_HEADER = "x-request-id";

/**
 * 生成请求追踪 ID
 * 格式: req_${timestamp}_${random}
 *
 * @returns 唯一的请求 ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${random}`;
}

/**
 * 从 Next.js Server Component/API Route 获取请求 ID
 *
 * @returns 请求 ID 或 undefined
 *
 * @example
 * ```typescript
 * // In API Route or Server Component
 * const requestId = await getRequestId();
 * logger.info({ requestId }, 'Processing request');
 * ```
 */
export async function getRequestId(): Promise<string | undefined> {
  try {
    const headersList = await headers();
    return headersList.get(REQUEST_ID_HEADER) || undefined;
  } catch {
    // headers() may throw outside of request context
    return undefined;
  }
}

/**
 * 从 Request 对象获取请求 ID
 *
 * @param request - Request 对象
 * @returns 请求 ID 或生成的新 ID
 *
 * @example
 * ```typescript
 * // In API Route handler
 * export async function GET(request: Request) {
 *   const requestId = getRequestIdFromRequest(request);
 *   // ...
 * }
 * ```
 */
export function getRequestIdFromRequest(request: Request): string {
  return request.headers.get(REQUEST_ID_HEADER) || generateRequestId();
}

/**
 * 创建带 Request ID 的日志上下文
 *
 * @param requestId - 请求 ID
 * @param context - 额外的上下文信息
 * @returns 合并的上下文对象
 *
 * @example
 * ```typescript
 * const ctx = createLogContext(requestId, { userId: user.id });
 * logger.info(ctx, 'User action');
 * ```
 */
export function createLogContext(
  requestId: string | undefined,
  context: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...context,
    ...(requestId && { requestId }),
  };
}
