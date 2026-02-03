/**
 * useConversationHistory Hook 单元测试
 *
 * @module @/hooks/domain/ai/__tests__/use-conversation-history.test
 * @version 1.0.0
 * @since 2026-01-13
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useConversationHistory } from "../use-conversation-history";
import { conversationStorage } from "@/lib/storage/conversation-storage";

// Mock dependencies
jest.mock("@/lib/storage/conversation-storage", () => ({
  conversationStorage: {
    restore: jest.fn(),
    save: jest.fn(),
    clear: jest.fn(),
    updateConversationId: jest.fn(),
  },
}));

jest.mock("@/lib/ai-agent/config/feature-flags", () => ({
  FeatureFlags: {
    ENABLE_CONVERSATION_PERSISTENCE: true,
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("useConversationHistory", () => {
  // Test data
  const mockConversations = [
    {
      id: "conv_1",
      title: "Test conversation 1",
      lastMessage: "Hello",
      messageCount: 2,
      lastIntent: "search",
      createdAt: "2026-01-13T10:00:00Z",
      updatedAt: "2026-01-13T10:05:00Z",
    },
    {
      id: "conv_2",
      title: "Test conversation 2",
      lastMessage: "World",
      messageCount: 4,
      lastIntent: "manage",
      createdAt: "2026-01-13T09:00:00Z",
      updatedAt: "2026-01-13T09:30:00Z",
    },
  ];

  const mockConversationDetail = {
    id: "conv_1",
    title: "Test conversation 1",
    messages: [
      {
        id: "msg_1",
        role: "user",
        content: "Hello",
        createdAt: "2026-01-13T10:00:00Z",
      },
      {
        id: "msg_2",
        role: "assistant",
        content: "Hi there!",
        createdAt: "2026-01-13T10:00:05Z",
      },
    ],
    messageCount: 2,
    lastIntent: "search",
    createdAt: "2026-01-13T10:00:00Z",
    updatedAt: "2026-01-13T10:05:00Z",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (conversationStorage.restore as jest.Mock).mockReturnValue(null);
  });

  describe("initialization", () => {
    it("should initialize with empty state", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { conversations: [], total: 0 },
          }),
      });

      const { result } = renderHook(() => useConversationHistory());

      expect(result.current.state.conversations).toEqual([]);
      expect(result.current.state.currentId).toBeNull();
      expect(result.current.state.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });
    });

    it("should restore currentId from localStorage", async () => {
      (conversationStorage.restore as jest.Mock).mockReturnValue({
        conversationId: "restored_conv",
        messages: [],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { conversations: [], total: 0 },
          }),
      });

      const { result } = renderHook(() => useConversationHistory());

      expect(result.current.state.currentId).toBe("restored_conv");
    });

    it("should fetch conversations on mount", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { conversations: mockConversations, total: 2 },
          }),
      });

      const { result } = renderHook(() => useConversationHistory());

      await waitFor(() => {
        expect(result.current.state.conversations).toHaveLength(2);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/conversations?limit=10&offset=0",
        expect.any(Object),
      );
    });
  });

  describe("refresh", () => {
    it("should refresh conversation list", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { conversations: [], total: 0 },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { conversations: mockConversations, total: 2 },
            }),
        });

      const { result } = renderHook(() => useConversationHistory());

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.actions.refresh();
      });

      expect(result.current.state.conversations).toHaveLength(2);
    });
  });

  describe("select", () => {
    it("should load conversation detail when selecting", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { conversations: mockConversations, total: 2 },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { conversation: mockConversationDetail },
            }),
        });

      const { result } = renderHook(() => useConversationHistory());

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      let detail;
      await act(async () => {
        detail = await result.current.actions.select("conv_1");
      });

      expect(detail).toEqual(mockConversationDetail);
      expect(result.current.state.currentId).toBe("conv_1");
      expect(result.current.state.currentDetail).toEqual(
        mockConversationDetail,
      );
      expect(conversationStorage.updateConversationId).toHaveBeenCalledWith(
        "conv_1",
      );
    });

    it("should return cached detail if already selected", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { conversations: mockConversations, total: 2 },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { conversation: mockConversationDetail },
            }),
        });

      const { result } = renderHook(() => useConversationHistory());

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      // First select
      await act(async () => {
        await result.current.actions.select("conv_1");
      });

      // Second select (should return cached)
      let detail;
      await act(async () => {
        detail = await result.current.actions.select("conv_1");
      });

      expect(detail).toEqual(mockConversationDetail);
      // Should only call fetch once for detail
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle 404 error gracefully", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { conversations: mockConversations, total: 2 },
            }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: () =>
            Promise.resolve({
              error: { message: "Not found" },
            }),
        });

      const { result } = renderHook(() => useConversationHistory());

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      let detail;
      await act(async () => {
        detail = await result.current.actions.select("nonexistent");
      });

      expect(detail).toBeNull();
      expect(result.current.state.currentId).toBeNull();
    });
  });

  describe("create", () => {
    it("should create new conversation", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { conversations: [], total: 0 },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { conversationId: "new_conv_123" },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { conversations: [], total: 0 },
            }),
        });

      const { result } = renderHook(() => useConversationHistory());

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      let newId;
      await act(async () => {
        newId = await result.current.actions.create();
      });

      expect(newId).toBe("new_conv_123");
      expect(result.current.state.currentId).toBe("new_conv_123");
      expect(conversationStorage.clear).toHaveBeenCalled();
      expect(conversationStorage.save).toHaveBeenCalledWith("new_conv_123", []);
    });

    it("should handle create error", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { conversations: [], total: 0 },
            }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () =>
            Promise.resolve({
              error: { message: "Failed to create" },
            }),
        });

      const { result } = renderHook(() => useConversationHistory());

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      let newId;
      await act(async () => {
        newId = await result.current.actions.create();
      });

      expect(newId).toBeNull();
      expect(result.current.state.error).toBe("Failed to create");
    });
  });

  describe("remove", () => {
    it("should remove conversation from list", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { conversations: mockConversations, total: 2 },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { deleted: true },
            }),
        });

      const { result } = renderHook(() => useConversationHistory());

      await waitFor(() => {
        expect(result.current.state.conversations).toHaveLength(2);
      });

      let success;
      await act(async () => {
        success = await result.current.actions.remove("conv_1");
      });

      expect(success).toBe(true);
      expect(result.current.state.conversations).toHaveLength(1);
      expect(result.current.state.conversations[0].id).toBe("conv_2");
    });

    it("should clear selection when removing current conversation", async () => {
      (conversationStorage.restore as jest.Mock).mockReturnValue({
        conversationId: "conv_1",
        messages: [],
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { conversations: mockConversations, total: 2 },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { deleted: true },
            }),
        });

      const { result } = renderHook(() => useConversationHistory());

      await waitFor(() => {
        expect(result.current.state.conversations).toHaveLength(2);
      });

      expect(result.current.state.currentId).toBe("conv_1");

      await act(async () => {
        await result.current.actions.remove("conv_1");
      });

      expect(result.current.state.currentId).toBeNull();
      expect(conversationStorage.clear).toHaveBeenCalled();
    });
  });

  describe("loadMore", () => {
    it("should append more conversations", async () => {
      const moreConversations = [
        {
          id: "conv_3",
          title: "Test conversation 3",
          lastMessage: "More",
          messageCount: 1,
          lastIntent: null,
          createdAt: "2026-01-12T10:00:00Z",
          updatedAt: "2026-01-12T10:05:00Z",
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { conversations: mockConversations, total: 3 },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { conversations: moreConversations, total: 3 },
            }),
        });

      const { result } = renderHook(() => useConversationHistory());

      await waitFor(() => {
        expect(result.current.state.hasMore).toBe(true);
      });

      await act(async () => {
        await result.current.actions.loadMore();
      });

      expect(result.current.state.conversations).toHaveLength(3);
    });
  });

  describe("clearSelection", () => {
    it("should clear current selection", async () => {
      (conversationStorage.restore as jest.Mock).mockReturnValue({
        conversationId: "conv_1",
        messages: [],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { conversations: mockConversations, total: 2 },
          }),
      });

      const { result } = renderHook(() => useConversationHistory());

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      expect(result.current.state.currentId).toBe("conv_1");

      act(() => {
        result.current.actions.clearSelection();
      });

      expect(result.current.state.currentId).toBeNull();
      expect(result.current.state.currentDetail).toBeNull();
      expect(conversationStorage.clear).toHaveBeenCalled();
    });
  });
});
