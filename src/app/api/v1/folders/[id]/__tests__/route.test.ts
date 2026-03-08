/**
 * Folder Detail API v1 - GET/PATCH/DELETE 路由测试
 *
 * @module api/v1/folders/[id]/__tests__/route.test
 * @version 1.0.0
 * @since 2026-03-08
 */

import { GET, PATCH, DELETE } from "../route";
import { NextRequest } from "next/server";
import { ServiceError } from "@/services/core";

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

const mockGetById = jest.fn();
const mockUpdate = jest.fn();
const mockDeleteFn = jest.fn();

jest.mock("@/services", () => ({
  FolderService: jest.fn().mockImplementation(() => ({
    getById: mockGetById,
    update: mockUpdate,
    delete: mockDeleteFn,
  })),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({})),
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

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

// =============================================================================
// Test Data
// =============================================================================

const mockFolder = {
  id: 1,
  name: "Work",
  parent_id: null,
  is_system: false,
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

// =============================================================================
// Tests
// =============================================================================

describe("GET /api/v1/folders/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUserId = "test-user-id-123";
  });

  it("未认证返回 401", async () => {
    mockAuthUserId = null;
    const request = createRequest("/api/v1/folders/1");
    const response = await GET(request, routeContext("1"));
    expect(response.status).toBe(401);
  });

  it("返回文件夹详情", async () => {
    mockGetById.mockResolvedValue(mockFolder);

    const request = createRequest("/api/v1/folders/1");
    const response = await GET(request, routeContext("1"));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.name).toBe("Work");
  });

  it("非数字 ID 返回 400", async () => {
    const request = createRequest("/api/v1/folders/abc");
    const response = await GET(request, routeContext("abc"));
    expect(response.status).toBe(400);
  });

  it("不存在的文件夹返回 404", async () => {
    mockGetById.mockRejectedValue(
      new ServiceError("NOT_FOUND", "Folder not found"),
    );

    const request = createRequest("/api/v1/folders/999");
    const response = await GET(request, routeContext("999"));
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/v1/folders/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUserId = "test-user-id-123";
  });

  it("未认证返回 401", async () => {
    mockAuthUserId = null;
    const request = createRequest("/api/v1/folders/1", {
      method: "PATCH",
      body: { name: "Updated" },
    });
    const response = await PATCH(request, routeContext("1"));
    expect(response.status).toBe(401);
  });

  it("成功更新文件夹名称", async () => {
    const updated = { ...mockFolder, name: "Updated Work" };
    mockUpdate.mockResolvedValue(updated);

    const request = createRequest("/api/v1/folders/1", {
      method: "PATCH",
      body: { name: "Updated Work" },
    });
    const response = await PATCH(request, routeContext("1"));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.name).toBe("Updated Work");
  });

  it("非数字 ID 返回 400", async () => {
    const request = createRequest("/api/v1/folders/abc", {
      method: "PATCH",
      body: { name: "Test" },
    });
    const response = await PATCH(request, routeContext("abc"));
    expect(response.status).toBe(400);
  });

  it("不存在的文件夹返回 404", async () => {
    mockUpdate.mockRejectedValue(
      new ServiceError("NOT_FOUND", "Folder not found"),
    );

    const request = createRequest("/api/v1/folders/999", {
      method: "PATCH",
      body: { name: "Updated" },
    });
    const response = await PATCH(request, routeContext("999"));
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/v1/folders/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUserId = "test-user-id-123";
  });

  it("未认证返回 401", async () => {
    mockAuthUserId = null;
    const request = createRequest("/api/v1/folders/1", { method: "DELETE" });
    const response = await DELETE(request, routeContext("1"));
    expect(response.status).toBe(401);
  });

  it("成功删除返回 204", async () => {
    mockDeleteFn.mockResolvedValue(undefined);

    const request = createRequest("/api/v1/folders/1", { method: "DELETE" });
    const response = await DELETE(request, routeContext("1"));
    expect(response.status).toBe(204);
  });

  it("级联删除传递 cascade 参数", async () => {
    mockDeleteFn.mockResolvedValue(undefined);

    const request = createRequest("/api/v1/folders/1", {
      method: "DELETE",
      searchParams: { cascade: "true" },
    });
    const response = await DELETE(request, routeContext("1"));
    expect(response.status).toBe(204);
    expect(mockDeleteFn).toHaveBeenCalledWith(1, { cascade: true });
  });

  it("非数字 ID 返回 400", async () => {
    const request = createRequest("/api/v1/folders/abc", { method: "DELETE" });
    const response = await DELETE(request, routeContext("abc"));
    expect(response.status).toBe(400);
  });

  it("不存在的文件夹返回 404", async () => {
    mockDeleteFn.mockRejectedValue(
      new ServiceError("NOT_FOUND", "Folder not found"),
    );

    const request = createRequest("/api/v1/folders/999", { method: "DELETE" });
    const response = await DELETE(request, routeContext("999"));
    expect(response.status).toBe(404);
  });
});
