/**
 * Conversation Detail API 路由测试
 *
 * @module @/app/api/conversations/[id]/__tests__/route.test
 * @version 1.0.0
 * @since 2026-01-13
 */

import { GET, DELETE } from "../route";
import { NextRequest } from "next/server";

// Mock logger（middleware.ts 依赖）
jest.mock("@/lib/logger", () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Supabase
const mockSupabaseUser = { id: "user_123", email: "test@example.com" };
const mockConversationData = {
  conversation_id: "conv_test_123",
  state: {
    messages: [
      {
        id: "msg_1",
        role: "user",
        content: "Hello AI",
        createdAt: "2026-01-13T10:00:00Z",
      },
      {
        id: "msg_2",
        role: "assistant",
        content: "Hello! How can I help?",
        createdAt: "2026-01-13T10:00:05Z",
      },
    ],
  },
  message_count: 2,
  last_intent: "chitchat",
  created_at: "2026-01-13T10:00:00Z",
  updated_at: "2026-01-13T10:05:00Z",
};

const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));

describe("Conversation Detail API", () => {
  const mockParams = Promise.resolve({ id: "conv_test_123" });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/conversations/[id]", () => {
    it("should return 401 if not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const request = new NextRequest(
        "http://localhost/api/conversations/conv_test_123",
      );
      const response = await GET(request, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it("should return conversation detail with messages", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockSupabaseUser },
      });

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockConversationData,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const request = new NextRequest(
        "http://localhost/api/conversations/conv_test_123",
      );
      const response = await GET(request, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.conversation.id).toBe("conv_test_123");
      expect(data.data.conversation.messages).toHaveLength(2);
      expect(data.data.conversation.title).toBe("Hello AI");
    });

    it("should return 404 if conversation not found", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockSupabaseUser },
      });

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116" },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const request = new NextRequest(
        "http://localhost/api/conversations/nonexistent",
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: "nonexistent" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });

    it("should handle messages without createdAt", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockSupabaseUser },
      });

      const dataWithoutCreatedAt = {
        ...mockConversationData,
        state: {
          messages: [
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi" },
          ],
        },
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: dataWithoutCreatedAt,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const request = new NextRequest(
        "http://localhost/api/conversations/conv_test_123",
      );
      const response = await GET(request, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.conversation.messages[0].createdAt).toBe(
        mockConversationData.created_at,
      );
    });
  });

  describe("DELETE /api/conversations/[id]", () => {
    it("should return 401 if not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const request = new NextRequest(
        "http://localhost/api/conversations/conv_test_123",
        { method: "DELETE" },
      );
      const response = await DELETE(request, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it("should delete conversation successfully", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockSupabaseUser },
      });

      const mockQuery = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      // Chain the eq calls
      mockQuery.eq.mockReturnValueOnce(mockQuery).mockResolvedValueOnce({
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const request = new NextRequest(
        "http://localhost/api/conversations/conv_test_123",
        { method: "DELETE" },
      );
      const response = await DELETE(request, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.deleted).toBe(true);
      expect(data.data.conversationId).toBe("conv_test_123");
    });

    it("should handle delete error", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockSupabaseUser },
      });

      const mockQuery = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      mockQuery.eq.mockReturnValueOnce(mockQuery).mockResolvedValueOnce({
        error: { message: "Delete failed" },
      });

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const request = new NextRequest(
        "http://localhost/api/conversations/conv_test_123",
        { method: "DELETE" },
      );
      const response = await DELETE(request, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });
});
