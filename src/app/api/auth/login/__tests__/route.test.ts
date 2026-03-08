/**
 * Login API 路由测试
 *
 * @module api/auth/login/__tests__/route.test
 * @version 1.0.0
 * @since 2026-03-08
 */

import { POST } from "../route";
import { NextRequest } from "next/server";

// =============================================================================
// Mocks
// =============================================================================

const mockSignInWithPassword = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: {
        signInWithPassword: mockSignInWithPassword,
      },
    }),
  ),
}));

const mockCheckRateLimit = jest.fn();
const mockRecordFailedAttempt = jest.fn();
const mockClearRateLimit = jest.fn();

jest.mock("@/lib/auth/rate-limit", () => ({
  getRateLimitKey: jest.fn((_ip: string, email: string) => `rate:${email}`),
  checkRateLimit: (...args: any[]) => mockCheckRateLimit(...args),
  recordFailedAttempt: (...args: any[]) => mockRecordFailedAttempt(...args),
  clearRateLimit: (...args: any[]) => mockClearRateLimit(...args),
  getClientIP: jest.fn(() => "127.0.0.1"),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// =============================================================================
// Helpers
// =============================================================================

function createLoginRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// =============================================================================
// Tests
// =============================================================================

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 默认允许登录（未触发速率限制）
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockRecordFailedAttempt.mockReturnValue({ remaining: 4, message: "" });
  });

  it("缺少邮箱或密码返回 400", async () => {
    const response = await POST(
      createLoginRequest({ email: "test@example.com" }),
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("不能为空");
  });

  it("缺少邮箱返回 400", async () => {
    const response = await POST(createLoginRequest({ password: "123456" }));
    expect(response.status).toBe(400);
  });

  it("成功登录返回用户信息", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: "user-123", email: "test@example.com" },
        session: { access_token: "token" },
      },
      error: null,
    });

    const response = await POST(
      createLoginRequest({
        email: "test@example.com",
        password: "correct-password",
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user.id).toBe("user-123");
    expect(mockClearRateLimit).toHaveBeenCalled();
  });

  it("密码错误返回 401 且不泄露具体原因", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    const response = await POST(
      createLoginRequest({
        email: "test@example.com",
        password: "wrong-password",
      }),
    );

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("邮箱或密码错误");
    expect(data.error).not.toContain("Invalid login credentials");
    expect(mockRecordFailedAttempt).toHaveBeenCalled();
  });

  it("速率限制触发返回 429", async () => {
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      retryAfter: 900,
      message: "请 15 分钟后重试",
    });

    const response = await POST(
      createLoginRequest({ email: "test@example.com", password: "any" }),
    );

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.retryAfter).toBe(900);
    expect(response.headers.get("Retry-After")).toBe("900");
    // 确保不调用 signInWithPassword
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("登录失败时返回剩余尝试次数", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid credentials" },
    });
    mockRecordFailedAttempt.mockReturnValue({
      remaining: 3,
      message: "还可尝试 3 次",
    });

    const response = await POST(
      createLoginRequest({ email: "test@example.com", password: "wrong" }),
    );

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.remaining).toBe(3);
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("3");
  });

  it("Supabase 异常返回 500", async () => {
    mockSignInWithPassword.mockRejectedValue(new Error("Connection refused"));

    const response = await POST(
      createLoginRequest({ email: "test@example.com", password: "any" }),
    );

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain("稍后重试");
  });
});
