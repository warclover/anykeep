/**
 * Search API v1 路由测试
 *
 * @module api/v1/search/__tests__/route.test
 * @version 1.0.0
 * @since 2026-03-08
 */

import { GET } from "../route";
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
// Service Mocks
// =============================================================================

const mockSearch = jest.fn();

jest.mock("@/services", () => ({
  SearchService: jest.fn().mockImplementation(() => ({
    search: (...args: any[]) => mockSearch(...args),
  })),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({})),
}));

// =============================================================================
// Tests
// =============================================================================

describe("GET /api/v1/search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUserId = "test-user-id-123";
  });

  it("未认证返回 401", async () => {
    mockAuthUserId = null;
    const request = new NextRequest(
      "http://localhost:3000/api/v1/search?query=test",
    );
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("缺少 query 参数返回 400", async () => {
    const request = new NextRequest("http://localhost:3000/api/v1/search");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("返回搜索结果", async () => {
    mockSearch.mockResolvedValue({
      items: [
        { id: 1, title: "Test Bookmark", score: 0.95 },
        { id: 2, title: "Another Result", score: 0.82 },
      ],
      total: 2,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/v1/search?query=test&type=keyword",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.items).toHaveLength(2);
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "test",
        type: "keyword",
      }),
    );
  });

  it("支持 hybrid 搜索类型", async () => {
    mockSearch.mockResolvedValue({ items: [], total: 0 });

    const request = new NextRequest(
      "http://localhost:3000/api/v1/search?query=AI&type=hybrid&limit=10",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "AI",
        type: "hybrid",
        limit: 10,
      }),
    );
  });

  it("设置短缓存响应头", async () => {
    mockSearch.mockResolvedValue({ items: [], total: 0 });

    const request = new NextRequest(
      "http://localhost:3000/api/v1/search?query=test",
    );
    const response = await GET(request);

    expect(response.headers.get("Cache-Control")).toBe("private, max-age=10");
  });
});
