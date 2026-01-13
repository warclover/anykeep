/**
 * 对话持久化存储模块单元测试
 *
 * @module @/lib/storage/__tests__/conversation-storage.test
 * @version 1.0.0
 * @since 2026-01-13
 */

import {
  conversationStorage,
  type StoredSession,
} from "../conversation-storage";
import type { ChatMessage } from "@/hooks/domain/ai/use-ai-chat";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("conversationStorage", () => {
  // 测试数据
  const mockMessages: ChatMessage[] = [
    {
      id: "msg_1",
      role: "user",
      content: "Hello AI",
      createdAt: new Date("2026-01-13T10:00:00Z"),
    },
    {
      id: "msg_2",
      role: "assistant",
      content: "Hello! How can I help you?",
      createdAt: new Date("2026-01-13T10:00:05Z"),
    },
  ];

  const mockConversationId = "conv_test_123";

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  describe("save", () => {
    it("should save session to localStorage", () => {
      conversationStorage.save(mockConversationId, mockMessages);

      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
      const savedData = JSON.parse(
        localStorageMock.setItem.mock.calls[0][1],
      ) as StoredSession;

      expect(savedData.conversationId).toBe(mockConversationId);
      expect(savedData.messages).toHaveLength(2);
      expect(savedData.messages[0].content).toBe("Hello AI");
    });

    it("should limit messages to MAX_MESSAGES (50)", () => {
      const manyMessages: ChatMessage[] = Array.from(
        { length: 100 },
        (_, i) => ({
          id: `msg_${i}`,
          role: i % 2 === 0 ? "user" : "assistant",
          content: `Message ${i}`,
          createdAt: new Date(),
        }),
      );

      conversationStorage.save(mockConversationId, manyMessages);

      const savedData = JSON.parse(
        localStorageMock.setItem.mock.calls[0][1],
      ) as StoredSession;

      expect(savedData.messages).toHaveLength(50);
      // Should keep the last 50 messages
      expect(savedData.messages[0].content).toBe("Message 50");
      expect(savedData.messages[49].content).toBe("Message 99");
    });

    it("should handle localStorage full error gracefully", () => {
      const error = new Error("QuotaExceededError");
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw error;
      });

      // Should not throw
      expect(() =>
        conversationStorage.save(mockConversationId, mockMessages),
      ).not.toThrow();

      // Should attempt to clear old data
      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });

    it("should not save in SSR environment", () => {
      // Simulate SSR by temporarily making window undefined
      const originalWindow = global.window;
      // @ts-expect-error - testing SSR
      delete global.window;

      conversationStorage.save(mockConversationId, mockMessages);

      expect(localStorageMock.setItem).not.toHaveBeenCalled();

      // Restore window
      global.window = originalWindow;
    });
  });

  describe("restore", () => {
    it("should restore valid session from localStorage", () => {
      const storedSession: StoredSession = {
        conversationId: mockConversationId,
        messages: mockMessages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      localStorageMock.getItem.mockReturnValueOnce(
        JSON.stringify(storedSession),
      );

      const restored = conversationStorage.restore();

      expect(restored).not.toBeNull();
      expect(restored?.conversationId).toBe(mockConversationId);
      expect(restored?.messages).toHaveLength(2);
    });

    it("should return null when no session exists", () => {
      localStorageMock.getItem.mockReturnValueOnce(null);

      const restored = conversationStorage.restore();

      expect(restored).toBeNull();
    });

    it("should return null and clear expired session (>24 hours)", () => {
      const expiredSession: StoredSession = {
        conversationId: mockConversationId,
        messages: mockMessages,
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
        updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      };

      localStorageMock.getItem.mockReturnValueOnce(
        JSON.stringify(expiredSession),
      );

      const restored = conversationStorage.restore();

      expect(restored).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });

    it("should return null and clear invalid JSON data", () => {
      localStorageMock.getItem.mockReturnValueOnce("invalid json {{{");

      const restored = conversationStorage.restore();

      expect(restored).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });

    it("should return null and clear session with missing fields", () => {
      const invalidSession = {
        // Missing conversationId and messages
        createdAt: new Date().toISOString(),
      };

      localStorageMock.getItem.mockReturnValueOnce(
        JSON.stringify(invalidSession),
      );

      const restored = conversationStorage.restore();

      expect(restored).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });

    it("should not restore in SSR environment", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing SSR
      delete global.window;

      const restored = conversationStorage.restore();

      expect(restored).toBeNull();
      expect(localStorageMock.getItem).not.toHaveBeenCalled();

      global.window = originalWindow;
    });
  });

  describe("clear", () => {
    it("should remove session from localStorage", () => {
      conversationStorage.clear();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        "anykeep_ai_current_session",
      );
    });

    it("should not throw in SSR environment", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing SSR
      delete global.window;

      expect(() => conversationStorage.clear()).not.toThrow();

      global.window = originalWindow;
    });
  });

  describe("updateConversationId", () => {
    it("should update conversationId in existing session", () => {
      const storedSession: StoredSession = {
        conversationId: "old_conv_id",
        messages: mockMessages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      localStorageMock.getItem.mockReturnValueOnce(
        JSON.stringify(storedSession),
      );

      conversationStorage.updateConversationId("new_conv_id");

      const savedData = JSON.parse(
        localStorageMock.setItem.mock.calls[0][1],
      ) as StoredSession;

      expect(savedData.conversationId).toBe("new_conv_id");
    });

    it("should not update if no session exists", () => {
      localStorageMock.getItem.mockReturnValueOnce(null);

      conversationStorage.updateConversationId("new_conv_id");

      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe("hasSession", () => {
    it("should return true when valid session exists", () => {
      const storedSession: StoredSession = {
        conversationId: mockConversationId,
        messages: mockMessages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      localStorageMock.getItem.mockReturnValueOnce(
        JSON.stringify(storedSession),
      );

      expect(conversationStorage.hasSession()).toBe(true);
    });

    it("should return false when no session exists", () => {
      localStorageMock.getItem.mockReturnValueOnce(null);

      expect(conversationStorage.hasSession()).toBe(false);
    });
  });

  describe("getStorageKey", () => {
    it("should return the storage key", () => {
      expect(conversationStorage.getStorageKey()).toBe(
        "anykeep_ai_current_session",
      );
    });
  });
});
