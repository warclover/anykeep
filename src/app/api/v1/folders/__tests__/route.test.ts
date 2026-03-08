/**
 * Folders API v1 - List & Create 路由测试
 *
 * @module api/v1/folders/__tests__/route.test
 * @version 1.0.0
 * @since 2026-03-08
 */

import { GET, POST } from "../route";
import { NextRequest } from "next/server";

// =============================================================================
// Auth Mock State
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
const mockGetTree = jest.fn();
const mockCreate = jest.fn();

jest.mock("@/services", () => ({
  FolderService: jest.fn().mockImplementation(() => ({
    list: mockList,
    getTree: mockGetTree,
    create: mockCreate,
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

const mockFolderList = [
  { id: 1, name: "Work", parent_id: null, is_system: false },
  { id: 2, name: "Personal", parent_id: null, is_system: false },
  { id: 3, name: "Inbox", parent_id: null, is_system: true },
];

// =============================================================================
// Tests
// =============================================================================

describe("GET /api/v1/folders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUserId = "test-user-id-123";
  });

  it("未认证返回 401", async () => {
    mockAuthUserId = null;
    const request = createRequest("/api/v1/folders");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("默认返回列表视图", async () => {
    mockList.mockResolvedValue(mockFolderList);

    const request = createRequest("/api/v1/folders");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ includeSystem: true }),
    );
  });

  it("支持树结构视图", async () => {
    mockGetTree.mockResolvedValue([{ id: 1, name: "Root", children: [] }]);

    const request = createRequest("/api/v1/folders", {
      searchParams: { view: "tree" },
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockGetTree).toHaveBeenCalled();
  });

  it("支持 includeArchived 参数", async () => {
    mockList.mockResolvedValue([]);

    const request = createRequest("/api/v1/folders", {
      searchParams: { includeArchived: "true" },
    });
    await GET(request);

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ includeArchived: true }),
    );
  });

  it("Service 异常返回 500", async () => {
    mockList.mockRejectedValue(new Error("DB error"));

    const request = createRequest("/api/v1/folders");
    const response = await GET(request);
    expect(response.status).toBe(500);
  });
});

describe("POST /api/v1/folders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUserId = "test-user-id-123";
  });

  it("未认证返回 401", async () => {
    mockAuthUserId = null;
    const request = createRequest("/api/v1/folders", {
      method: "POST",
      body: { name: "New Folder" },
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("成功创建文件夹返回 201", async () => {
    mockCreate.mockResolvedValue({
      id: 4,
      name: "New Folder",
      parent_id: null,
    });

    const request = createRequest("/api/v1/folders", {
      method: "POST",
      body: { name: "New Folder" },
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.name).toBe("New Folder");
  });

  it("Service 异常返回 500", async () => {
    mockCreate.mockRejectedValue(new Error("Create failed"));

    const request = createRequest("/api/v1/folders", {
      method: "POST",
      body: { name: "Fail Folder" },
    });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
