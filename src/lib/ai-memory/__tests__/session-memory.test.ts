/**
 * SessionMemory 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { SessionMemory } from "../index";
import {
  createSessionMemory,
  type ConversationMessage,
  type MentionedEntity,
  type SearchResultSummary,
  type LastOutputSummary,
} from "../index";

describe("SessionMemory", () => {
  let memory: SessionMemory;

  beforeEach(() => {
    memory = createSessionMemory({
      maxMessageHistory: 5,
      maxMentionedEntities: 3,
      sessionExpiryMs: 1000, // 1 秒过期（测试用）
      cleanupIntervalMs: 60000, // 禁用自动清理
    });
  });

  afterEach(() => {
    memory.destroy();
  });

  describe("Session CRUD", () => {
    it("should create a new session state", () => {
      const state = memory.createState("conv-1", "user-1");

      expect(state).toBeDefined();
      expect(state.conversationId).toBe("conv-1");
      expect(state.userId).toBe("user-1");
      expect(state.messages).toEqual([]);
      expect(state.mentionedBookmarks).toEqual([]);
      expect(state.mentionedFolders).toEqual([]);
      expect(state.mentionedTags).toEqual([]);
    });

    it("should get existing session state", () => {
      memory.createState("conv-1", "user-1");

      const state = memory.getState("conv-1");

      expect(state).toBeDefined();
      expect(state?.conversationId).toBe("conv-1");
    });

    it("should return undefined for non-existent session", () => {
      const state = memory.getState("non-existent");

      expect(state).toBeUndefined();
    });

    it("should get or create session state", () => {
      // 不存在时创建
      const state1 = memory.getOrCreateState("conv-1", "user-1");
      expect(state1.conversationId).toBe("conv-1");

      // 存在时获取
      const state2 = memory.getOrCreateState("conv-1", "user-1");
      expect(state2).toBe(state1);
    });

    it("should update session state", () => {
      memory.createState("conv-1", "user-1");

      const updated = memory.updateState("conv-1", {
        metadata: { foo: "bar" },
      });

      expect(updated?.metadata).toEqual({ foo: "bar" });
    });

    it("should delete session state", () => {
      memory.createState("conv-1", "user-1");

      const deleted = memory.deleteState("conv-1");
      expect(deleted).toBe(true);

      const state = memory.getState("conv-1");
      expect(state).toBeUndefined();
    });

    it("should return false when deleting non-existent session", () => {
      const deleted = memory.deleteState("non-existent");
      expect(deleted).toBe(false);
    });
  });

  describe("Message Recording", () => {
    const createMessage = (
      id: string,
      role: "user" | "assistant",
      content: string,
    ): ConversationMessage => ({
      id,
      role,
      content,
      timestamp: Date.now(),
    });

    it("should add message to history", () => {
      memory.createState("conv-1", "user-1");

      const message = createMessage("msg-1", "user", "Hello");
      memory.addMessage("conv-1", message);

      const state = memory.getState("conv-1");
      expect(state?.messages.length).toBe(1);
      expect(state?.messages[0].content).toBe("Hello");
    });

    it("should limit message history to max count", () => {
      memory.createState("conv-1", "user-1");

      // 添加 7 条消息（超过 maxMessageHistory: 5）
      for (let i = 1; i <= 7; i++) {
        memory.addMessage(
          "conv-1",
          createMessage(`msg-${i}`, "user", `Msg ${i}`),
        );
      }

      const state = memory.getState("conv-1");
      expect(state?.messages.length).toBe(5);
      // 应该保留最后 5 条
      expect(state?.messages[0].content).toBe("Msg 3");
      expect(state?.messages[4].content).toBe("Msg 7");
    });

    it("should get recent messages", () => {
      memory.createState("conv-1", "user-1");

      for (let i = 1; i <= 5; i++) {
        memory.addMessage(
          "conv-1",
          createMessage(`msg-${i}`, "user", `Msg ${i}`),
        );
      }

      const recent = memory.getRecentMessages("conv-1", 2);
      expect(recent.length).toBe(2);
      expect(recent[0].content).toBe("Msg 4");
      expect(recent[1].content).toBe("Msg 5");
    });

    it("should return empty array for non-existent session", () => {
      const messages = memory.getRecentMessages("non-existent");
      expect(messages).toEqual([]);
    });
  });

  describe("Output Recording", () => {
    it("should record last output", () => {
      memory.createState("conv-1", "user-1");

      const output: LastOutputSummary = {
        type: "text",
        summary: "Found 5 bookmarks",
        outputAt: Date.now(),
      };

      memory.recordOutput("conv-1", output);

      const lastOutput = memory.getLastOutput("conv-1");
      expect(lastOutput).toEqual(output);
    });

    it("should return undefined for non-existent session", () => {
      const output = memory.getLastOutput("non-existent");
      expect(output).toBeUndefined();
    });
  });

  describe("Search Results Recording", () => {
    it("should record search results", () => {
      memory.createState("conv-1", "user-1");

      const results: SearchResultSummary = {
        query: "AI articles",
        resultCount: 3,
        resultIds: [1, 2, 3],
        searchedAt: Date.now(),
      };

      memory.recordSearchResults("conv-1", results);

      const lastResults = memory.getLastSearchResults("conv-1");
      expect(lastResults).toEqual(results);
    });
  });

  describe("Entity Mentions Recording", () => {
    const createBookmarkEntity = (
      id: number,
      name: string,
    ): MentionedEntity => ({
      type: "bookmark",
      id,
      name,
      mentionedAt: Date.now(),
    });

    const createFolderEntity = (id: number, name: string): MentionedEntity => ({
      type: "folder",
      id,
      name,
      mentionedAt: Date.now(),
    });

    it("should record mentioned bookmarks", () => {
      memory.createState("conv-1", "user-1");

      const bookmarks = [
        createBookmarkEntity(1, "Article 1"),
        createBookmarkEntity(2, "Article 2"),
      ];

      memory.recordMentionedBookmarks("conv-1", bookmarks);

      const mentioned = memory.getMentionedBookmarks("conv-1");
      expect(mentioned.length).toBe(2);
    });

    it("should deduplicate bookmarks", () => {
      memory.createState("conv-1", "user-1");

      memory.recordMentionedBookmarks("conv-1", [
        createBookmarkEntity(1, "Article 1"),
      ]);
      memory.recordMentionedBookmarks("conv-1", [
        createBookmarkEntity(1, "Article 1 Updated"),
        createBookmarkEntity(2, "Article 2"),
      ]);

      const mentioned = memory.getMentionedBookmarks("conv-1");
      expect(mentioned.length).toBe(2);
      // 应该保留原来的 ID=1
      expect(mentioned[0].name).toBe("Article 1");
    });

    it("should limit mentioned entities to max count", () => {
      memory.createState("conv-1", "user-1");

      // 添加 5 个书签（超过 maxMentionedEntities: 3）
      const bookmarks = [1, 2, 3, 4, 5].map((i) =>
        createBookmarkEntity(i, `Article ${i}`),
      );

      memory.recordMentionedBookmarks("conv-1", bookmarks);

      const mentioned = memory.getMentionedBookmarks("conv-1");
      expect(mentioned.length).toBe(3);
      // 应该保留最后 3 个
      expect(mentioned[0].id).toBe(3);
      expect(mentioned[2].id).toBe(5);
    });

    it("should record mentioned folders", () => {
      memory.createState("conv-1", "user-1");

      memory.recordMentionedFolders("conv-1", [
        createFolderEntity(1, "Work"),
        createFolderEntity(2, "Personal"),
      ]);

      const folders = memory.getMentionedFolders("conv-1");
      expect(folders.length).toBe(2);
    });

    it("should get recent mentioned bookmarks with limit", () => {
      memory.createState("conv-1", "user-1");

      memory.recordMentionedBookmarks("conv-1", [
        createBookmarkEntity(1, "Article 1"),
        createBookmarkEntity(2, "Article 2"),
        createBookmarkEntity(3, "Article 3"),
      ]);

      const recent = memory.getMentionedBookmarks("conv-1", 2);
      expect(recent.length).toBe(2);
      expect(recent[0].id).toBe(2);
      expect(recent[1].id).toBe(3);
    });
  });

  describe("Session Expiry", () => {
    it("should expire session after timeout", async () => {
      memory.createState("conv-1", "user-1");

      // 等待过期（1 秒）
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const state = memory.getState("conv-1");
      expect(state).toBeUndefined();
    });

    it("should not expire active session", async () => {
      memory.createState("conv-1", "user-1");

      // 等待 500ms
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 更新活动时间
      memory.updateState("conv-1", {});

      // 再等待 600ms（总共 1.1 秒，但活动时间只过了 600ms）
      await new Promise((resolve) => setTimeout(resolve, 600));

      const state = memory.getState("conv-1");
      expect(state).toBeDefined();
    });

    it("should cleanup expired sessions", async () => {
      memory.createState("conv-1", "user-1");
      memory.createState("conv-2", "user-1");

      // 等待过期
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const cleaned = memory.cleanup();
      expect(cleaned).toBe(2);
      expect(memory.getActiveSessionCount()).toBe(0);
    });
  });

  describe("Statistics", () => {
    it("should get active session count", () => {
      memory.createState("conv-1", "user-1");
      memory.createState("conv-2", "user-2");

      expect(memory.getActiveSessionCount()).toBe(2);
    });

    it("should get all session IDs", () => {
      memory.createState("conv-1", "user-1");
      memory.createState("conv-2", "user-2");

      const ids = memory.getAllSessionIds();
      expect(ids).toContain("conv-1");
      expect(ids).toContain("conv-2");
    });

    it("should clear all sessions", () => {
      memory.createState("conv-1", "user-1");
      memory.createState("conv-2", "user-2");

      memory.clearAll();

      expect(memory.getActiveSessionCount()).toBe(0);
    });
  });

  describe("Configuration", () => {
    it("should use custom config", () => {
      const customMemory = createSessionMemory({
        maxMessageHistory: 10,
        maxMentionedEntities: 5,
      });

      const config = customMemory.getConfig();
      expect(config.maxMessageHistory).toBe(10);
      expect(config.maxMentionedEntities).toBe(5);

      customMemory.destroy();
    });
  });
});
