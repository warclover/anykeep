/**
 * CrossSessionMemoryService 单元测试
 *
 * @since 2025-12-30
 */

import { CrossSessionMemoryService } from "../cross-session-memory-service";
import type {
  ConversationState,
  CurrentFocus,
  PreviousSessionSummary,
} from "../types";

// =============================================================================
// Mock Setup
// =============================================================================

const mockRpc = jest.fn();

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: mockRpc,
  }),
}));

jest.mock("@/lib/ai-agent/config/feature-flags", () => ({
  FeatureFlags: {
    ENABLE_CROSS_SESSION_MEMORY: true,
    ENABLE_LLM_SESSION_SUMMARY: false,
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

// =============================================================================
// Test Helpers
// =============================================================================

function createMockConversationState(
  overrides: Partial<ConversationState> = {},
): ConversationState {
  return {
    conversationId: "conv-123",
    userId: "user-456",
    messages: [
      {
        id: "msg-1",
        role: "user",
        content: "帮我找一下关于 React 的文章",
        timestamp: Date.now() - 60000,
        intentType: "search",
        subType: "semantic",
      },
      {
        id: "msg-2",
        role: "assistant",
        content: "找到了 5 篇关于 React 的文章",
        timestamp: Date.now() - 30000,
      },
    ],
    mentionedBookmarks: [
      {
        type: "bookmark",
        id: 1,
        name: "React 入门教程",
        mentionedAt: Date.now() - 30000,
      },
      {
        type: "bookmark",
        id: 2,
        name: "React Hooks 详解",
        mentionedAt: Date.now() - 20000,
      },
    ],
    mentionedFolders: [
      {
        type: "folder",
        id: 10,
        name: "前端技术",
        mentionedAt: Date.now() - 25000,
      },
    ],
    mentionedTags: [
      {
        type: "tag",
        id: "react",
        name: "React",
        mentionedAt: Date.now() - 30000,
      },
      {
        type: "tag",
        id: "frontend",
        name: "前端",
        mentionedAt: Date.now() - 28000,
      },
    ],
    createdAt: Date.now() - 120000,
    lastActivityAt: Date.now(),
    ...overrides,
  };
}

function resetMocks() {
  jest.clearAllMocks();
  mockRpc.mockReset();
}

// =============================================================================
// Tests
// =============================================================================

describe("CrossSessionMemoryService", () => {
  let service: CrossSessionMemoryService;

  beforeEach(() => {
    resetMocks();
    service = new CrossSessionMemoryService();
  });

  // ===========================================================================
  // Constructor Tests
  // ===========================================================================

  describe("constructor", () => {
    it("should create service with default config", () => {
      const service = new CrossSessionMemoryService();
      expect(service).toBeDefined();
    });

    it("should merge custom config with defaults", () => {
      const service = new CrossSessionMemoryService({
        maxSummaryLength: 1000,
        maxTopics: 10,
      });
      expect(service).toBeDefined();
    });
  });

  // ===========================================================================
  // getCrossSessionMemory Tests
  // ===========================================================================

  describe("getCrossSessionMemory", () => {
    it("should return empty object when no previous session exists", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const result = await service.getCrossSessionMemory("user-123");

      expect(result).toEqual({});
    });

    it("should return previous session data when available", async () => {
      const mockSummary: PreviousSessionSummary = {
        conversationId: "old-conv",
        summary: "讨论了 React 相关内容",
        mainTopics: ["React", "前端"],
        keyEntities: {
          bookmarkIds: [1, 2],
          tagNames: ["React"],
          folderIds: [10],
        },
        endedAt: new Date().toISOString(),
        messageCount: 5,
      };

      const mockFocus: CurrentFocus = {
        primaryTopic: "React",
        secondaryTopics: ["TypeScript"],
        focusedEntityIds: [1],
        updatedAt: new Date().toISOString(),
      };

      mockRpc.mockResolvedValue({
        data: [
          {
            conversation_id: "old-conv",
            previous_session_summary: mockSummary,
            current_focus: mockFocus,
            updated_at: new Date().toISOString(),
          },
        ],
        error: null,
      });

      const result = await service.getCrossSessionMemory(
        "user-123",
        "new-conv",
      );

      expect(result.previousSessionSummary).toEqual(mockSummary);
      expect(result.currentFocus).toEqual(mockFocus);
    });

    it("should handle RPC errors gracefully", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "RPC error" },
      });

      const result = await service.getCrossSessionMemory("user-123");

      expect(result).toEqual({});
    });

    it("should exclude current conversation ID from query", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      await service.getCrossSessionMemory("user-123", "current-conv");

      expect(mockRpc).toHaveBeenCalledWith("get_last_session_summary", {
        p_user_id: "user-123",
        p_exclude_conversation_id: "current-conv",
      });
    });
  });

  // ===========================================================================
  // saveSessionSummary Tests
  // ===========================================================================

  describe("saveSessionSummary", () => {
    it("should save session summary successfully", async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });
      const state = createMockConversationState();

      const result = await service.saveSessionSummary(
        "user-123",
        "conv-456",
        state,
      );

      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith(
        "update_session_cross_memory",
        expect.objectContaining({
          p_user_id: "user-123",
          p_conversation_id: "conv-456",
        }),
      );
    });

    it("should return false on RPC error", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "RPC error" },
      });
      const state = createMockConversationState();

      const result = await service.saveSessionSummary(
        "user-123",
        "conv-456",
        state,
      );

      expect(result).toBe(false);
    });

    it("should extract topics from messages", async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });
      const state = createMockConversationState({
        messages: [
          {
            id: "msg-1",
            role: "user",
            content: "搜索",
            timestamp: Date.now(),
            intentType: "search",
            subType: "semantic",
          },
        ],
      });

      await service.saveSessionSummary("user-123", "conv-456", state);

      expect(mockRpc).toHaveBeenCalledWith(
        "update_session_cross_memory",
        expect.objectContaining({
          p_previous_summary: expect.objectContaining({
            mainTopics: expect.arrayContaining(["search", "semantic"]),
          }),
        }),
      );
    });

    it("should extract key entities correctly", async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });
      const state = createMockConversationState();

      await service.saveSessionSummary("user-123", "conv-456", state);

      expect(mockRpc).toHaveBeenCalledWith(
        "update_session_cross_memory",
        expect.objectContaining({
          p_previous_summary: expect.objectContaining({
            keyEntities: expect.objectContaining({
              bookmarkIds: [1, 2],
              tagNames: ["React", "前端"],
              folderIds: [10],
            }),
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // updateCurrentFocus Tests
  // ===========================================================================

  describe("updateCurrentFocus", () => {
    it("should update current focus successfully", async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const focus: CurrentFocus = {
        primaryTopic: "React",
        secondaryTopics: ["TypeScript"],
        focusedEntityIds: [1, 2],
        updatedAt: new Date().toISOString(),
      };

      const result = await service.updateCurrentFocus(
        "user-123",
        "conv-456",
        focus,
      );

      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith(
        "update_session_cross_memory",
        expect.objectContaining({
          p_user_id: "user-123",
          p_conversation_id: "conv-456",
          p_previous_summary: null,
          p_current_focus: focus,
        }),
      );
    });

    it("should return false on RPC error", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "RPC error" },
      });

      const focus: CurrentFocus = {
        primaryTopic: "React",
        secondaryTopics: [],
        focusedEntityIds: [],
        updatedAt: new Date().toISOString(),
      };

      const result = await service.updateCurrentFocus(
        "user-123",
        "conv-456",
        focus,
      );

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // recordIntent Tests
  // ===========================================================================

  describe("recordIntent", () => {
    it("should record intent successfully", async () => {
      mockRpc.mockResolvedValue({ data: "intent-id-123", error: null });

      const result = await service.recordIntent("user-123", "search", {
        subType: "semantic",
        confidence: 0.9,
        success: true,
        messagePreview: "帮我找一下",
      });

      expect(result).toBe("intent-id-123");
      expect(mockRpc).toHaveBeenCalledWith(
        "record_intent_history",
        expect.objectContaining({
          p_user_id: "user-123",
          p_intent_type: "search",
          p_intent_sub_type: "semantic",
          p_confidence: 0.9,
        }),
      );
    });

    it("should return null on RPC error", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "RPC error" },
      });

      const result = await service.recordIntent("user-123", "search");

      expect(result).toBeNull();
    });

    it("should use default values for optional parameters", async () => {
      mockRpc.mockResolvedValue({ data: "intent-id", error: null });

      await service.recordIntent("user-123", "search");

      expect(mockRpc).toHaveBeenCalledWith(
        "record_intent_history",
        expect.objectContaining({
          p_intent_sub_type: undefined,
          p_confidence: undefined,
          p_success: true,
          p_message_preview: undefined,
          p_context: {},
        }),
      );
    });
  });

  // ===========================================================================
  // getIntentStats Tests
  // ===========================================================================

  describe("getIntentStats", () => {
    it("should return intent statistics", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            intent_type: "search",
            intent_sub_type: "semantic",
            count: 10,
            success_count: 9,
            avg_confidence: 0.85,
          },
          {
            intent_type: "action",
            intent_sub_type: "add_tag",
            count: 5,
            success_count: 5,
            avg_confidence: 0.95,
          },
        ],
        error: null,
      });

      const stats = await service.getIntentStats("user-123");

      expect(stats).toHaveLength(2);
      expect(stats[0]).toEqual({
        intentType: "search",
        intentSubType: "semantic",
        count: 10,
        successCount: 9,
        avgConfidence: 0.85,
      });
    });

    it("should return empty array on error", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "RPC error" },
      });

      const stats = await service.getIntentStats("user-123");

      expect(stats).toEqual([]);
    });

    it("should use custom days parameter", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      await service.getIntentStats("user-123", 60);

      expect(mockRpc).toHaveBeenCalledWith("get_intent_stats", {
        p_user_id: "user-123",
        p_days: 60,
      });
    });
  });

  // ===========================================================================
  // getTopIntents Tests
  // ===========================================================================

  describe("getTopIntents", () => {
    it("should return top N intents", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            intent_type: "a",
            intent_sub_type: null,
            count: 10,
            success_count: 10,
            avg_confidence: 0.9,
          },
          {
            intent_type: "b",
            intent_sub_type: null,
            count: 8,
            success_count: 8,
            avg_confidence: 0.9,
          },
          {
            intent_type: "c",
            intent_sub_type: null,
            count: 6,
            success_count: 6,
            avg_confidence: 0.9,
          },
          {
            intent_type: "d",
            intent_sub_type: null,
            count: 4,
            success_count: 4,
            avg_confidence: 0.9,
          },
          {
            intent_type: "e",
            intent_sub_type: null,
            count: 2,
            success_count: 2,
            avg_confidence: 0.9,
          },
        ],
        error: null,
      });

      const topIntents = await service.getTopIntents("user-123", 3);

      expect(topIntents).toHaveLength(3);
      expect(topIntents[0].intentType).toBe("a");
      expect(topIntents[2].intentType).toBe("c");
    });

    it("should use default limit of 5", async () => {
      mockRpc.mockResolvedValue({
        data: Array.from({ length: 10 }, (_, i) => ({
          intent_type: `type-${i}`,
          intent_sub_type: null,
          count: 10 - i,
          success_count: 10 - i,
          avg_confidence: 0.9,
        })),
        error: null,
      });

      const topIntents = await service.getTopIntents("user-123");

      expect(topIntents).toHaveLength(5);
    });
  });

  // ===========================================================================
  // inferCurrentFocus Tests
  // ===========================================================================

  describe("inferCurrentFocus", () => {
    it("should infer focus from recent messages", () => {
      const state = createMockConversationState();

      const focus = service.inferCurrentFocus(state);

      expect(focus.taskType).toBe("search");
      // semantic is the first topic added (from message.subType), so it becomes primaryTopic
      expect(focus.primaryTopic).toBe("semantic");
    });

    it("should extract focused entity IDs from mentioned bookmarks", () => {
      const state = createMockConversationState();

      const focus = service.inferCurrentFocus(state);

      expect(focus.focusedEntityIds).toContain(1);
      expect(focus.focusedEntityIds).toContain(2);
    });

    it("should include tag names in topics", () => {
      const state = createMockConversationState();

      const focus = service.inferCurrentFocus(state);

      expect(focus.secondaryTopics).toContain("React");
    });

    it("should have updatedAt timestamp", () => {
      const state = createMockConversationState();

      const focus = service.inferCurrentFocus(state);

      expect(focus.updatedAt).toBeDefined();
      expect(new Date(focus.updatedAt).getTime()).toBeLessThanOrEqual(
        Date.now(),
      );
    });

    it("should handle empty messages", () => {
      const state = createMockConversationState({
        messages: [],
        mentionedBookmarks: [],
        mentionedTags: [],
        mentionedFolders: [],
      });

      const focus = service.inferCurrentFocus(state);

      expect(focus.taskType).toBeUndefined();
      expect(focus.focusedEntityIds).toEqual([]);
    });
  });
});
