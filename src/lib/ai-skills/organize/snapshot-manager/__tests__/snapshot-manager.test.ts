/**
 * SnapshotManager 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { SnapshotManager } from "../snapshot-manager";
import type { CreateSnapshotInput, OrganizeOperationSnapshot } from "../types";

// Mock 结果变量 - 放在模块顶层以便在 jest.mock 内部访问
let mockSelectResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};
let mockSingleResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};
let mockInResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};
let mockLimitResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};
let mockEqResult: { error: unknown } = { error: null };

// Mock Supabase client - 内联定义
jest.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve(mockSingleResult)),
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve(mockEqResult)),
          })),
        })),
        delete: jest.fn(() => ({
          lt: jest.fn(() => ({
            select: jest.fn(() => Promise.resolve(mockSelectResult)),
          })),
        })),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            // 第二个 eq() 返回同时支持 single() 和 gt() 的对象
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve(mockSingleResult)),
              // getUndoableSnapshots 调用链: .eq().eq().gt().order().limit()
              gt: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => Promise.resolve(mockLimitResult)),
                })),
              })),
            })),
            // captureBookmarkStates 调用链: .eq().in()
            in: jest.fn(() => Promise.resolve(mockInResult)),
          })),
        })),
      })),
    }),
  ),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("SnapshotManager", () => {
  let manager: SnapshotManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new SnapshotManager();
    // Reset mock results
    mockSelectResult = { data: null, error: null };
    mockSingleResult = { data: null, error: null };
    mockInResult = { data: null, error: null };
    mockLimitResult = { data: null, error: null };
    mockEqResult = { error: null };
  });

  describe("createSnapshot", () => {
    it("should create a snapshot with correct data", async () => {
      const mockSnapshotRow = {
        id: "snapshot-123",
        user_id: "user-1",
        action: "batch_categorize",
        before_state: {},
        after_state: null,
        bookmark_ids: [1, 2, 3],
        folder_id: null,
        folder_ids: null,
        reason: "Test snapshot",
        created_at: new Date().toISOString(),
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        is_undone: false,
        undone_at: null,
      };

      mockSingleResult = {
        data: mockSnapshotRow,
        error: null,
      };

      const input: CreateSnapshotInput = {
        userId: "user-1",
        action: "batch_categorize",
        beforeState: {
          action: "batch_categorize",
          beforeStates: [],
          afterStates: [],
          createdFolders: [],
        },
        bookmarkIds: [1, 2, 3],
        reason: "Test snapshot",
      };

      const result = await manager.createSnapshot(input);

      expect(result.id).toBe("snapshot-123");
      expect(result.userId).toBe("user-1");
      expect(result.action).toBe("batch_categorize");
      expect(result.bookmarkIds).toEqual([1, 2, 3]);
      expect(result.isUndone).toBe(false);
      expect(result.canUndo).toBe(true);
    });

    it("should throw error when creation fails", async () => {
      mockSingleResult = {
        data: null,
        error: { message: "Database error" },
      };

      const input: CreateSnapshotInput = {
        userId: "user-1",
        action: "batch_tag",
        beforeState: {
          action: "batch_tag",
          beforeStates: [],
          afterStates: [],
        },
        bookmarkIds: [1],
      };

      await expect(manager.createSnapshot(input)).rejects.toThrow(
        "创建操作快照失败",
      );
    });
  });

  describe("getSnapshot", () => {
    it("should return snapshot when found", async () => {
      const mockSnapshotRow = {
        id: "snapshot-456",
        user_id: "user-1",
        action: "batch_tag",
        before_state: {
          action: "batch_tag",
          beforeStates: [],
          afterStates: [],
        },
        after_state: null,
        bookmark_ids: [1],
        folder_id: null,
        folder_ids: null,
        reason: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        is_undone: false,
        undone_at: null,
      };

      mockSingleResult = {
        data: mockSnapshotRow,
        error: null,
      };

      const result = await manager.getSnapshot("snapshot-456", "user-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("snapshot-456");
      expect(result?.action).toBe("batch_tag");
    });

    it("should return null when not found", async () => {
      mockSingleResult = {
        data: null,
        error: { code: "PGRST116", message: "Not found" },
      };

      const result = await manager.getSnapshot("nonexistent", "user-1");

      expect(result).toBeNull();
    });
  });

  describe("getUndoableSnapshots", () => {
    it("should return list of undoable snapshots", async () => {
      const mockSnapshots = [
        {
          id: "snapshot-1",
          user_id: "user-1",
          action: "batch_categorize",
          before_state: {},
          after_state: null,
          bookmark_ids: [1, 2],
          folder_id: null,
          folder_ids: null,
          reason: null,
          created_at: new Date().toISOString(),
          expires_at: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          is_undone: false,
          undone_at: null,
        },
      ];

      mockLimitResult = {
        data: mockSnapshots,
        error: null,
      };

      const result = await manager.getUndoableSnapshots("user-1");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("snapshot-1");
      expect(result[0].canUndo).toBe(true);
    });
  });

  describe("updateSnapshot", () => {
    it("should update snapshot with afterState", async () => {
      mockEqResult = { error: null };

      const afterState: OrganizeOperationSnapshot = {
        action: "batch_tag",
        beforeStates: [],
        afterStates: [
          {
            id: 1,
            title: "Test",
            url: "http://test.com",
            folderId: null,
            aiTags: ["tag1"],
            isInTrash: false,
            isStarred: false,
          },
        ],
      };

      await expect(
        manager.updateSnapshot("snapshot-123", { afterState }),
      ).resolves.not.toThrow();
    });
  });

  describe("captureBookmarkStates", () => {
    it("should capture current bookmark states", async () => {
      const mockBookmarks = [
        {
          id: 1,
          title: "Bookmark 1",
          url: "http://test1.com",
          folder_id: null,
          ai_tags: ["tech"],
          is_in_trash: false,
          is_starred: true,
        },
        {
          id: 2,
          title: "Bookmark 2",
          url: "http://test2.com",
          folder_id: 10,
          ai_tags: null,
          is_in_trash: false,
          is_starred: false,
        },
      ];

      mockInResult = {
        data: mockBookmarks,
        error: null,
      };

      const result = await manager.captureBookmarkStates([1, 2], "user-1");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        title: "Bookmark 1",
        url: "http://test1.com",
        folderId: null,
        aiTags: ["tech"],
        isInTrash: false,
        isStarred: true,
      });
      expect(result[1].aiTags).toEqual([]);
    });

    it("should return empty array for empty input", async () => {
      const result = await manager.captureBookmarkStates([], "user-1");

      expect(result).toEqual([]);
    });
  });

  describe("undoSnapshot", () => {
    it("should return error when snapshot not found", async () => {
      mockSingleResult = {
        data: null,
        error: { code: "PGRST116", message: "Not found" },
      };

      const result = await manager.undoSnapshot("nonexistent", "user-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("快照不存在或已过期");
    });

    it("should return error when already undone", async () => {
      const mockSnapshotRow = {
        id: "snapshot-123",
        user_id: "user-1",
        action: "batch_tag",
        before_state: {
          action: "batch_tag",
          beforeStates: [],
          afterStates: [],
        },
        after_state: null,
        bookmark_ids: [1],
        folder_id: null,
        folder_ids: null,
        reason: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        is_undone: true,
        undone_at: new Date().toISOString(),
      };

      mockSingleResult = {
        data: mockSnapshotRow,
        error: null,
      };

      const result = await manager.undoSnapshot("snapshot-123", "user-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("该操作已被撤销");
    });
  });

  describe("cleanupExpiredSnapshots", () => {
    it("should return count of cleaned snapshots", async () => {
      mockSelectResult = {
        data: [{ id: "1" }, { id: "2" }, { id: "3" }],
        error: null,
      };

      const result = await manager.cleanupExpiredSnapshots();

      expect(result).toBe(3);
    });

    it("should return 0 when no expired snapshots", async () => {
      mockSelectResult = {
        data: [],
        error: null,
      };

      const result = await manager.cleanupExpiredSnapshots();

      expect(result).toBe(0);
    });
  });
});
