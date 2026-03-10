/**
 * API 路由测试通用工具模块
 *
 * 提供统一的 mock 工厂和断言工具，减少 API 路由测试的样板代码。
 *
 * @module @/app/api/__test-utils__/api-test-helpers
 * @version 1.0.0
 * @since 2026-03-08
 */

import { NextRequest, NextResponse } from "next/server";
import type { RequestInit as NextRequestInit } from "next/dist/server/web/spec-extension/request";

// =============================================================================
// Types
// =============================================================================

export interface MockAuthState {
  userId: string | null;
  email: string;
  error: Error | null;
}

export interface MockSupabaseQuery {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  upsert: jest.Mock;
  eq: jest.Mock;
  neq: jest.Mock;
  gt: jest.Mock;
  gte: jest.Mock;
  lt: jest.Mock;
  lte: jest.Mock;
  in: jest.Mock;
  is: jest.Mock;
  not: jest.Mock;
  or: jest.Mock;
  ilike: jest.Mock;
  contains: jest.Mock;
  order: jest.Mock;
  range: jest.Mock;
  limit: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
  [key: string]: jest.Mock;
}

// =============================================================================
// Auth Mock 工厂
// =============================================================================

const DEFAULT_USER_ID = "test-user-id-123";
const DEFAULT_EMAIL = "test@example.com";

/**
 * 创建 withAuthMiddleware 的 mock 工厂函数。
 *
 * 返回一个函数对象，包含 mock 实现和认证状态控制方法。
 *
 * @example
 * ```typescript
 * const authMock = createAuthMock();
 * jest.mock("@/lib/api/middleware", () => ({
 *   withAuthMiddleware: authMock.middleware,
 * }));
 *
 * // 在测试中切换认证状态
 * authMock.setAuthenticated();       // 已认证
 * authMock.setUnauthenticated();     // 未认证
 * authMock.setUserId("custom-id");   // 自定义用户
 * ```
 */
export function createAuthMock(defaultUserId = DEFAULT_USER_ID) {
  const state: MockAuthState = {
    userId: defaultUserId,
    email: DEFAULT_EMAIL,
    error: null,
  };

  const middleware = (handler: (...args: any[]) => Promise<any>) => {
    return async (request: any, context?: any) => {
      if (state.error || !state.userId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Authentication required",
            },
          },
          { status: 401 },
        );
      }
      return handler(request, {
        user: { id: state.userId, email: state.email },
        userId: state.userId,
        authResult: {
          user: { id: state.userId },
          userId: state.userId,
          error: null,
          method: "token",
          duration: 1,
        },
        params: context?.params ?? Promise.resolve({}),
      });
    };
  };

  return {
    middleware,
    state,
    setAuthenticated(userId = defaultUserId, email = DEFAULT_EMAIL) {
      state.userId = userId;
      state.email = email;
      state.error = null;
    },
    setUnauthenticated() {
      state.userId = null;
      state.error = new Error("Unauthorized");
    },
    setUserId(userId: string) {
      state.userId = userId;
      state.error = null;
    },
  };
}

// =============================================================================
// Supabase Mock 工厂
// =============================================================================

/**
 * 创建 Supabase 链式查询 mock。
 *
 * 所有方法默认返回 this（链式调用），可通过 mockResolvedValue 覆盖终端方法。
 *
 * @example
 * ```typescript
 * const query = createChainMock();
 * query.range.mockResolvedValue({ data: mockData, error: null });
 * mockSupabaseClient.from.mockReturnValue(query);
 * ```
 */
export function createChainMock(resolvedValue?: {
  data: any;
  error: any;
}): MockSupabaseQuery {
  const mock: any = {};

  const chainMethods = [
    "select",
    "insert",
    "update",
    "delete",
    "upsert",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "is",
    "not",
    "or",
    "ilike",
    "contains",
    "order",
    "range",
    "limit",
    "single",
    "maybeSingle",
  ];

  for (const method of chainMethods) {
    mock[method] = jest.fn().mockReturnThis();
  }

  // 如果提供了默认返回值，让 range/single/maybeSingle 返回它
  if (resolvedValue) {
    mock.range.mockResolvedValue(resolvedValue);
    mock.single.mockResolvedValue(resolvedValue);
    mock.maybeSingle.mockResolvedValue(resolvedValue);
  }

  return mock as MockSupabaseQuery;
}

/**
 * 创建 Supabase 客户端 mock。
 */
export function createMockSupabaseClient() {
  return {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
    rpc: jest.fn(),
  };
}

// =============================================================================
// Request 构造工具
// =============================================================================

/**
 * 创建 NextRequest 实例。
 *
 * @param path - API 路径（如 "/api/v1/bookmarks"）
 * @param options - 请求配置
 */
export function createRequest(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    searchParams?: Record<string, string>;
  } = {},
): NextRequest {
  const { method = "GET", body, searchParams } = options;
  const url = new URL(path, "http://localhost:3000");

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const init: NextRequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }

  return new NextRequest(url, init);
}

/**
 * 创建带动态路由参数的 context 对象。
 *
 * @example
 * ```typescript
 * const response = await GET(request, createRouteContext({ id: "123" }));
 * ```
 */
export function createRouteContext<T extends Record<string, string>>(
  params: T,
) {
  return { params: Promise.resolve(params) };
}

// =============================================================================
// 断言工具
// =============================================================================

/**
 * 断言响应为成功（200 + success: true）。
 */
export async function assertSuccess(
  response: Response | NextResponse,
  expectedStatus = 200,
) {
  const data = await response.json();
  expect(response.status).toBe(expectedStatus);
  expect(data.success).toBe(true);
  return data;
}

/**
 * 断言响应为 401 未认证。
 */
export async function assertUnauthorized(response: Response | NextResponse) {
  const data = await response.json();
  expect(response.status).toBe(401);
  expect(data.success).toBe(false);
  expect(data.error?.code).toBe("UNAUTHORIZED");
  return data;
}

/**
 * 断言响应为 400 验证错误。
 */
export async function assertValidationError(response: Response | NextResponse) {
  const data = await response.json();
  expect(response.status).toBe(400);
  expect(data.success).toBe(false);
  return data;
}

/**
 * 断言响应为 404 未找到。
 */
export async function assertNotFound(response: Response | NextResponse) {
  const data = await response.json();
  expect(response.status).toBe(404);
  expect(data.success).toBe(false);
  return data;
}

/**
 * 断言响应为 500 服务器错误。
 */
export async function assertServerError(response: Response | NextResponse) {
  const data = await response.json();
  expect(response.status).toBe(500);
  expect(data.success).toBe(false);
  return data;
}

/**
 * 断言响应为 429 速率限制。
 */
export async function assertRateLimited(response: Response | NextResponse) {
  const data = await response.json();
  expect(response.status).toBe(429);
  expect(data.success).toBe(false);
  return data;
}
