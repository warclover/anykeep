/**
 * Checkout API 路由测试
 *
 * @module api/payment/checkout/__tests__/route.test
 * @version 1.0.0
 * @since 2026-03-08
 */

import { POST } from "../route";
import { NextRequest } from "next/server";

// =============================================================================
// Auth & Supabase Mocks
// =============================================================================

let mockAuthUserId: string | null = "test-user-id-123";

jest.mock("@/lib/api/middleware", () => {
  return {
    withAuthMiddleware: (handler: (...args: any[]) => Promise<any>) => {
      return async (request: any, context?: any) => {
        const { NextResponse } = require("next/server");
        if (!mockAuthUserId) {
          return NextResponse.json(
            { success: false, error: { code: "UNAUTHORIZED" } },
            { status: 401 },
          );
        }
        try {
          return await handler(request, {
            user: { id: mockAuthUserId, email: "test@example.com" },
            userId: mockAuthUserId,
            authResult: {
              userId: mockAuthUserId,
              method: "token",
              duration: 1,
            },
            params: context?.params ?? Promise.resolve({}),
          });
        } catch {
          return NextResponse.json(
            { success: false, error: { code: "INTERNAL_ERROR" } },
            { status: 500 },
          );
        }
      };
    },
  };
});

const mockFrom = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

jest.mock("@/lib/payment/config", () => ({
  PRICING: {
    pro: { monthly: { cny: 29, usd: 4.99 }, yearly: { cny: 199, usd: 29.99 } },
    pro_plus: {
      monthly: { cny: 59, usd: 9.99 },
      yearly: { cny: 399, usd: 59.99 },
    },
    lifetime: { price: { cny: 999, usd: 149.99 }, limit: 1000 },
  },
  ORDER_CONFIG: { expiryMinutes: 30 },
}));

// =============================================================================
// Helpers
// =============================================================================

function createCheckoutRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/payment/checkout", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// =============================================================================
// Tests
// =============================================================================

describe("POST /api/payment/checkout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUserId = "test-user-id-123";
  });

  it("未认证返回 401", async () => {
    mockAuthUserId = null;
    const response = await POST(
      createCheckoutRequest({ planTier: "pro", currency: "CNY" }),
    );
    expect(response.status).toBe(401);
  });

  it("无效套餐返回 400", async () => {
    // mock 订阅检查不需要（400 在 planTier 验证之前）
    const response = await POST(
      createCheckoutRequest({ planTier: "invalid", currency: "CNY" }),
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe("INVALID_PLAN");
  });

  it("已有活跃订阅返回 409", async () => {
    // mock 订阅查询返回已有订阅
    const mockSubscriptionQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { status: "active", plan_id: "pro" },
        error: null,
      }),
    };
    mockFrom.mockReturnValue(mockSubscriptionQuery);

    const response = await POST(
      createCheckoutRequest({ planTier: "pro", currency: "CNY" }),
    );
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error.code).toBe("DUPLICATE_SUBSCRIPTION");
  });

  it("成功创建订单", async () => {
    // mock 订阅查询 - 无活跃订阅
    const mockSubscriptionQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    // mock 订单插入
    const mockInsertQuery = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: "order-1", order_no: "AK20260308123456" },
        error: null,
      }),
    };

    mockFrom
      .mockReturnValueOnce(mockSubscriptionQuery)
      .mockReturnValueOnce(mockInsertQuery);

    const response = await POST(
      createCheckoutRequest({
        planTier: "pro",
        currency: "CNY",
        interval: "yearly",
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.amount).toBe(199);
    expect(data.data.currency).toBe("CNY");
    expect(data.data.provider).toBe("yungouos");
  });

  it("USD 选择 lemonsqueezy 支付渠道", async () => {
    const mockSubscriptionQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    const mockInsertQuery = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: "order-2", order_no: "AK20260308654321" },
        error: null,
      }),
    };
    mockFrom
      .mockReturnValueOnce(mockSubscriptionQuery)
      .mockReturnValueOnce(mockInsertQuery);

    const response = await POST(
      createCheckoutRequest({ planTier: "pro", currency: "USD" }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.provider).toBe("lemonsqueezy");
  });
});
