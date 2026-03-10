/**
 * API 中间件单元测试
 *
 * 测试 withAuthMiddleware、withErrorHandler、withRateLimit、
 * validateBody、validateQuery、ensureFullUser 等核心导出
 */

import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { ServiceError } from "@/services/core";
import {
  withAuthMiddleware,
  withErrorHandler,
  withRateLimit,
  validateBody,
  validateQuery,
  ensureFullUser,
  rateLimitStore,
  PayloadTooLargeError,
  BODY_SIZE_LIMITS,
} from "../middleware";

// ============================================
// Mock 设置
// ============================================

// Mock auth-middleware
const mockWithAuth = jest.fn();
jest.mock("../auth-middleware", () => ({
  withAuth: (...args: unknown[]) => mockWithAuth(...args),
}));

// Mock supabase/server
const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}));

// Mock logger（静默日志输出）
jest.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ============================================
// 测试辅助工具
// ============================================

/** 创建模拟 NextRequest */
function createMockRequest(
  url = "http://localhost:3000/api/test",
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
): NextRequest {
  const init: RequestInit = {
    method: options?.method ?? "GET",
    headers: options?.headers ?? {},
  };
  if (options?.body) {
    init.body = options.body;
    (init.headers as Record<string, string>)["content-type"] =
      "application/json";
  }
  return new NextRequest(new URL(url), init);
}

/** 创建成功的认证结果 */
function createAuthResult(
  overrides?: Partial<ReturnType<typeof mockWithAuth>>,
) {
  return {
    user: {
      id: "user-123",
      email: "test@example.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2025-01-01",
    },
    userId: "user-123",
    error: null,
    method: "token" as const,
    duration: 5,
    ...overrides,
  };
}

/** 创建失败的认证结果 */
function createFailedAuthResult() {
  return {
    user: null,
    userId: null,
    error: new Error("No valid session"),
    method: "none" as const,
    duration: 2,
  };
}

// ============================================
// withAuthMiddleware 测试
// ============================================

