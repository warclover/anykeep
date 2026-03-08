/**
 * Bookmarks API v1 - List & Create 路由测试
 *
 * @module api/v1/bookmarks/__tests__/route.test
 * @version 1.0.0
 * @since 2026-03-08
 */

import { GET, POST } from "../route";
import { NextRequest } from "next/server";

// =============================================================================
// Auth Mock State（必须在 jest.mock 之前声明，但因 hoisting 机制可正常工作）
// =============================================================================

let mockAuthUserId: string | null = "test-user-id-123";

jest.mock("@/lib/api/middleware", () => {
  // 模拟真实 middleware 的错误处理链
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
          error: { code: "VALIDATION_ERROR", message: error.issues[0].message },
        },
        { status: 400 },
      );
    }
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
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

const mockList = jest.fn();
const mockIngest = jest.fn();

jest.mock("@/services", () => ({
  BookmarkService: jest.fn().mockImplementation(() => ({
    list: mockList,
  })),
  IngestionService: jest.fn().mockImplementation(() => ({
    ingest: mockIngest,
  })),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({})),
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
// Helpers
// =============================================================================

function createRequest(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    searchParams?: Record<string, string>;
  } = {},
) {
  const url = new URL(path, "http://localhost:3000");
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  const init: RequestInit = { method: options.method ?? "GET" };
  if (options.body) {
    init.body = JSON.stringify(options.body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(url, init);
}

// =============================================================================
// Test Data
// =============================================================================

const mockBookmarkList = {
  items: [
    {
      id: 1,
      title: "Test Bookmark",
      url: "https://example.com",
      created_at: "2026-03-01T00:00:00Z",
    },
    {
      id: 2,
      title: "Another Bookmark",
      url: "https://example.org",
      created_at: "2026-03-02T00:00:00Z",
    },
  ],
  total: 2,
  hasMore: false,
};

// =============================================================================
// Tests
// =============================================================================

describe("GET /api/v1/bookmarks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUserId = "test-user-id-123";
  });

  it("未认证返回 401", async () => {
    mockAuthUserId = null;
    const request = createRequest("/api/v1/bookmarks");
    const response = await GET(request);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  it("返回书签列表", async () => {
    mockList.mockResolvedValue(mockBookmarkList);

    const request = createRequest("/api/v1/bookmarks");
    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.items).toHaveLength(2);
    expect(data.data.total).toBe(2);
  });

  it("支持分页参数", async () => {
    mockList.mockResolvedValue({ items: [], total: 0, hasMore: false });

    const request = createRequest("/api/v1/bookmarks", {
      searchParams: { limit: "10", offset: "20" },
    });
    await GET(request);

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 20 }),
    );
  });

  it("支持过滤参数", async () => {
    mockList.mockResolvedValue({ items: [], total: 0, hasMore: false });

    const request = createRequest("/api/v1/bookmarks", {
      searchParams: { folderId: "5", isStarred: "true", platform: "wechat" },
    });
    await GET(request);

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({
        folderId: 5,
        isStarred: true,
        platform: "wechat",
      }),
    );
  });

  it("支持排序参数", async () => {
    mockList.mockResolvedValue({ items: [], total: 0, hasMore: false });

    const request = createRequest("/api/v1/bookmarks", {
      searchParams: { orderBy: "title", orderDir: "asc" },
    });
    await GET(request);

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: "title", orderDir: "asc" }),
    );
  });

  it("Service 抛出异常时返回 500", async () => {
    mockList.mockRejectedValue(new Error("Database error"));

    const request = createRequest("/api/v1/bookmarks");
    const response = await GET(request);
    expect(response.status).toBe(500);
  });

  it("无效查询参数返回 400", async () => {
    const request = createRequest("/api/v1/bookmarks", {
      searchParams: { limit: "abc" },
    });
    const response = await GET(request);
    expect(response.status).toBe(400);
  });
});

describe("POST /api/v1/bookmarks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUserId = "test-user-id-123";
  });

  it("未认证返回 401", async () => {
    mockAuthUserId = null;
    const request = createRequest("/api/v1/bookmarks", {
      method: "POST",
      body: { url: "https://example.com" },
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("成功创建书签返回 201", async () => {
    mockIngest.mockResolvedValue({
      status: "created",
      bookmark: { id: 1, url: "https://example.com", title: "Example" },
    });

    const request = createRequest("/api/v1/bookmarks", {
      method: "POST",
      body: { url: "https://example.com", title: "Example" },
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.status).toBe("created");
  });

  it("重复 URL 返回 409", async () => {
    mockIngest.mockResolvedValue({
      status: "duplicate",
      bookmark: { id: 1, url: "https://example.com" },
    });

    const request = createRequest("/api/v1/bookmarks", {
      method: "POST",
      body: { url: "https://example.com" },
    });
    const response = await POST(request);

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  it("缺少 url 字段返回 400", async () => {
    const request = createRequest("/api/v1/bookmarks", {
      method: "POST",
      body: { title: "No URL" },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("无效 URL 格式返回 400", async () => {
    const request = createRequest("/api/v1/bookmarks", {
      method: "POST",
      body: { url: "not-a-url" },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("Service 抛出异常时返回 500", async () => {
    mockIngest.mockRejectedValue(new Error("Ingestion failed"));

    const request = createRequest("/api/v1/bookmarks", {
      method: "POST",
      body: { url: "https://example.com" },
    });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
