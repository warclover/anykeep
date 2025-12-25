/**
 * MemoryManager 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { MemoryManager } from "../index";
import { createMemoryManager } from "../index";

describe("MemoryManager", () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = createMemoryManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe("Session Management", () => {
    it("should create and retrieve session", () => {
      const state = manager.getOrCreateSession("conv-1", "user-1");

      expect(state).toBeDefined();
      expect(state.conversationId).toBe("conv-1");
      expect(state.userId).toBe("user-1");
    });

    it("should return existing session on subsequent calls", () => {
      const state1 = manager.getOrCreateSession("conv-1", "user-1");
      const state2 = manager.getOrCreateSession("conv-1", "user-1");

      expect(state1).toBe(state2);
    });

    it("should get session by ID", () => {
      manager.getOrCreateSession("conv-1", "user-1");

      const state = manager.getSession("conv-1");

      expect(state).toBeDefined();
      expect(state?.conversationId).toBe("conv-1");
    });

    it("should return undefined for non-existent session", () => {
      const state = manager.getSession("non-existent");

      expect(state).toBeUndefined();
    });

    it("should delete session", () => {
      manager.getOrCreateSession("conv-1", "user-1");

      const deleted = manager.deleteSession("conv-1");

      expect(deleted).toBe(true);
      expect(manager.getSession("conv-1")).toBeUndefined();
    });
  });

  describe("Message Recording", () => {
    it("should record user message", () => {
      manager.getOrCreateSession("conv-1", "user-1");

      manager.recordUserMessage("conv-1", "user-1", "Hello", "greeting");

      const messages = manager.getRecentMessages("conv-1");
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toBe("Hello");
      expect(messages[0].intentType).toBe("greeting");
    });

    it("should record assistant message", () => {
      manager.getOrCreateSession("conv-1", "user-1");

      manager.recordAssistantMessage("conv-1", "Hi there!", "greeting");

      const messages = manager.getRecentMessages("conv-1");
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe("assistant");
      expect(messages[0].content).toBe("Hi there!");
    });

    it("should not record when autoRecording disabled", () => {
      const disabledManager = createMemoryManager({
        enableAutoRecording: false,
      });
      disabledManager.getOrCreateSession("conv-1", "user-1");

      disabledManager.recordUserMessage("conv-1", "user-1", "Hello");

      const messages = disabledManager.getRecentMessages("conv-1");
      expect(messages.length).toBe(0);

      disabledManager.destroy();
    });
  });

  describe("Output Recording", () => {
    it("should record output summary", () => {
      manager.getOrCreateSession("conv-1", "user-1");

      manager.recordOutput("conv-1", {
        type: "text",
        summary: "Found 5 bookmarks",
        relatedEntityIds: [1, 2, 3],
        outputAt: Date.now(),
      });

      const output = manager.getLastOutput("conv-1");
      expect(output).toBeDefined();
      expect(output?.summary).toBe("Found 5 bookmarks");
      expect(output?.relatedEntityIds).toEqual([1, 2, 3]);
    });

    it("should record search results", () => {
      manager.getOrCreateSession("conv-1", "user-1");

      manager.recordSearchResults("conv-1", "AI articles", [10, 20, 30]);

      const results = manager.getLastSearchResults("conv-1");
      expect(results).toBeDefined();
      expect(results?.query).toBe("AI articles");
      expect(results?.resultIds).toEqual([10, 20, 30]);
    });
  });

  describe("Entity Mention Recording", () => {
    it("should record mentioned bookmarks", () => {
      manager.getOrCreateSession("conv-1", "user-1");

      manager.recordMentionedBookmarks("conv-1", [
        { id: 1, name: "AI Guide" },
        { id: 2, name: "ML Tutorial" },
      ]);

      const bookmarks = manager.getMentionedBookmarks("conv-1");
      expect(bookmarks.length).toBe(2);
      expect(bookmarks[0].name).toBe("AI Guide");
    });

    it("should record mentioned folders", () => {
      manager.getOrCreateSession("conv-1", "user-1");

      manager.recordMentionedFolders("conv-1", [{ id: 1, name: "Work" }]);

      const folders = manager.getMentionedFolders("conv-1");
      expect(folders.length).toBe(1);
      expect(folders[0].name).toBe("Work");
    });
  });

  describe("Reference Resolution", () => {
    it("should resolve references when enabled", () => {
      const _state = manager.getOrCreateSession("conv-1", "user-1");

      // Add some context
      manager.recordSearchResults("conv-1", "test", [1, 2, 3]);

      const result = manager.resolveReferences("导出这些内容", "conv-1");

      expect(result).not.toBeNull();
      expect(result?.references.length).toBeGreaterThan(0);
    });

    it("should detect references", () => {
      expect(manager.hasReferences("刚才的内容")).toBe(true);
      expect(manager.hasReferences("搜索AI")).toBe(false);
    });

    it("should preprocess input", () => {
      manager.getOrCreateSession("conv-1", "user-1");
      manager.recordSearchResults("conv-1", "test", [1, 2]);

      const { processedInput, hasChanges, resolution } =
        manager.preprocessInput("导出这些内容", "conv-1");

      expect(hasChanges).toBe(true);
      expect(processedInput).not.toBe("导出这些内容");
      expect(resolution).not.toBeNull();
    });

    it("should return null when resolution disabled", () => {
      const disabledManager = createMemoryManager({
        enableReferenceResolution: false,
      });
      disabledManager.getOrCreateSession("conv-1", "user-1");

      const result = disabledManager.resolveReferences("刚才的", "conv-1");

      expect(result).toBeNull();

      disabledManager.destroy();
    });
  });

  describe("Context Summary", () => {
    it("should generate context summary with search results", () => {
      manager.getOrCreateSession("conv-1", "user-1");
      manager.recordSearchResults("conv-1", "AI articles", [1, 2, 3]);

      const summary = manager.generateContextSummary("conv-1");

      expect(summary).not.toBeNull();
      expect(summary).toContain("AI articles");
      expect(summary).toContain("3");
    });

    it("should generate context summary with output", () => {
      manager.getOrCreateSession("conv-1", "user-1");
      manager.recordOutput("conv-1", {
        type: "text",
        summary: "Generated report",
        outputAt: Date.now(),
      });

      const summary = manager.generateContextSummary("conv-1");

      expect(summary).not.toBeNull();
      expect(summary).toContain("Generated report");
    });

    it("should generate context summary with bookmarks", () => {
      manager.getOrCreateSession("conv-1", "user-1");
      manager.recordMentionedBookmarks("conv-1", [{ id: 1, name: "AI Guide" }]);

      const summary = manager.generateContextSummary("conv-1");

      expect(summary).not.toBeNull();
      expect(summary).toContain("AI Guide");
    });

    it("should return null for empty session", () => {
      manager.getOrCreateSession("conv-1", "user-1");

      const summary = manager.generateContextSummary("conv-1");

      expect(summary).toBeNull();
    });

    it("should return null for non-existent session", () => {
      const summary = manager.generateContextSummary("non-existent");

      expect(summary).toBeNull();
    });
  });

  describe("Session Cleanup", () => {
    it("should get active session count", () => {
      manager.getOrCreateSession("conv-1", "user-1");
      manager.getOrCreateSession("conv-2", "user-2");

      expect(manager.getActiveSessionCount()).toBe(2);
    });

    it("should cleanup expired sessions", () => {
      // Create manager with very short expiry
      const shortExpiryManager = createMemoryManager({
        sessionMemory: {
          sessionExpiryMs: 1, // 1ms expiry
          cleanupIntervalMs: 1000000, // Disable auto cleanup
        },
      });

      shortExpiryManager.getOrCreateSession("conv-1", "user-1");

      // Wait for expiry
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const cleaned = shortExpiryManager.cleanup();
          expect(cleaned).toBe(1);
          expect(shortExpiryManager.getActiveSessionCount()).toBe(0);
          shortExpiryManager.destroy();
          resolve();
        }, 10);
      });
    });
  });

  describe("Configuration", () => {
    it("should return config", () => {
      const config = manager.getConfig();

      expect(config.enableReferenceResolution).toBe(true);
      expect(config.enableAutoRecording).toBe(true);
    });

    it("should apply custom config", () => {
      const customManager = createMemoryManager({
        enableReferenceResolution: false,
        enableAutoRecording: false,
      });

      const config = customManager.getConfig();

      expect(config.enableReferenceResolution).toBe(false);
      expect(config.enableAutoRecording).toBe(false);

      customManager.destroy();
    });
  });
});
