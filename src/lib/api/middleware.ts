/**
 * API Route Middleware
 *
 * 统一的 API Route 中间件，整合认证和错误处理
 *
 * @module lib/api/middleware
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { z } from "zod";
import { ZodError } from "zod";
import type { AuthResult } from "./auth-middleware";
import { withAuth as getAuth } from "./auth-middleware";
import { ServiceError, SERVICE_ERROR_HTTP_STATUS } from "@/services/core";
import { createLogger } from "@/lib/logger";
import { API_ERROR_CODES } from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";

const logger = createLogger("api-middleware");

/**
 * 认证上下文
 */
export interface AuthContext {
  user: User | null;
  userId: string;
  authResult: AuthResult;
}

/**
 * Route Context with params
 */
export interface RouteContext<TParams = Record<string, string>> {
  params: Promise<TParams>;
}

/**
 * 认证处理函数类型
 */
export type AuthenticatedHandler<TParams = Record<string, string>> = (
  request: NextRequest,
  context: AuthContext & RouteContext<TParams>,
) => Promise<NextResponse | Response>;

/**
 * 获取完整 User 对象
 *
 * 用于极少数需要完整 Supabase User 的场景（如包含 refresh token 等信息）。
 * 大多数路由应直接使用 AuthContext 中的 user（已在 JWT 快速路径构造简化 User）。
 *
 * @param userId - 当前认证用户 ID
 * @throws ServiceError 如果无法获取用户
 *
 * @example
 * export const DELETE = withAuthMiddleware(async (request, { userId }) => {
 *   const fullUser = await ensureFullUser(userId);
 *   // 使用 fullUser 的完整属性...
 * });
 */
export async function ensureFullUser(_userId: string): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new ServiceError("UNAUTHORIZED", "Cannot retrieve user");
  }
  return user;
}

/**
 * 认证中间件
 *
 * 包装 API 处理函数，提供认证和错误处理
 *
 * @example
 * export const GET = withAuthMiddleware(async (request, { userId, params }) => {
 *   const { id } = await params;
 *   const bookmark = await bookmarkService.getById(parseInt(id));
 *   return NextResponse.json(bookmark);
 * });
 */
export function withAuthMiddleware<TParams = Record<string, string>>(
  handler: AuthenticatedHandler<TParams>,
) {
  return async (
    request: NextRequest,
    context?: RouteContext<TParams>,
  ): Promise<NextResponse | Response> => {
    const startTime = Date.now();
    const method = request.method;
    const url = request.url;

    try {
      // 获取认证信息
      const authResult = await getAuth(request);
      const authDuration = authResult.duration ?? 0;
      if (authDuration > 500) {
        logger.warn(
          {
            method,
            url,
            authDuration: Math.round(authDuration),
            authMethod: authResult.method,
          },
          "Slow API auth - consider Middleware x-user-id or JWT fast path",
        );
      }

      if (authResult.error || !authResult.userId) {
        logger.warn(
          { method, url, error: authResult.error?.message },
          "Authentication failed",
        );

        return NextResponse.json(
          {
            success: false,
            error: {
              code: API_ERROR_CODES.UNAUTHORIZED,
              message: "Authentication required",
            },
          },
          { status: 401 },
        );
      }

      // 执行处理函数
      const handlerStart = Date.now();
      const response = await handler(request, {
        user: authResult.user,
        userId: authResult.userId,
        authResult,
        params: context?.params ?? Promise.resolve({} as TParams),
      });

      // 记录请求完成（总耗时 + 业务逻辑耗时，便于区分鉴权 vs 业务）
      const duration = Date.now() - startTime;
      const handlerDuration = Date.now() - handlerStart;
      if (duration > 1000) {
        logger.warn(
          {
            method,
            url,
            duration,
            authDuration: Math.round(authDuration),
            handlerDuration,
          },
          "Slow API request",
        );
      }

      return response;
    } catch (error) {
      return handleError(error, { method, url, startTime });
    }
  };
}

/**
 * 错误处理中间件
 *
 * 独立的错误处理包装器（不包含认证）
 *
 * @example
 * export const GET = withErrorHandler(async (request) => {
 *   // 公开 API，无需认证
 *   return NextResponse.json({ status: "ok" });
 * });
 */
export function withErrorHandler<
  T extends (...args: unknown[]) => Promise<NextResponse>,
>(handler: T): T {
  const wrapped = async (...args: Parameters<T>): Promise<NextResponse> => {
    const request = args[0] as NextRequest;
    const startTime = Date.now();
    const method = request.method;
    const url = request.url;

    try {
      return await handler(...args);
    } catch (error) {
      return handleError(error, { method, url, startTime });
    }
  };

  return wrapped as T;
}

/**
 * 请求体大小限制配置
 */
