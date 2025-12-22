/**
 * AgentMemory 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import { AgentMemory } from "../core/agent-memory";
import type { AgentMessage } from "../core/types";

describe("AgentMemory", () => {
  let memory: AgentMemory;

  beforeEach(() => {
    memory = new AgentMemory();
  });

  describe("createConversation", () => {
    it("should create a new conversation", () => {
      const conversation = memory.createConversation("user-123", "knowledge");

      expect(conversation).toBeDefined();
      expect(conversation.id).toBeDefined();
      expect(conversation.userId).toBe("user-123");
      expect(conversation.agentType).toBe("knowledge");
      expect(conversation.messages).toEqual([]);
      expect(conversation.createdAt).toBeInstanceOf(Date);
      expect(conversation.updatedAt).toBeInstanceOf(Date);
    });

    it("should create conversation with options", () => {
      const conversation = memory.createConversation("user-123", "knowledge", {
        title: "Test Conversation",
        contextBookmarkIds: [1, 2, 3],
        metadata: { key: "value" },
      });

      expect(conversation.title).toBe("Test Conversation");
      expect(conversation.contextBookmarkIds).toEqual([1, 2, 3]);
      expect(conversation.metadata).toEqual({ key: "value" });
    });

    it("should generate unique conversation ids", () => {
      const conv1 = memory.createConversation("user-123");
      const conv2 = memory.createConversation("user-123");

      expect(conv1.id).not.toBe(conv2.id);
    });
  });

  describe("getConversation", () => {
    it("should return conversation by id", () => {
      const created = memory.createConversation("user-123");
      const retrieved = memory.getConversation(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it("should return null for non-existent conversation", () => {
      const result = memory.getConversation("non-existent-id");

      expect(result).toBeNull();
    });
  });

  describe("addMessage", () => {
    it("should add message to conversation", () => {
      const conversation = memory.createConversation("user-123");
      const message: AgentMessage = {
        id: "msg-1",
        role: "user",
        content: "Hello",
        createdAt: new Date(),
      };

      memory.addMessage(conversation.id, message);

      const updated = memory.getConversation(conversation.id);
      expect(updated?.messages).toHaveLength(1);
      expect(updated?.messages[0].content).toBe("Hello");
    });

    it("should not add message to non-existent conversation", () => {
      const message: AgentMessage = {
        id: "msg-1",
        role: "user",
        content: "Hello",
        createdAt: new Date(),
      };

      // Should not throw
      memory.addMessage("non-existent-id", message);
    });

    it("should truncate messages when exceeding max", () => {
      const smallMemory = new AgentMemory({ maxMessages: 5 });
      const conversation = smallMemory.createConversation("user-123");

      // Add 10 messages
      for (let i = 0; i < 10; i++) {
        smallMemory.addMessage(conversation.id, {
          id: `msg-${i}`,
          role: "user",
          content: `Message ${i}`,
          createdAt: new Date(),
        });
      }

      const updated = smallMemory.getConversation(conversation.id);
      expect(updated?.messages.length).toBeLessThanOrEqual(5);
    });
  });

  describe("getMessages", () => {
    let conversation: ReturnType<typeof memory.createConversation>;

    beforeEach(() => {
      conversation = memory.createConversation("user-123");

      // Add various messages
      memory.addMessage(conversation.id, {
        id: "msg-1",
        role: "system",
        content: "System prompt",
        createdAt: new Date(),
      });
      memory.addMessage(conversation.id, {
        id: "msg-2",
        role: "user",
        content: "User message 1",
        createdAt: new Date(),
      });
      memory.addMessage(conversation.id, {
        id: "msg-3",
        role: "assistant",
        content: "Assistant response",
        createdAt: new Date(),
      });
      memory.addMessage(conversation.id, {
        id: "msg-4",
        role: "user",
        content: "User message 2",
        createdAt: new Date(),
      });
    });

    it("should return all messages by default", () => {
      const messages = memory.getMessages(conversation.id);

      expect(messages).toHaveLength(4);
    });

    it("should filter out system messages when requested", () => {
      const messages = memory.getMessages(conversation.id, {
        includeSystem: false,
      });

      expect(messages).toHaveLength(3);
      expect(messages.every((m) => m.role !== "system")).toBe(true);
    });

    it("should limit number of messages", () => {
      const messages = memory.getMessages(conversation.id, { limit: 2 });

      expect(messages).toHaveLength(2);
      // Should return most recent messages
      expect(messages[0].id).toBe("msg-3");
      expect(messages[1].id).toBe("msg-4");
    });

    it("should return empty array for non-existent conversation", () => {
      const messages = memory.getMessages("non-existent-id");

      expect(messages).toEqual([]);
    });
  });

  describe("updateTitle", () => {
    it("should update conversation title", () => {
      const conversation = memory.createConversation("user-123");

      memory.updateTitle(conversation.id, "New Title");

      const updated = memory.getConversation(conversation.id);
      expect(updated?.title).toBe("New Title");
    });

    it("should handle non-existent conversation gracefully", () => {
      // Should not throw
      memory.updateTitle("non-existent-id", "Title");
    });
  });

  describe("clearConversation", () => {
    it("should remove conversation from memory", () => {
      const conversation = memory.createConversation("user-123");

      memory.clearConversation(conversation.id);

      const result = memory.getConversation(conversation.id);
      expect(result).toBeNull();
    });
  });

  describe("getUserConversations", () => {
    it("should return all conversations for a user", () => {
      memory.createConversation("user-123");
      memory.createConversation("user-123");
      memory.createConversation("user-456");

      const conversations = memory.getUserConversations("user-123");

      expect(conversations).toHaveLength(2);
    });

    it("should return conversations sorted by updated time", () => {
      const conv1 = memory.createConversation("user-123");

      // Wait a bit to ensure different timestamps
      const _conv2 = memory.createConversation("user-123");

      // Update conv1 to make it more recent
      memory.addMessage(conv1.id, {
        id: "msg-1",
        role: "user",
        content: "Update",
        createdAt: new Date(),
      });

      const conversations = memory.getUserConversations("user-123");

      // conv1 should be first (most recently updated)
      expect(conversations[0].id).toBe(conv1.id);
    });

    it("should return empty array for user with no conversations", () => {
      const conversations = memory.getUserConversations("no-conversations");

      expect(conversations).toEqual([]);
    });
  });

  describe("estimateTokens", () => {
    it("should estimate token count for messages", () => {
      const messages: AgentMessage[] = [
        {
          id: "1",
          role: "user",
          content: "Hello, world!",
          createdAt: new Date(),
        },
        {
          id: "2",
          role: "assistant",
          content: "Hi there!",
          createdAt: new Date(),
        },
      ];

      const tokens = memory.estimateTokens(messages);

      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe("number");
    });

    it("should include tool calls in estimation", () => {
      const messagesWithTools: AgentMessage[] = [
        {
          id: "1",
          role: "assistant",
          content: "Let me search that.",
          toolCalls: [
            {
              id: "tc-1",
              toolName: "search",
              args: { query: "test" },
              status: "completed",
            },
          ],
          createdAt: new Date(),
        },
      ];

      const messagesWithoutTools: AgentMessage[] = [
        {
          id: "1",
          role: "assistant",
          content: "Let me search that.",
          createdAt: new Date(),
        },
      ];

      const tokensWithTools = memory.estimateTokens(messagesWithTools);
      const tokensWithoutTools = memory.estimateTokens(messagesWithoutTools);

      expect(tokensWithTools).toBeGreaterThan(tokensWithoutTools);
    });
  });

  describe("cleanup", () => {
    it("should remove expired conversations", async () => {
      const conversation = memory.createConversation("user-123");

      // Force last access time to be old
      // Access internal cache for testing (not ideal but necessary)
      const cache = (memory as unknown as { cache: Map<string, unknown> })
        .cache;
      const cached = cache.get(conversation.id) as { lastAccessedAt: Date };
      cached.lastAccessedAt = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      const cleaned = memory.cleanup(30 * 60 * 1000); // 30 minutes max age

      expect(cleaned).toBe(1);
      expect(memory.getConversation(conversation.id)).toBeNull();
    });

    it("should not remove recent conversations", () => {
      memory.createConversation("user-123");

      const cleaned = memory.cleanup(30 * 60 * 1000); // 30 minutes max age

      expect(cleaned).toBe(0);
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", () => {
      const conv1 = memory.createConversation("user-123");
      const conv2 = memory.createConversation("user-123");

      memory.addMessage(conv1.id, {
        id: "msg-1",
        role: "user",
        content: "Hello",
        createdAt: new Date(),
      });
      memory.addMessage(conv1.id, {
        id: "msg-2",
        role: "assistant",
        content: "Hi",
        createdAt: new Date(),
      });
      memory.addMessage(conv2.id, {
        id: "msg-3",
        role: "user",
        content: "Test",
        createdAt: new Date(),
      });

      const stats = memory.getStats();

      expect(stats.totalConversations).toBe(2);
      expect(stats.totalMessages).toBe(3);
      expect(stats.estimatedTokens).toBeGreaterThan(0);
    });
  });
});