describe("withAuthMiddleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("正常认证：调用 handler 并传递 userId 和 user", async () => {
    const authResult = createAuthResult();
    mockWithAuth.mockResolvedValue(authResult);

    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ data: "ok" }));

    const wrapped = withAuthMiddleware(handler);
    const request = createMockRequest();
    const response = await wrapped(request);

    // handler 应该被调用，且包含正确的认证上下文
    expect(handler).toHaveBeenCalledTimes(1);
    const [passedReq, passedCtx] = handler.mock.calls[0];
    expect(passedReq).toBe(request);
    expect(passedCtx.userId).toBe("user-123");
    expect(passedCtx.user?.id).toBe("user-123");
    expect(passedCtx.authResult).toBe(authResult);

    // 响应应该是 handler 返回的结果
    const body = await response.json();
    expect(body).toEqual({ data: "ok" });
  });

  it("未认证请求：返回 401", async () => {
    mockWithAuth.mockResolvedValue(createFailedAuthResult());

    const handler = jest.fn();
    const wrapped = withAuthMiddleware(handler);
    const request = createMockRequest();
    const response = await wrapped(request);

    // handler 不应被调用
    expect(handler).not.toHaveBeenCalled();

    // 应返回 401
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("userId 为 null 时也返回 401（即使没有 error）", async () => {
    mockWithAuth.mockResolvedValue(
      createAuthResult({ userId: null, error: null }),
    );

    const handler = jest.fn();
    const wrapped = withAuthMiddleware(handler);
    const response = await wrapped(createMockRequest());

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
  });

  it("handler 抛出普通 Error 时返回 500", async () => {
    mockWithAuth.mockResolvedValue(createAuthResult());

    const handler = jest.fn().mockRejectedValue(new Error("Something broke"));
    const wrapped = withAuthMiddleware(handler);
    const response = await wrapped(createMockRequest());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("handler 抛出 ServiceError 时返回对应状态码", async () => {
    mockWithAuth.mockResolvedValue(createAuthResult());

    const handler = jest
      .fn()
      .mockRejectedValue(new ServiceError("NOT_FOUND", "Bookmark not found"));

    const wrapped = withAuthMiddleware(handler);
    const response = await wrapped(createMockRequest());

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Bookmark not found");
  });

  it("handler 抛出 ZodError 时返回 400 验证错误", async () => {
    mockWithAuth.mockResolvedValue(createAuthResult());

    const schema = z.object({ name: z.string() });
    let zodError: ZodError;
    try {
      schema.parse({ name: 123 });
    } catch (e) {
      zodError = e as ZodError;
    }

    const handler = jest.fn().mockRejectedValue(zodError!);
    const wrapped = withAuthMiddleware(handler);
    const response = await wrapped(createMockRequest());

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toBeDefined();
  });

  it("handler 抛出 PayloadTooLargeError 时返回 413", async () => {
    mockWithAuth.mockResolvedValue(createAuthResult());

    const handler = jest
      .fn()
      .mockRejectedValue(new PayloadTooLargeError(2_000_000, 1_000_000));

    const wrapped = withAuthMiddleware(handler);
    const response = await wrapped(createMockRequest());

    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("泛型路由参数传递：params 从 context 传入 handler", async () => {
    mockWithAuth.mockResolvedValue(createAuthResult());

    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuthMiddleware<{ id: string }>(handler);

    const request = createMockRequest("http://localhost:3000/api/bookmarks/42");
    const routeContext = {
      params: Promise.resolve({ id: "42" }),
    };

    await wrapped(request, routeContext);

    const passedCtx = handler.mock.calls[0][1];
    const params = await passedCtx.params;
    expect(params.id).toBe("42");
  });

  it("无 context 时 params 默认为空对象的 Promise", async () => {
    mockWithAuth.mockResolvedValue(createAuthResult());

    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuthMiddleware(handler);

    await wrapped(createMockRequest());

    const passedCtx = handler.mock.calls[0][1];
    const params = await passedCtx.params;
    expect(params).toEqual({});
  });

  it("已废弃路径：响应头包含 deprecation 信息", async () => {
    mockWithAuth.mockResolvedValue(createAuthResult());

    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuthMiddleware(handler);

    // /api/bookmarks 是已废弃路径
    const request = createMockRequest("http://localhost:3000/api/bookmarks");
    const response = await wrapped(request);

    expect(response.headers.get("X-API-Deprecated")).toBe("true");
    expect(response.headers.get("X-API-Recommended")).toBe("/api/v1/bookmarks");
    expect(response.headers.get("X-API-Version")).toBe("legacy");
  });

  it("非废弃路径：响应头不包含 deprecation 信息", async () => {
    mockWithAuth.mockResolvedValue(createAuthResult());

    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuthMiddleware(handler);

    const request = createMockRequest("http://localhost:3000/api/v1/bookmarks");
    const response = await wrapped(request);

    expect(response.headers.get("X-API-Deprecated")).toBeNull();
  });
});

// ============================================
// withErrorHandler 测试
// ============================================

describe("withErrorHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("正常执行：透传 handler 返回值", async () => {
    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ status: "healthy" }));

    const wrapped = withErrorHandler(handler);
    const response = await wrapped(createMockRequest());

    const body = await response.json();
    expect(body).toEqual({ status: "healthy" });
  });

  it("handler 抛异常：返回 500 错误响应", async () => {
    const handler = jest
      .fn()
      .mockRejectedValue(new Error("Unexpected failure"));

    const wrapped = withErrorHandler(handler);
    const response = await wrapped(createMockRequest());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("handler 抛 ServiceError：返回对应业务错误码", async () => {
    const handler = jest
      .fn()
      .mockRejectedValue(new ServiceError("FORBIDDEN", "No access"));

    const wrapped = withErrorHandler(handler);
    const response = await wrapped(createMockRequest());

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });
});

// ============================================
// validateBody 测试
// ============================================

