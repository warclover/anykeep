/**
 * Subscription API 路由测试
 *
 * @module api/payment/subscription/__tests__/route.test
 * @version 1.0.0
 * @since 2026-03-08
 */

import { GET, DELETE } from "../route";
import { NextRequest } from "next/server";

// =============================================================================
// Auth Mock
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

// =============================================================================
// Service Mocks
// =============================================================================

const mockGetSubscription = jest.fn();
const mockGetEntitlement = jest.fn();
const mockCancelSubscription = jest.fn();

jest.mock("@/lib/payment/services/subscription.service", () => ({
  subscriptionService: {
    getSubscription: (...args: any[]) => mockGetSubscription(...args),
    cancelSubscription: (...args: any[]) => mockCancelSubscription(...args),
  },
}));

jest.mock("@/lib/payment/services/entitlement.service", () => ({
  entitlementService: {
    getEntitlement: (...args: any[]) => mockGetEntitlement(...args),
  },
}));

// =============================================================================
// Tests
// =============================================================================

describe("GET /api/payment/subscription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUserId = "test-user-id-123";
  });

  it("未认证返回 401", async () => {
    mockAuthUserId = null;
    const request = new NextRequest(
      "http://localhost:3000/api/payment/subscription",
    );
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("返回活跃订阅和权益信息", async () => {
    mockGetSubscription.mockResolvedValue({
      id: "sub-1",
      status: "active",
      planId: "pro",
      currentPeriodEnd: "2027-03-08T00:00:00Z",
      cancelAtPeriodEnd: false,
      canceledAt: null,
    });
    mockGetEntitlement.mockResolvedValue({
      planTier: "pro",
      validUntil: "2027-03-08T00:00:00Z",
      isLifetime: false,
      aiQuotaMonthly: 100,
      storageLimitMb: 1024,
      trialEndsAt: null,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/payment/subscription",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.subscription.status).toBe("active");
    expect(data.data.entitlement.planTier).toBe("pro");
  });

  it("无订阅时 subscription 为 null", async () => {
    mockGetSubscription.mockResolvedValue(null);
    mockGetEntitlement.mockResolvedValue({
      planTier: "free",
      validUntil: null,
      isLifetime: false,
      aiQuotaMonthly: 10,
      storageLimitMb: 100,
      trialEndsAt: null,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/payment/subscription",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.subscription).toBeNull();
    expect(data.data.entitlement.planTier).toBe("free");
  });
});

describe("DELETE /api/payment/subscription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUserId = "test-user-id-123";
  });

  it("未认证返回 401", async () => {
    mockAuthUserId = null;
    const request = new NextRequest(
      "http://localhost:3000/api/payment/subscription",
      {
        method: "DELETE",
      },
    );
    const response = await DELETE(request);
    expect(response.status).toBe(401);
  });

  it("成功取消订阅", async () => {
    mockCancelSubscription.mockResolvedValue({
      success: true,
      canceledAt: "2026-03-08T10:00:00Z",
      effectiveAt: "2027-03-08T00:00:00Z",
    });

    const request = new NextRequest(
      "http://localhost:3000/api/payment/subscription",
      {
        method: "DELETE",
        body: JSON.stringify({ reason: "too_expensive" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const response = await DELETE(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.message).toContain("已取消");
    expect(mockCancelSubscription).toHaveBeenCalledWith(
      "test-user-id-123",
      "too_expensive",
    );
  });

  it("取消失败返回 400", async () => {
    mockCancelSubscription.mockResolvedValue({
      success: false,
      error: "没有可取消的订阅",
    });

    const request = new NextRequest(
      "http://localhost:3000/api/payment/subscription",
      {
        method: "DELETE",
      },
    );
    const response = await DELETE(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe("CANCEL_FAILED");
  });
});