export const BODY_SIZE_LIMITS = {
  /** 默认最大请求体大小（1MB） */
  DEFAULT: 1 * 1024 * 1024,
  /** 批量操作最大请求体大小（5MB） */
  BATCH: 5 * 1024 * 1024,
  /** 大文件上传最大请求体大小（10MB） */
  LARGE: 10 * 1024 * 1024,
} as const;

/**
 * 请求体过大错误
 */
export class PayloadTooLargeError extends Error {
  readonly statusCode = 413;
  constructor(
    public readonly actualSize: number,
    public readonly maxSize: number,
  ) {
    super(
      `Request body too large: ${Math.round(actualSize / 1024)}KB exceeds limit of ${Math.round(maxSize / 1024)}KB`,
    );
    this.name = "PayloadTooLargeError";
  }
}

/**
 * 请求体验证选项
 */
export interface ValidateBodyOptions {
  /** 最大请求体大小（字节），默认 1MB */
  maxSize?: number;
}

/**
 * 请求体验证中间件
 *
 * 验证并解析请求体，包含大小限制检查
 *
 * @example
 * export const POST = withAuthMiddleware(async (request, { userId }) => {
 *   const body = await validateBody(request, CreateBookmarkSchema);
 *   // body 已验证并类型安全
 * });
 *
 * @example
 * // 批量操作允许更大请求体
 * const body = await validateBody(request, BatchSchema, { maxSize: BODY_SIZE_LIMITS.BATCH });
 */
export async function validateBody<T extends z.ZodSchema>(
  request: NextRequest,
  schema: T,
  options?: ValidateBodyOptions,
): Promise<z.infer<T>> {
  const maxSize = options?.maxSize ?? BODY_SIZE_LIMITS.DEFAULT;

  // 检查 Content-Length 头
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > maxSize) {
      throw new PayloadTooLargeError(size, maxSize);
    }
  }

  // 解析 JSON 并检查实际大小
  const text = await request.text();
  if (text.length > maxSize) {
    throw new PayloadTooLargeError(text.length, maxSize);
  }

  const body = JSON.parse(text);
  return schema.parse(body);
}

/**
 * 查询参数验证
 *
 * @example
 * const query = validateQuery(request, BookmarkQuerySchema);
 */
export function validateQuery<T extends z.ZodSchema>(
  request: NextRequest,
  schema: T,
): z.infer<T> {
  const searchParams = request.nextUrl.searchParams;
  const query: Record<string, string> = {};

  searchParams.forEach((value, key) => {
    query[key] = value;
  });

  return schema.parse(query);
}

/**
 * 统一错误处理
 */
function handleError(
  error: unknown,
  context: { method: string; url: string; startTime: number },
): NextResponse {
  const duration = Date.now() - context.startTime;

  // 处理请求体过大错误
  if (error instanceof PayloadTooLargeError) {
    logger.warn(
      {
        method: context.method,
        url: context.url,
        duration,
        actualSize: error.actualSize,
        maxSize: error.maxSize,
      },
      "Payload too large",
    );

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: error.message,
        },
      },
      { status: 413 },
    );
  }

  // 处理 ServiceError
  if (error instanceof ServiceError) {
    logger.warn(
      {
        method: context.method,
        url: context.url,
        duration,
        code: error.code,
        message: error.message,
      },
      "Service error",
    );

    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: SERVICE_ERROR_HTTP_STATUS[error.code] || 500 },
    );
  }

  // 处理 Zod 验证错误
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];

    logger.warn(
      {
        method: context.method,
        url: context.url,
        duration,
        issues: error.issues,
      },
      "Validation error",
    );

    return NextResponse.json(
      {
        success: false,
        error: {
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: firstIssue.message,
          details: error.issues,
        },
      },
      { status: 400 },
    );
  }

  // 处理通用错误
  const message = error instanceof Error ? error.message : "Unknown error";

  logger.error(
    {
      method: context.method,
      url: context.url,
      duration,
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    },
    "Unhandled API error",
  );

  return NextResponse.json(
    {
      success: false,
      error: {
        code: API_ERROR_CODES.INTERNAL_ERROR,
        message:
          process.env.NODE_ENV === "development"
            ? message
            : "Internal server error",
      },
    },
    { status: 500 },
  );
}

/**
 * 速率限制选项
 */
export interface RateLimitOptions {
  /** 时间窗口（毫秒） */
  windowMs: number;
  /** 最大请求数 */
  max: number;
  /** 自定义 key 生成器 */
  keyGenerator?: (request: NextRequest) => string;
}

/**
 * 速率限制存储配置
 */
const RATE_LIMIT_CONFIG = {
  /** 最大存储条目数 */
  MAX_ENTRIES: 10000,
  /** 清理间隔（毫秒），默认 5 分钟 */
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000,
  /** 每次清理的最大条目数（避免阻塞） */
  CLEANUP_BATCH_SIZE: 1000,
} as const;

/**
 * 速率限制记录
 */