describe("validateBody", () => {
  const schema = z.object({
    title: z.string().min(1),
    content: z.string(),
  });

  it("合法请求体：返回解析后的数据", async () => {
    const body = JSON.stringify({ title: "Hello", content: "World" });
    const request = createMockRequest("http://localhost:3000/api/test", {
      method: "POST",
      body,
      headers: {
        "content-length": String(body.length),
      },
    });

    const result = await validateBody(request, schema);
    expect(result).toEqual({ title: "Hello", content: "World" });
  });

  it("schema 验证失败：抛出 ZodError", async () => {
    const body = JSON.stringify({ title: "", content: "World" });
    const request = createMockRequest("http://localhost:3000/api/test", {
      method: "POST",
      body,
      headers: { "content-length": String(body.length) },
    });

    await expect(validateBody(request, schema)).rejects.toThrow(ZodError);
  });

  it("Content-Length 超限：抛出 PayloadTooLargeError", async () => {
    const body = JSON.stringify({ title: "test", content: "x" });
    const request = createMockRequest("http://localhost:3000/api/test", {
      method: "POST",
      body,
      headers: {
        "content-length": String(2_000_000), // 2MB，超过默认 1MB
      },
    });

    await expect(validateBody(request, schema)).rejects.toThrow(
      PayloadTooLargeError,
    );
  });

  it("自定义 maxSize：允许更大请求体", async () => {
    const body = JSON.stringify({ title: "test", content: "ok" });
    const request = createMockRequest("http://localhost:3000/api/test", {
      method: "POST",
      body,
      headers: { "content-length": String(body.length) },
    });

    const result = await validateBody(request, schema, {
      maxSize: BODY_SIZE_LIMITS.BATCH,
    });
    expect(result.title).toBe("test");
  });

  it("无效 JSON：抛出 SyntaxError", async () => {
    const request = createMockRequest("http://localhost:3000/api/test", {
      method: "POST",
      body: "not-json{",
    });

    await expect(validateBody(request, schema)).rejects.toThrow(SyntaxError);
  });
});

// ============================================
// validateQuery 测试
// ============================================

describe("validateQuery", () => {
  const schema = z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  });

  it("合法查询参数：返回解析结果", () => {
    const request = createMockRequest(
      "http://localhost:3000/api/test?page=1&limit=10",
    );

    const result = validateQuery(request, schema);
    expect(result).toEqual({ page: "1", limit: "10" });
  });

  it("空查询参数：通过 optional schema", () => {
    const request = createMockRequest("http://localhost:3000/api/test");
    const result = validateQuery(request, schema);
    expect(result).toEqual({});
  });

  it("无效查询参数：抛出 ZodError", () => {
    const strictSchema = z.object({
      page: z.string(),
    });

    const request = createMockRequest("http://localhost:3000/api/test");

    expect(() => validateQuery(request, strictSchema)).toThrow(ZodError);
  });
});

// ============================================
// ensureFullUser 测试
// ============================================

describe("ensureFullUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("成功获取用户：返回完整 User 对象", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const user = await ensureFullUser("user-123");
    expect(user).toEqual(mockUser);
  });

  it("用户不存在：抛出 ServiceError UNAUTHORIZED", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(ensureFullUser("nonexistent")).rejects.toThrow(ServiceError);
    await expect(ensureFullUser("nonexistent")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("Supabase 返回错误：抛出 ServiceError", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Token expired"),
    });

    await expect(ensureFullUser("user-123")).rejects.toThrow(ServiceError);
  });
});

// ============================================
// withRateLimit 测试
// ============================================

describe("withRateLimit", () => {
  beforeEach(() => {
    rateLimitStore.clear();
    jest.clearAllMocks();
  });

  it("未超限：正常执行 handler", async () => {
    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));

    const wrapped = withRateLimit({ windowMs: 60_000, max: 5 })(handler);
    const request = createMockRequest("http://localhost:3000/api/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    const response = await wrapped(request);
    expect(handler).toHaveBeenCalledTimes(1);

    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it("超出限制：返回 429 并包含 Retry-After 头", async () => {
    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));

    const wrapped = withRateLimit({ windowMs: 60_000, max: 2 })(handler);
    const request = createMockRequest("http://localhost:3000/api/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    // 前两次请求应通过
    await wrapped(request);
    await wrapped(request);

    // 第三次应被限制
    const response = await wrapped(request);
    expect(response.status).toBe(429);

    const body = await response.json();
    expect(body.error.code).toBe("RATE_LIMITED");

    // 检查限流相关响应头
    expect(response.headers.get("Retry-After")).toBeDefined();
    expect(response.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("自定义 keyGenerator：按自定义 key 限流", async () => {
    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));

    const wrapped = withRateLimit({
      windowMs: 60_000,
      max: 1,
      keyGenerator: (req) => req.headers.get("x-user-id") ?? "anonymous",
    })(handler);

    // 用户 A 的请求
    const reqA = createMockRequest("http://localhost:3000/api/test", {
      headers: { "x-user-id": "userA" },
    });
    // 用户 B 的请求
    const reqB = createMockRequest("http://localhost:3000/api/test", {
      headers: { "x-user-id": "userB" },
    });

    // A 第一次通过
    const resA1 = await wrapped(reqA);
    expect(resA1.status).toBe(200);

    // A 第二次被限制
    const resA2 = await wrapped(reqA);
    expect(resA2.status).toBe(429);

    // B 第一次仍然通过（独立限流）
    const resB1 = await wrapped(reqB);
    expect(resB1.status).toBe(200);
  });

  it("无 x-forwarded-for 时使用 anonymous 作为 key", async () => {
    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));

    const wrapped = withRateLimit({ windowMs: 60_000, max: 1 })(handler);
    const request = createMockRequest();

    await wrapped(request);
    const response = await wrapped(request);

    expect(response.status).toBe(429);
  });
});

