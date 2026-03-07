/**
 * Metrics API 集成测试
 *
 * 测试分类指标查询、时间��围过滤和数据聚合
 *
 * @module api/classification/v5/metrics/__tests__/route.test
 * @version 1.0.1
 * @since 2026-01-18
 */

import { NextRequest } from "next/server";
import { GET } from "../route";

// =============================================================================
// Mock auth state
// =============================================================================

let mockAuthUserId: string | null = "test-user-id";
let mockAuthError: Error | null = null;
let mockAuthShouldThrow: Error | null = null;

// =============================================================================
// Mock @/lib/api/middleware - intercept withAuthMiddleware
// =============================================================================

jest.mock("@/lib/api/middleware", () => ({
  withAuthMiddleware: (handler: (...args: unknown[]) => Promise<unknown>) => {
    return async (request: any, context?: any) => {
      const { NextResponse } = await import("next/server");

      if (mockAuthShouldThrow) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: mockAuthShouldThrow.message,
            },
          },
          { status: 500 },
        );
      }

      if (mockAuthError || !mockAuthUserId) {
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
        user: { id: mockAuthUserId },
        userId: mockAuthUserId,
        authResult: {
          user: { id: mockAuthUserId },
          userId: mockAuthUserId,
          error: null,
          method: "token",
          duration: 1,
        },
        params: context?.params ?? Promise.resolve({}),
      });
    };
  },
}));

// =============================================================================
// Mock Supabase
// =============================================================================

const mockSupabaseClient = {
  from: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));

jest.mock("@/lib/classification/infrastructure/shared-services/logger", () => ({
  LoggerService: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

// =============================================================================
// 认证辅助函数
// =============================================================================

function mockAuthenticated(userId = "test-user-id") {
  mockAuthUserId = userId;
  mockAuthError = null;
  mockAuthShouldThrow = null;
}

function mockUnauthenticated() {
  mockAuthUserId = null;
  mockAuthError = new Error("Unauthorized");
  mockAuthShouldThrow = null;
}

function mockAuthThrows(error: Error) {
  mockAuthShouldThrow = error;
}

// =============================================================================
// 测试辅助函数
// =============================================================================

/**
 * 创建测试用的 NextRequest
 */
function createTestRequest(params?: Record<string, string>): NextRequest {
  const searchParams = new URLSearchParams(params);
  const url = `http://localhost:3000/api/classification/v5/metrics?${searchParams.toString()}`;
  return new NextRequest(url);
}

// =============================================================================
// 认证测试
// =============================================================================

describe("Metrics API - Authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 if user is not authenticated", async () => {
    mockUnauthenticated();

    const request = createTestRequest();
    const response = await GET(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("should return 401 if auth error occurs", async () => {
    mockUnauthenticated();

    const request = createTestRequest();
    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});

// =============================================================================
// 时间范围参数验证测试
// =============================================================================

describe("Metrics API - Time Range Validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticated();
  });

  it("should accept valid timeRange parameter (7d)", async () => {
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({
            // Implementation awaits gte()
            data: [],
            error: null,
          }),
        }),
      }),
    });

    mockSupabaseClient.from = mockFrom;

    const request = createTestRequest({ days: "7" }); // Updated param name to match implementation
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it("should accept valid timeRange parameter (30d)", async () => {
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    });

    mockSupabaseClient.from = mockFrom;

    const request = createTestRequest({ days: "30" }); // Updated param name
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it("should use default timeRange (7d) if not specified", async () => {
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    });

    mockSupabaseClient.from = mockFrom;

    const request = createTestRequest();
    const response = await GET(request);

    expect(response.status).toBe(200);
  });
});

// =============================================================================
// 数据查询和响应格式测试
// =============================================================================

describe("Metrics API - Data Query and Response", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticated();
  });

  it("should return correct response structure with metrics data", async () => {
    const mockMetrics = [
      {
        id: "1",
        stage: "T0", // Fixed case: T0
        latency_ms: 150,
        confidence: 0.85,
        is_correct: true,
        degradation_level: 0,
        created_at: new Date().toISOString(),
      },
      {
        id: "2",
        stage: "T1", // Fixed case: T1
        latency_ms: 300,
        confidence: 0.92,
        is_correct: true,
        degradation_level: 0,
        created_at: new Date().toISOString(),
      },
    ];

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({
            data: mockMetrics,
            error: null,
          }),
        }),
      }),
    });

    mockSupabaseClient.from = mockFrom;

    const request = createTestRequest();
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json).toHaveProperty("t0");
    expect(json).toHaveProperty("t1");
    expect(json).toHaveProperty("cost");
    expect(json).toHaveProperty("degradation");
    expect(json).toHaveProperty("llmCallRate");
    // Removed 'overall' as it's not in the implementation
  });

  it("should handle empty metrics data", async () => {
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    });

    mockSupabaseClient.from = mockFrom;

    const request = createTestRequest();
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json).toHaveProperty("t0");
    expect(json).toHaveProperty("t1");
    expect(json).toHaveProperty("cost");
    expect(json.totalClassifications).toBe(0);
  });
});

// =============================================================================
// 错误处理测试
// =============================================================================

describe("Metrics API - Error Handling", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for expected error logs
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mockAuthenticated();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("should handle database query errors", async () => {
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({
            data: null,
            error: new Error("Database error"),
          }),
        }),
      }),
    });

    mockSupabaseClient.from = mockFrom;

    const request = createTestRequest();
    const response = await GET(request);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toHaveProperty("error");
  });

  it("should handle unexpected errors", async () => {
    mockAuthThrows(new Error("Unexpected error"));

    const request = createTestRequest();
    const response = await GET(request);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toHaveProperty("error");
  });
});
