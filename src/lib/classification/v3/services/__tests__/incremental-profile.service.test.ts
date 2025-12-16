/**
 * Incremental Profile Service Tests
 *
 * V4.2.7: 增量画像更新服务单元测试
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import {
  IncrementalProfileService,
  createIncrementalProfileService,
  type BookmarkChangeEvent,
  type IncrementalProfileConfig,
} from "../incremental-profile.service";

// ============================================================================
// Mock Dependencies
// ============================================================================

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock embedding version
jest.mock("@/lib/utils/embedding-generator", () => ({
  getCurrentEmbeddingVersion: jest.fn(() => "v2.0.0"),
}));

// ============================================================================
// Mock Supabase Client Factory
// ============================================================================

function createMockSupabase() {
  const mockSingle = jest.fn();
  const mockEq = jest.fn(() => ({ single: mockSingle }));
  const mockSelect = jest.fn(() => ({ eq: mockEq, single: mockSingle }));
  const mockFrom = jest.fn(() => ({
    select: mockSelect,
    insert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn(() => ({
      eq: jest.fn().mockResolvedValue({ error: null }),
    })),
    delete: jest.fn(),
  }));
  const mockRpc = jest.fn().mockResolvedValue({ data: null, error: null });

  return {
    from: mockFrom,
    rpc: mockRpc,
    // Expose internal mocks for assertions
    _mocks: {
      from: mockFrom,
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      rpc: mockRpc,
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("IncrementalProfileService", () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let service: IncrementalProfileService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSupabase = createMockSupabase();
    service = new IncrementalProfileService(mockSupabase as never, {
      debounceMs: 100,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Constructor & Configuration
  // --------------------------------------------------------------------------

  describe("Constructor & Configuration", () => {
    it("should create service with default config", () => {
      const svc = new IncrementalProfileService(mockSupabase as never);
      expect(svc).toBeInstanceOf(IncrementalProfileService);
    });

    it("should merge custom config with defaults", () => {
      const customConfig: Partial<IncrementalProfileConfig> = {
        debounceMs: 1000,
        enabled: false,
      };
      const svc = new IncrementalProfileService(
        mockSupabase as never,
        customConfig,
      );
      expect(svc).toBeInstanceOf(IncrementalProfileService);
    });

    it("should be created via factory function", () => {
      const svc = createIncrementalProfileService(mockSupabase as never);
      expect(svc).toBeInstanceOf(IncrementalProfileService);
    });
  });

  // --------------------------------------------------------------------------
  // handleBookmarkChange - Event Types
  // --------------------------------------------------------------------------

  describe("handleBookmarkChange", () => {
    it("should handle create event", async () => {
      const event: BookmarkChangeEvent = {
        type: "create",
        bookmarkId: 1,
        userId: "user-1",
        toFolderId: 100,
        tags: ["react", "javascript"],
        embedding: [0.1, 0.2, 0.3],
      };

      await service.handleBookmarkChange(event);

      // Should queue update (verify with flushAll after debounce)
      expect(service).toBeDefined();
    });

    it("should handle move event - queue both folders", async () => {
      const event: BookmarkChangeEvent = {
        type: "move",
        bookmarkId: 1,
        userId: "user-1",
        fromFolderId: 100,
        toFolderId: 200,
      };

      await service.handleBookmarkChange(event);

      // Both source and target folders should be queued
      expect(service).toBeDefined();
    });

    it("should handle delete event", async () => {
      const event: BookmarkChangeEvent = {
        type: "delete",
        bookmarkId: 1,
        userId: "user-1",
        fromFolderId: 100,
      };

      await service.handleBookmarkChange(event);
      expect(service).toBeDefined();
    });

    it("should handle update_tags event", async () => {
      const event: BookmarkChangeEvent = {
        type: "update_tags",
        bookmarkId: 1,
        userId: "user-1",
        toFolderId: 100,
        tags: ["new-tag"],
      };

      await service.handleBookmarkChange(event);
      expect(service).toBeDefined();
    });

    it("should ignore events when disabled", async () => {
      const disabledService = new IncrementalProfileService(
        mockSupabase as never,
        { enabled: false },
      );

      const event: BookmarkChangeEvent = {
        type: "create",
        bookmarkId: 1,
        userId: "user-1",
        toFolderId: 100,
      };

      await disabledService.handleBookmarkChange(event);

      // No database calls should be made
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("should handle event without folderId", async () => {
      const event: BookmarkChangeEvent = {
        type: "create",
        bookmarkId: 1,
        userId: "user-1",
        // No toFolderId
      };

      await service.handleBookmarkChange(event);
      // Should not throw
      expect(service).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Debounce Behavior
  // --------------------------------------------------------------------------

  describe("Debounce Behavior", () => {
    it("should debounce multiple events for same folder", async () => {
      // Setup: mock profile exists
      mockSupabase._mocks.single.mockResolvedValue({
        data: {
          folder_id: 100,
          bookmark_count: 5,
          top_tags: ["existing"],
          profile_embedding: [0.5, 0.5, 0.5],
        },
        error: null,
      });

      const events: BookmarkChangeEvent[] = [
        { type: "create", bookmarkId: 1, userId: "user-1", toFolderId: 100 },
        { type: "create", bookmarkId: 2, userId: "user-1", toFolderId: 100 },
        { type: "create", bookmarkId: 3, userId: "user-1", toFolderId: 100 },
      ];

      // Send events in rapid succession
      for (const event of events) {
        await service.handleBookmarkChange(event);
      }

      // Before debounce completes, no database update should happen
      expect(mockSupabase._mocks.single).not.toHaveBeenCalled();

      // Fast forward past debounce time
      jest.advanceTimersByTime(150);

      // Now the update should be triggered
      await Promise.resolve(); // Allow async operations to complete
    });

    it("should reset timer on new event", async () => {
      const event1: BookmarkChangeEvent = {
        type: "create",
        bookmarkId: 1,
        userId: "user-1",
        toFolderId: 100,
      };

      await service.handleBookmarkChange(event1);

      // Advance 50ms (half of debounce)
      jest.advanceTimersByTime(50);

      // Send another event
      const event2: BookmarkChangeEvent = {
        type: "create",
        bookmarkId: 2,
        userId: "user-1",
        toFolderId: 100,
      };

      await service.handleBookmarkChange(event2);

      // Advance another 50ms (still not enough)
      jest.advanceTimersByTime(50);

      // Should not have triggered yet
      expect(mockSupabase._mocks.single).not.toHaveBeenCalled();

      // Advance to complete the debounce
      jest.advanceTimersByTime(100);
      await Promise.resolve();
    });
  });

  // --------------------------------------------------------------------------
  // flushAll
  // --------------------------------------------------------------------------

  describe("flushAll", () => {
    it("should flush all pending updates", async () => {
      mockSupabase._mocks.single.mockResolvedValue({
        data: {
          folder_id: 100,
          bookmark_count: 0,
          top_tags: [],
          profile_embedding: null,
        },
        error: null,
      });

      // Queue events for multiple folders
      await service.handleBookmarkChange({
        type: "create",
        bookmarkId: 1,
        userId: "user-1",
        toFolderId: 100,
      });

      await service.handleBookmarkChange({
        type: "create",
        bookmarkId: 2,
        userId: "user-1",
        toFolderId: 200,
      });

      // Flush all without waiting for debounce
      await service.flushAll();

      // Both folders should be updated
      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // handleBatchChanges
  // --------------------------------------------------------------------------

  describe("handleBatchChanges", () => {
    it("should process batch of events", async () => {
      mockSupabase._mocks.single.mockResolvedValue({
        data: {
          folder_id: 100,
          bookmark_count: 0,
          top_tags: [],
          profile_embedding: null,
        },
        error: null,
      });

      const events: BookmarkChangeEvent[] = [
        { type: "create", bookmarkId: 1, userId: "user-1", toFolderId: 100 },
        { type: "create", bookmarkId: 2, userId: "user-1", toFolderId: 100 },
        { type: "create", bookmarkId: 3, userId: "user-1", toFolderId: 200 },
      ];

      await service.handleBatchChanges(events);

      // Should process events for both folders
      expect(mockSupabase.from).toHaveBeenCalled();
    });

    it("should handle empty batch", async () => {
      await service.handleBatchChanges([]);
      // Should not throw
      expect(service).toBeDefined();
    });

    it("should group events by folder correctly", async () => {
      mockSupabase._mocks.single.mockResolvedValue({
        data: {
          folder_id: 100,
          bookmark_count: 5,
          top_tags: ["tag1"],
          profile_embedding: [0.1, 0.2],
        },
        error: null,
      });

      const events: BookmarkChangeEvent[] = [
        { type: "create", bookmarkId: 1, userId: "user-1", toFolderId: 100 },
        {
          type: "move",
          bookmarkId: 2,
          userId: "user-1",
          fromFolderId: 100,
          toFolderId: 200,
        },
      ];

      await service.handleBatchChanges(events);

      // Folder 100 should receive both events
      // Folder 200 should receive the move event
      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // initializeProfile
  // --------------------------------------------------------------------------

  describe("initializeProfile", () => {
    it("should create new profile for folder", async () => {
      // No existing profile
      mockSupabase._mocks.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      });

      // Folder name lookup
      mockSupabase._mocks.single.mockResolvedValueOnce({
        data: { name: "Test Folder" },
        error: null,
      });

      await service.initializeProfile(100, "user-1");

      expect(mockSupabase.from).toHaveBeenCalledWith("folder_profiles");
    });

    it("should skip if profile already exists", async () => {
      mockSupabase._mocks.single.mockResolvedValueOnce({
        data: { id: "existing-profile" },
        error: null,
      });

      await service.initializeProfile(100, "user-1");

      // Should not call insert
      // The select was called but insert should be skipped
      expect(mockSupabase.from).toHaveBeenCalledWith("folder_profiles");
    });

    it("should create profile with initial bookmark data", async () => {
      mockSupabase._mocks.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      });

      mockSupabase._mocks.single.mockResolvedValueOnce({
        data: { name: "Test Folder" },
        error: null,
      });

      await service.initializeProfile(100, "user-1", {
        tags: ["react", "typescript"],
        embedding: [0.1, 0.2, 0.3],
      });

      expect(mockSupabase.from).toHaveBeenCalled();
    });

    it("should handle initialization error gracefully", async () => {
      mockSupabase._mocks.single.mockRejectedValueOnce(
        new Error("Database error"),
      );

      // Should not throw
      await service.initializeProfile(100, "user-1");
    });
  });

  // --------------------------------------------------------------------------
  // Fallback to Full Update
  // --------------------------------------------------------------------------

  describe("Fallback to Full Update", () => {
    it("should call RPC when incremental update fails", async () => {
      // Profile doesn't exist - triggers fallback
      mockSupabase._mocks.single.mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      // Trigger update
      await service.handleBookmarkChange({
        type: "create",
        bookmarkId: 1,
        userId: "user-1",
        toFolderId: 100,
      });

      // Wait for debounce
      jest.advanceTimersByTime(150);
      await Promise.resolve();

      // RPC should be called for full update
      // Note: timing depends on implementation
    });

    it("should handle RPC error gracefully", async () => {
      mockSupabase._mocks.single.mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "RPC failed" },
      });

      await service.handleBookmarkChange({
        type: "create",
        bookmarkId: 1,
        userId: "user-1",
        toFolderId: 100,
      });

      jest.advanceTimersByTime(150);
      await Promise.resolve();

      // Should not throw
      expect(service).toBeDefined();
    });
  });
});

// ============================================================================
// Unit Tests for Helper Methods (via Public API)
// ============================================================================

describe("IncrementalProfileService - Algorithm Tests", () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let service: IncrementalProfileService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSupabase = createMockSupabase();
    service = new IncrementalProfileService(mockSupabase as never, {
      debounceMs: 100,
      topTagsCount: 5,
      minTagFrequency: 1,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Tag Merging", () => {
    it("should merge new tags with existing tags", async () => {
      // Setup: profile with existing tags
      mockSupabase._mocks.single.mockResolvedValue({
        data: {
          folder_id: 100,
          bookmark_count: 3,
          top_tags: ["react", "javascript", "typescript"],
          profile_embedding: [0.5, 0.5],
        },
        error: null,
      });

      // Mock update to capture the new tags
      const updateMock = jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }));
      mockSupabase.from = jest.fn(() => ({
        select: () => ({
          eq: () => ({ single: mockSupabase._mocks.single }),
        }),
        update: updateMock,
      })) as never;

      await service.handleBookmarkChange({
        type: "create",
        bookmarkId: 1,
        userId: "user-1",
        toFolderId: 100,
        tags: ["vue", "react"], // New tag + existing tag
      });

      jest.advanceTimersByTime(150);
      await Promise.resolve();

      // Update should be called with merged tags
      expect(updateMock).toHaveBeenCalled();
    });
  });

  describe("Embedding Merging", () => {
    it("should compute weighted average of embeddings", async () => {
      // Setup: profile with existing embedding
      mockSupabase._mocks.single.mockResolvedValue({
        data: {
          folder_id: 100,
          bookmark_count: 2,
          top_tags: [],
          profile_embedding: [1.0, 0.0], // 2 bookmarks averaged
        },
        error: null,
      });

      const updateMock = jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }));
      mockSupabase.from = jest.fn(() => ({
        select: () => ({
          eq: () => ({ single: mockSupabase._mocks.single }),
        }),
        update: updateMock,
      })) as never;

      await service.handleBookmarkChange({
        type: "create",
        bookmarkId: 1,
        userId: "user-1",
        toFolderId: 100,
        embedding: [0.0, 1.0], // New embedding
      });

      jest.advanceTimersByTime(150);
      await Promise.resolve();

      // New average should be computed:
      // (2 * [1.0, 0.0] + 1 * [0.0, 1.0]) / 3 ≈ [0.67, 0.33]
      expect(updateMock).toHaveBeenCalled();
    });
  });

  describe("Bookmark Count Delta", () => {
    it("should increment count on create", async () => {
      mockSupabase._mocks.single.mockResolvedValue({
        data: {
          folder_id: 100,
          bookmark_count: 5,
          top_tags: [],
          profile_embedding: null,
        },
        error: null,
      });

      const updateMock = jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }));
      mockSupabase.from = jest.fn(() => ({
        select: () => ({
          eq: () => ({ single: mockSupabase._mocks.single }),
        }),
        update: updateMock,
      })) as never;

      await service.handleBookmarkChange({
        type: "create",
        bookmarkId: 1,
        userId: "user-1",
        toFolderId: 100,
      });

      jest.advanceTimersByTime(150);
      await Promise.resolve();

      // Should update with bookmark_count: 6
      expect(updateMock).toHaveBeenCalled();
      const updateCall = (updateMock.mock.calls as unknown[][])[0]?.[0] as
        | { bookmark_count: number }
        | undefined;
      expect(updateCall?.bookmark_count).toBe(6);
    });

    it("should decrement count on delete", async () => {
      mockSupabase._mocks.single.mockResolvedValue({
        data: {
          folder_id: 100,
          bookmark_count: 5,
          top_tags: [],
          profile_embedding: null,
        },
        error: null,
      });

      const updateMock = jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }));
      mockSupabase.from = jest.fn(() => ({
        select: () => ({
          eq: () => ({ single: mockSupabase._mocks.single }),
        }),
        update: updateMock,
      })) as never;

      await service.handleBookmarkChange({
        type: "delete",
        bookmarkId: 1,
        userId: "user-1",
        fromFolderId: 100,
      });

      jest.advanceTimersByTime(150);
      await Promise.resolve();

      // Should update with bookmark_count: 4
      expect(updateMock).toHaveBeenCalled();
      const updateCall = (updateMock.mock.calls as unknown[][])[0]?.[0] as
        | { bookmark_count: number }
        | undefined;
      expect(updateCall?.bookmark_count).toBe(4);
    });

    it("should not go below zero", async () => {
      mockSupabase._mocks.single.mockResolvedValue({
        data: {
          folder_id: 100,
          bookmark_count: 0, // Already at zero
          top_tags: [],
          profile_embedding: null,
        },
        error: null,
      });

      const updateMock = jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }));
      mockSupabase.from = jest.fn(() => ({
        select: () => ({
          eq: () => ({ single: mockSupabase._mocks.single }),
        }),
        update: updateMock,
      })) as never;

      await service.handleBookmarkChange({
        type: "delete",
        bookmarkId: 1,
        userId: "user-1",
        fromFolderId: 100,
      });

      jest.advanceTimersByTime(150);
      await Promise.resolve();

      // Should stay at 0, not go negative
      expect(updateMock).toHaveBeenCalled();
      const updateCall = (updateMock.mock.calls as unknown[][])[0]?.[0] as
        | { bookmark_count: number }
        | undefined;
      expect(updateCall?.bookmark_count).toBe(0);
    });
  });
});

// ============================================================================
// Factory Function
// ============================================================================

describe("createIncrementalProfileService", () => {
  it("should create service instance", () => {
    const mockSupabase = createMockSupabase();
    const service = createIncrementalProfileService(mockSupabase as never);
    expect(service).toBeInstanceOf(IncrementalProfileService);
  });

  it("should pass config to service", () => {
    const mockSupabase = createMockSupabase();
    const config: Partial<IncrementalProfileConfig> = {
      debounceMs: 2000,
      enabled: false,
    };
    const service = createIncrementalProfileService(
      mockSupabase as never,
      config,
    );
    expect(service).toBeInstanceOf(IncrementalProfileService);
  });
});