interface RateLimitRecord {
  count: number;
  resetAt: number;
  /** 最后访问时间（用于 LRU 淘汰） */
  lastAccess: number;
}

/**
 * 速率限制存储类
 *
 * 支持：
 * - 周期性清理过期条目
 * - 最大容量限制（LRU 淘汰）
 * - 线程安全的惰性初始化
 */
class RateLimitStore {
  private store = new Map<string, RateLimitRecord>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private lastCleanup = Date.now();

  constructor() {
    // 启动周期性清理
    this.startCleanupTimer();
  }

  /**
   * 获取记录
   */
  get(key: string): RateLimitRecord | undefined {
    const record = this.store.get(key);
    if (record) {
      record.lastAccess = Date.now();
    }
    return record;
  }

  /**
   * 设置记录
   */
  set(key: string, record: Omit<RateLimitRecord, "lastAccess">): void {
    // 检查容量限制
    if (this.store.size >= RATE_LIMIT_CONFIG.MAX_ENTRIES) {
      this.evictLRU();
    }

    this.store.set(key, {
      ...record,
      lastAccess: Date.now(),
    });
  }

  /**
   * 删除记录
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * 获取存储大小（用于监控）
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * 启动周期性清理定时器
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, RATE_LIMIT_CONFIG.CLEANUP_INTERVAL_MS);

    // 确保进程退出时清理定时器（Node.js 环境）
    if (typeof process !== "undefined" && process.on) {
      process.on("beforeExit", () => this.stopCleanupTimer());
    }
  }

  /**
   * 停止清理定时器
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 清理过期条目
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    let processed = 0;

    for (const [key, record] of this.store) {
      if (processed >= RATE_LIMIT_CONFIG.CLEANUP_BATCH_SIZE) {
        // 避免长时间阻塞，下次继续清理
        break;
      }

      if (record.resetAt <= now) {
        this.store.delete(key);
        cleaned++;
      }
      processed++;
    }

    this.lastCleanup = now;

    if (cleaned > 0) {
      logger.debug(
        { cleaned, remaining: this.store.size },
        "Rate limit store cleanup completed",
      );
    }

    return cleaned;
  }

  /**
   * LRU 淘汰策略
   * 淘汰最久未访问的 10% 条目
   */
  private evictLRU(): void {
    const entries = Array.from(this.store.entries());

    // 按最后访问时间排序
    entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    // 淘汰最久未访问的 10%
    const evictCount = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < evictCount; i++) {
      this.store.delete(entries[i][0]);
    }

    logger.debug(
      { evicted: evictCount, remaining: this.store.size },
      "Rate limit store LRU eviction completed",
    );
  }

  /**
   * 手动触发清理（用于测试）
   */
  forceCleanup(): number {
    return this.cleanup();
  }

  /**
   * 清空存储（用于测试）
   */
  clear(): void {
    this.store.clear();
  }
}

/**
 * 速率限制存储实例
 *
 * 注意：这是一个简化实现，生产环境大规模部署建议使用 Redis
 */
const rateLimitStore = new RateLimitStore();

// 导出用于测试和监控
export { rateLimitStore, RATE_LIMIT_CONFIG };

/**
 * 速率限制中间件
 *
 * @example
 * export const POST = withRateLimit({ windowMs: 60000, max: 10 })(
 *   withAuthMiddleware(async (request, { userId }) => {
 *     // 处理请求
 *   })
 * );
 */
export function withRateLimit(options: RateLimitOptions) {
  const { windowMs, max, keyGenerator } = options;

  return function <T extends (...args: unknown[]) => Promise<NextResponse>>(
    handler: T,
  ): T {
    const wrapped = async (...args: Parameters<T>): Promise<NextResponse> => {
      const request = args[0] as NextRequest;

      // 生成限制 key
      const key = keyGenerator
        ? keyGenerator(request)
        : request.headers.get("x-forwarded-for") || "anonymous";

      const now = Date.now();
      const record = rateLimitStore.get(key);

      // 清理过期记录（惰性清理）
      if (record && record.resetAt <= now) {
        rateLimitStore.delete(key);
      }

      const current = rateLimitStore.get(key);

      if (current) {
        if (current.count >= max) {
          const retryAfter = Math.ceil((current.resetAt - now) / 1000);

          return NextResponse.json(
            {
              success: false,
              error: {
                code: "RATE_LIMITED",
                message: "Too many requests, please try again later",
              },
            },
            {
              status: 429,
              headers: {
                "Retry-After": String(retryAfter),
                "X-RateLimit-Limit": String(max),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": String(Math.ceil(current.resetAt / 1000)),
              },
            },
          );
        }

        current.count++;
      } else {
        rateLimitStore.set(key, {
          count: 1,
          resetAt: now + windowMs,
        });
      }

      return handler(...args);
    };

    return wrapped as T;
  };
}
