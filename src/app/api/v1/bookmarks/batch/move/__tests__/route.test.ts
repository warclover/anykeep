/**
 * Batch Move API v1 路由测试
 *
 * @module api/v1/bookmarks/batch/move/__tests__/route.test
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
// Service Mocks
// =============================================================================

const mockBatchMove = jest.fn();
const mockFrom = jest.fn();

jest.mock("@/services", () => ({
  BookmarkService: jest.fn().mockImplementation(() => ({
    batchMove: (...args: any[]) => mockBatchMove(...args),
  })),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: (...args: any[]) => mockFrom(...args),
    }),
  ),
}));

jest.mock("@/lib/classification/learning/trigger-move-learning", () => ({
  triggerMoveLearning: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
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

function createMoveRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/v1/bookmarks/batch/move", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/v1/bookmarks/batch/move", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUserId = "test-user-id-123";

    // mock supabase.from("bookmarks").select().in().eq().is() 链式调用
    const chainMock = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockResolvedValue({
        data: [{ id: 1, folder_id: null, ai_tags: ["tech"] }],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(chainMock);
  });

  it("未认证返回 401", async () => {
    mockAuthUserId = null;
    const response = await POST(createMoveRequest({ ids: [1], folderId: 5 }));
    expect(response.status).toBe(401);
  });

  it("缺少 folderId 返回 400", async () => {
    const response = await POST(createMoveRequest({ ids: [1] }));
    expect(response.status).toBe(400);
  });

  it("成功批量移动", async () => {
    mockBatchMove.mockResolvedValue({
      success: true,
      affected: 2,
      message: "Moved 2 bookmark(s) to folder",
    });

    const response = await POST(
      createMoveRequest({ ids: [1, 2], folderId: 5 }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.affected).toBe(2);
    expect(data.data.targetFolderId).toBe(5);
    expect(mockBatchMove).toHaveBeenCalledWith([1, 2], 5);
  });

  it("移到根目录（folderId: null）", async () => {
    mockBatchMove.mockResolvedValue({
      success: true,
      affected: 1,
      message: "Moved 1 bookmark(s) to folder",
    });

    const response = await POST(
      createMoveRequest({ ids: [1], folderId: null }),
    );

    expect(response.status).toBe(200);
    expect(mockBatchMove).toHaveBeenCalledWith([1], null);
  });
});
