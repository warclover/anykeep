/**
 * Conversations API 路由测试
 *
 * @module @/app/api/conversations/__tests__/route.test
 * @version 1.0.0
 * @since 2026-01-13
 */

import { GET, POST } from "../route";
import { NextRequest } from "next/server";

// =============================================================================
// Mock auth state
// =============================================================================

const mockSupabaseUser = { id: "user_123", email: "test@example.com" };
let mockAuthUserId: string | null = mockSupabaseUser.id;
let mockAuthError: Error | null = null;

// =============================================================================
// Mock @/lib/api/middleware - intercept withAuthMiddleware
// =============================================================================

jest.mock("@/lib/api/middleware", () => ({
  withAuthMiddleware: (handler: (...args: unknown[]) => Promise<unknown>) => {
    return async (request: any, context?: any) => {
      if (mockAuthError || !mockAuthUserId) {
        const { NextResponse } = await import("next/server");
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
        user: { id: mockAuthUserId, email: "test@example.com" },
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

// Mock Supabase
const mockConversations = [
  {
    conversation_id: "conv_1",
    state: {
      messages: [
        { role: "user", content: "Hello AI assistant" },
        { role: "assistant", content: "Hello! How can I help?" },
      ],
    },
    message_count: 2,
    last_intent: "chitchat",
    created_at: "2026-01-13T10:00:00Z",
    updated_at: "2026-01-13T10:05:00Z",
  },
];

const mockSupabaseClient = {
  from: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// 辅助函数：模拟已认证用户
function mockAuthenticated() {
  mockAuthUserId = mockSupabaseUser.id;
  mockAuthError = null;
}

// 辅助函数：模拟未认证
function mockUnauthenticated() {
  mockAuthUserId = null;
  mockAuthError = new Error("Unauthorized");
}

describe("Conversations API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/conversations", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const request = new NextRequest("http://localhost/api/conversations");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it("should return conversations list", async () => {
      mockAuthenticated();

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: mockConversations,
          error: null,
        }),
      };

      const mockCountQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          count: 1,
          error: null,
        }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockQuery)
        .mockReturnValueOnce(mockCountQuery);

      const request = new NextRequest(
        "http://localhost/api/conversations?limit=10&offset=0",
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.conversations).toHaveLength(1);
      expect(data.data.conversations[0].id).toBe("conv_1");
      expect(data.data.conversations[0].title).toBe("Hello AI assistant");
    });

    it("should handle pagination parameters", async () => {
      mockAuthenticated();

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      const mockCountQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          count: 0,
          error: null,
        }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockQuery)
        .mockReturnValueOnce(mockCountQuery);

      const request = new NextRequest(
        "http://localhost/api/conversations?limit=20&offset=10",
      );
      await GET(request);

      expect(mockQuery.range).toHaveBeenCalledWith(10, 29);
    });

    it("should handle database error", async () => {
      mockAuthenticated();

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error" },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const request = new NextRequest("http://localhost/api/conversations");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe("POST /api/conversations", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it("should create new conversation", async () => {
      mockAuthenticated();

      const mockQuery = {
        insert: jest.fn().mockResolvedValue({
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.conversationId).toMatch(/^conv_\d+_[a-z0-9]+$/);
    });

    it("should handle database error on create", async () => {
      mockAuthenticated();

      const mockQuery = {
        insert: jest.fn().mockResolvedValue({
          error: { message: "Insert failed" },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });
});
