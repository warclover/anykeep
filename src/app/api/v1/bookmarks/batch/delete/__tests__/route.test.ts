/**
 * Batch Delete API v1 路由测试
 *
 * @module api/v1/bookmarks/batch/delete/__tests__/route.test
 * @version 1.0.0
 * @since 2026-03-08
 */

import { POST } from "../route";
import { NextRequest } from "next/server";

// =============================================================================
// Auth Mock
// =============================================================================

let mockAuthUserId: string | null = "test-user-id-123";

jest.mock("@/lib/api/middleware", () => {
  const { ZodError } = require("zod");
  const {
    ServiceError,
    SERVICE_ERROR_HTTP_STATUS,
  } = require("@/services/core");

  function handleMockError(error: any) {
    const { NextResponse } = require("next/server");
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: error.issues[0].message,
          },
        },
        { status: 400 },
      );
    }
    if (error instanceof ServiceError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: error.code, message: error.message },
        },
        { status: SERVICE_ERROR_HTTP_STATUS[error.code] ?? 500 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      },
      { status: 500 },
    );
  }

  return {
    withAuthMiddleware: (handler: (...args: any[]) => Promise<any>) => {
      return async (request: any, context?: any) => {
        const { NextResponse } = require("next/server");
        if (!mockAuthUserId) {
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
        } catch (error) {
          return handleMockError(error);
        }
      };
    },
    validateQuery: jest.fn((request: any, schema: any) => {
      const searchParams = request.nextUrl.searchParams;
      const query: Record<string, string> = {};
      searchParams.forEach((value: string, key: string) => {
        query[key] = value;
      });
      return schema.parse(query);
    }),
    validateBody: jest.fn(async (request: any, schema: any) => {
      const body = await request.json();
      return schema.parse(body);
    }),
  };
});

// =============================================================================
// Service & Rate Limit Mocks
// =============================================================================

const mockBatchDelete = jest.fn();

jest.mock("@/services", () => ({
  BookmarkService: jest.fn().mockImplementation(() => ({
    batchDelete: (...args: any[]) => mockBatchDelete(...args),
  })),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({})),
}));

const mockCheckRateLimit = jest.fn();
jest.mock("@/lib/utils/rate-limiter", () => ({
  checkRateLimit: (...args: any[]) => mockCheckRateLimit(...args),
}));

jest.mock("@/lib/logger", () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

// =============================================================================
// Tests
// =============================================================================

function createBatchRequest(body: Record<string, unknown>) {
  return new NextRequest(
    "http://localhost:3000/api/v1/bookmarks/batch/delete",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
  );
}

describe("POST /api/v1/bookmarks/batch/delete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUserId = "test-user-id-123";
    mockCheckRateLimit.mockReturnValue({ allowed: true });
  });

  it("未认证返回 401", async () => {
    mockAuthUserId = null;
    const response = await POST(createBatchRequest({ ids: [1, 2] }));
    expect(response.status).toBe(401);
  });

  it("空 ids 返回 400", async () => {
    const response = await POST(createBatchRequest({ ids: [] }));
    expect(response.status).toBe(400);
  });

  it("速率限制返回 429", async () => {
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      resetMs: 3600000,
    });

    const response = await POST(createBatchRequest({ ids: [1] }));
    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error.code).toBe("RATE_LIMITED");
    expect(response.headers.get("Retry-After")).toBe("3600");
  });

  it("成功批量删除", async () => {
    mockBatchDelete.mockResolvedValue({
      success: true,
      affected: 3,
      message: "Moved 3 bookmark(s) to trash",
    });

    const response = await POST(createBatchRequest({ ids: [1, 2, 3] }));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.affected).toBe(3);
    expect(mockBatchDelete).toHaveBeenCalledWith([1, 2, 3]);
  });
});