// ============================================
// rateLimitStore 测试
// ============================================

describe("rateLimitStore", () => {
  beforeEach(() => {
    rateLimitStore.clear();
  });

  afterAll(() => {
    // 清理定时器，避免 Jest 警告
    rateLimitStore.stopCleanupTimer();
  });

  it("set/get：正常存取记录", () => {
    rateLimitStore.set("key1", { count: 1, resetAt: Date.now() + 60_000 });

    const record = rateLimitStore.get("key1");
    expect(record).toBeDefined();
    expect(record!.count).toBe(1);
  });

  it("get 不存在的 key：返回 undefined", () => {
    expect(rateLimitStore.get("nonexistent")).toBeUndefined();
  });

  it("delete：删除记录", () => {
    rateLimitStore.set("key1", { count: 1, resetAt: Date.now() + 60_000 });
    expect(rateLimitStore.delete("key1")).toBe(true);
    expect(rateLimitStore.get("key1")).toBeUndefined();
  });

  it("forceCleanup：清理过期条目", () => {
    // 添加已过期的记录
    rateLimitStore.set("expired", { count: 5, resetAt: Date.now() - 1000 });
    // 添加未过期的记录
    rateLimitStore.set("active", { count: 1, resetAt: Date.now() + 60_000 });

    const cleaned = rateLimitStore.forceCleanup();

    expect(cleaned).toBe(1);
    expect(rateLimitStore.get("expired")).toBeUndefined();
    expect(rateLimitStore.get("active")).toBeDefined();
  });

  it("size：返回当前存储条目数", () => {
    expect(rateLimitStore.size).toBe(0);

    rateLimitStore.set("a", { count: 1, resetAt: Date.now() + 60_000 });
    rateLimitStore.set("b", { count: 1, resetAt: Date.now() + 60_000 });

    expect(rateLimitStore.size).toBe(2);
  });
});

// ============================================
// PayloadTooLargeError 测试
// ============================================

describe("PayloadTooLargeError", () => {
  it("包含正确的错误信息和属性", () => {
    const error = new PayloadTooLargeError(2_000_000, 1_000_000);

    expect(error.name).toBe("PayloadTooLargeError");
    expect(error.statusCode).toBe(413);
    expect(error.actualSize).toBe(2_000_000);
    expect(error.maxSize).toBe(1_000_000);
    expect(error.message).toContain("1953KB"); // 2_000_000 / 1024 ≈ 1953
    expect(error.message).toContain("977KB"); // 1_000_000 / 1024 ≈ 977
  });
});

// ============================================
// BODY_SIZE_LIMITS 常量测试
// ============================================

describe("BODY_SIZE_LIMITS", () => {
  it("包含预定义的大小限制", () => {
    expect(BODY_SIZE_LIMITS.DEFAULT).toBe(1 * 1024 * 1024); // 1MB
    expect(BODY_SIZE_LIMITS.BATCH).toBe(5 * 1024 * 1024); // 5MB
    expect(BODY_SIZE_LIMITS.LARGE).toBe(10 * 1024 * 1024); // 10MB
  });
});
