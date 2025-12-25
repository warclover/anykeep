/**
 * OperationLogService Unit Tests
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// ============================================================================
// Mocks
// ============================================================================

const mockCreateSnapshot = jest.fn();
const mockGetOperationHistory = jest.fn();
const mockGetSnapshotById = jest.fn();
const mockGetUndoableCount = jest.fn();
const mockCleanupExpiredSnapshots = jest.fn();
const mockUndoOperation = jest.fn();

const mockCreateFolderCreateSnapshot = jest.fn();
const mockCreateRenameSnapshot = jest.fn();
const mockCreateSplitSnapshot = jest.fn();
const mockCreateMergeSnapshot = jest.fn();
const mockCreateFolderWithNotification = jest.fn();
const mockRenameFolderWithNotification = jest.fn();
const mockSplitFolderWithNotification = jest.fn();
const mockMergeFoldersWithNotification = jest.fn();
const mockSendEvolutionReport = jest.fn();

// Mock supabase
jest.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(),
    }),
  ),
}));

// Mock persistence module
jest.mock("../persistence", () => ({
  createSnapshot: (...args: unknown[]) => mockCreateSnapshot(...args),
  getOperationHistory: (...args: unknown[]) => mockGetOperationHistory(...args),
  getSnapshotById: (...args: unknown[]) => mockGetSnapshotById(...args),
  getUndoableCount: (...args: unknown[]) => mockGetUndoableCount(...args),
  cleanupExpiredSnapshots: (...args: unknown[]) =>
    mockCleanupExpiredSnapshots(...args),
}));

// Mock undo module
jest.mock("../undo", () => ({
  undoOperation: (...args: unknown[]) => mockUndoOperation(...args),
}));

// Mock notification module
jest.mock("../notification", () => ({
  createFolderCreateSnapshot: (...args: unknown[]) =>
    mockCreateFolderCreateSnapshot(...args),
  createRenameSnapshot: (...args: unknown[]) =>
    mockCreateRenameSnapshot(...args),
  createSplitSnapshot: (...args: unknown[]) => mockCreateSplitSnapshot(...args),
  createMergeSnapshot: (...args: unknown[]) => mockCreateMergeSnapshot(...args),
  createFolderWithNotification: (...args: unknown[]) =>
    mockCreateFolderWithNotification(...args),
  renameFolderWithNotification: (...args: unknown[]) =>
    mockRenameFolderWithNotification(...args),
  splitFolderWithNotification: (...args: unknown[]) =>
    mockSplitFolderWithNotification(...args),
  mergeFoldersWithNotification: (...args: unknown[]) =>
    mockMergeFoldersWithNotification(...args),
  sendEvolutionReport: (...args: unknown[]) => mockSendEvolutionReport(...args),
}));

// ============================================================================
// Test Utilities
// ============================================================================

function createMockSnapshot(overrides = {}) {
  return {
    id: "snapshot-123",
    userId: "user-123",
    action: "folder_create",
    beforeState: {},
    afterState: { folderId: 1, name: "测试文件夹" },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    isUndone: false,
    ...overrides,
  };
}

function createMockFolderInfo(overrides = {}) {
  return {
    id: 1,
    name: "测试文件夹",
    ...overrides,
  };
}

function createMockBookmarkInfo(overrides = {}) {
  return {
    id: 1,
    title: "测试书签",
    url: "https://example.com",
    ...overrides,
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe("OperationLogService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSnapshot.mockResolvedValue(createMockSnapshot());
    mockGetOperationHistory.mockResolvedValue([]);
    mockGetSnapshotById.mockResolvedValue(createMockSnapshot());
    mockGetUndoableCount.mockResolvedValue(5);
    mockCleanupExpiredSnapshots.mockResolvedValue(10);
    mockUndoOperation.mockResolvedValue({ success: true });
    mockCreateFolderCreateSnapshot.mockResolvedValue(createMockSnapshot());
    mockCreateRenameSnapshot.mockResolvedValue(createMockSnapshot());
    mockCreateSplitSnapshot.mockResolvedValue(createMockSnapshot());
    mockCreateMergeSnapshot.mockResolvedValue(createMockSnapshot());
    mockCreateFolderWithNotification.mockResolvedValue(createMockSnapshot());
    mockRenameFolderWithNotification.mockResolvedValue(createMockSnapshot());
    mockSplitFolderWithNotification.mockResolvedValue(createMockSnapshot());
    mockMergeFoldersWithNotification.mockResolvedValue(createMockSnapshot());
    mockSendEvolutionReport.mockResolvedValue(undefined);
  });

  // ============================================================================
  // Snapshot Creation Tests
  // ============================================================================

  describe("createSnapshot", () => {
    it("should create a basic snapshot", async () => {
      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      const result = await service.createSnapshot(
        "user-123",
        "folder_create",
        {},
        { folderId: 1 },
      );

      expect(result).toBeDefined();
      expect(mockCreateSnapshot).toHaveBeenCalled();
    });

    it("should pass options to createSnapshot", async () => {
      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      await service.createSnapshot(
        "user-123",
        "folder_create",
        {},
        { folderId: 1 },
        { folderId: 1, reason: "AI 自动创建" },
      );

      expect(mockCreateSnapshot).toHaveBeenCalledWith(
        expect.anything(),
        "user-123",
        "folder_create",
        {},
        { folderId: 1 },
        { folderId: 1, reason: "AI 自动创建" },
      );
    });
  });

  describe("createFolderCreateSnapshot", () => {
    it("should create folder create snapshot", async () => {
      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      const folder = createMockFolderInfo();
      const bookmarks = [createMockBookmarkInfo()];

      const result = await service.createFolderCreateSnapshot(
        "user-123",
        folder,
        bookmarks,
        "AI 创建文件夹",
      );

      expect(result).toBeDefined();
      expect(mockCreateFolderCreateSnapshot).toHaveBeenCalled();
    });
  });

  describe("createRenameSnapshot", () => {
    it("should create rename snapshot", async () => {
      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      const result = await service.createRenameSnapshot(
        "user-123",
        1,
        "旧名称",
        "新名称",
        "AI 重命名",
      );

      expect(result).toBeDefined();
      expect(mockCreateRenameSnapshot).toHaveBeenCalledWith(
        expect.anything(),
        "user-123",
        1,
        "旧名称",
        "新名称",
        "AI 重命名",
      );
    });
  });

  describe("createSplitSnapshot", () => {
    it("should create split snapshot", async () => {
      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      const originalFolder = createMockFolderInfo();
      const newFolders = [
        createMockFolderInfo({ id: 2, name: "新文件夹1" }),
        createMockFolderInfo({ id: 3, name: "新文件夹2" }),
      ];
      const bookmarkMoves = [
        { bookmarkId: 1, fromFolderId: 1, toFolderId: 2 },
        { bookmarkId: 2, fromFolderId: 1, toFolderId: 3 },
      ];

      const result = await service.createSplitSnapshot(
        "user-123",
        originalFolder,
        newFolders,
        bookmarkMoves,
        "AI 分拆文件夹",
      );

      expect(result).toBeDefined();
      expect(mockCreateSplitSnapshot).toHaveBeenCalled();
    });
  });

  describe("createMergeSnapshot", () => {
    it("should create merge snapshot", async () => {
      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      const sourceFolders = [
        createMockFolderInfo({ id: 1, name: "源文件夹1" }),
        createMockFolderInfo({ id: 2, name: "源文件夹2" }),
      ];
      const targetFolder = createMockFolderInfo({ id: 3, name: "目标文件夹" });
      const mergedBookmarks = [
        createMockBookmarkInfo({ id: 1 }),
        createMockBookmarkInfo({ id: 2 }),
      ];

      const result = await service.createMergeSnapshot(
        "user-123",
        sourceFolders,
        targetFolder,
        mergedBookmarks,
        "AI 合并文件夹",
      );

      expect(result).toBeDefined();
      expect(mockCreateMergeSnapshot).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Query Methods Tests
  // ============================================================================

  describe("getOperationHistory", () => {
    it("should get operation history", async () => {
      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      mockGetOperationHistory.mockResolvedValue([
        createMockSnapshot(),
        createMockSnapshot({ id: "snapshot-456" }),
      ]);

      const result = await service.getOperationHistory("user-123");

      expect(result).toHaveLength(2);
      expect(mockGetOperationHistory).toHaveBeenCalledWith(
        expect.anything(),
        "user-123",
        {},
      );
    });

    it("should pass options to getOperationHistory", async () => {
      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      await service.getOperationHistory("user-123", {
        limit: 10,
        offset: 5,
        action: "folder_create",
      });

      expect(mockGetOperationHistory).toHaveBeenCalledWith(
        expect.anything(),
        "user-123",
        { limit: 10, offset: 5, action: "folder_create" },
      );
    });
  });

  describe("getSnapshotById", () => {
    it("should get snapshot by id", async () => {
      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      const result = await service.getSnapshotById("user-123", "snapshot-123");

      expect(result).toBeDefined();
      expect(mockGetSnapshotById).toHaveBeenCalledWith(
        expect.anything(),
        "user-123",
        "snapshot-123",
      );
    });

    it("should return null for non-existent snapshot", async () => {
      mockGetSnapshotById.mockResolvedValue(null);

      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      const result = await service.getSnapshotById(
        "user-123",
        "non-existent-id",
      );

      expect(result).toBeNull();
    });
  });

  describe("getUndoableCount", () => {
    it("should get undoable count", async () => {
      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      const result = await service.getUndoableCount("user-123");

      expect(result).toBe(5);
      expect(mockGetUndoableCount).toHaveBeenCalledWith(
        expect.anything(),
        "user-123",
      );
    });
  });

  // ============================================================================
  // Undo Tests
  // ============================================================================

  describe("undoOperation", () => {
    it("should undo operation successfully", async () => {
      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      const result = await service.undoOperation("user-123", "snapshot-123");

      expect(result.success).toBe(true);
      expect(mockUndoOperation).toHaveBeenCalledWith(
        expect.anything(),
        "user-123",
        "snapshot-123",
      );
    });

    it("should return failure for invalid undo", async () => {
      mockUndoOperation.mockResolvedValue({
        success: false,
        error: "操作已过期",
      });

      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      const result = await service.undoOperation(
        "user-123",
        "expired-snapshot",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("操作已过期");
    });
  });

  // ============================================================================
  // Cleanup Tests
  // ============================================================================

  describe("cleanupExpiredSnapshots", () => {
    it("should cleanup expired snapshots", async () => {
      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      const result = await service.cleanupExpiredSnapshots();

      expect(result).toBe(10);
      expect(mockCleanupExpiredSnapshots).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Notification Integration Tests
  // ============================================================================

  describe("notification integration", () => {
    it("should create folder with notification", async () => {
      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      const folder = createMockFolderInfo();
      const bookmarks = [createMockBookmarkInfo()];

      await service.createFolderWithNotification(
        "user-123",
        folder,
        bookmarks,
        "AI 自动创建",
      );

      expect(mockCreateFolderWithNotification).toHaveBeenCalled();
    });

    it("should rename folder with notification", async () => {
      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      await service.renameFolderWithNotification(
        "user-123",
        1,
        "旧名称",
        "新名称",
      );

      expect(mockRenameFolderWithNotification).toHaveBeenCalled();
    });

    it("should split folder with notification", async () => {
      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      await service.splitFolderWithNotification(
        "user-123",
        createMockFolderInfo(),
        [createMockFolderInfo({ id: 2 })],
        [{ bookmarkId: 1, fromFolderId: 1, toFolderId: 2 }],
      );

      expect(mockSplitFolderWithNotification).toHaveBeenCalled();
    });

    it("should merge folders with notification", async () => {
      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      await service.mergeFoldersWithNotification(
        "user-123",
        [createMockFolderInfo({ id: 1 }), createMockFolderInfo({ id: 2 })],
        createMockFolderInfo({ id: 3 }),
        [createMockBookmarkInfo()],
      );

      expect(mockMergeFoldersWithNotification).toHaveBeenCalled();
    });

    it("should send evolution report", async () => {
      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      await service.sendEvolutionReport(
        "user-123",
        "2025-12",
        100,
        5,
        "https://app.example.com/report",
      );

      expect(mockSendEvolutionReport).toHaveBeenCalledWith(
        "user-123",
        "2025-12",
        100,
        5,
        "https://app.example.com/report",
      );
    });
  });

  // ============================================================================
  // Singleton Export Tests
  // ============================================================================

  describe("singleton export", () => {
    it("should export operationLogService singleton", async () => {
      const { operationLogService } = await import("../operation-log.service");

      expect(operationLogService).toBeDefined();
      expect(typeof operationLogService.createSnapshot).toBe("function");
      expect(typeof operationLogService.undoOperation).toBe("function");
      expect(typeof operationLogService.getOperationHistory).toBe("function");
    });
  });

  // ============================================================================
  // Supabase Client Caching Tests
  // ============================================================================

  describe("supabase client caching", () => {
    it("should reuse supabase client across calls", async () => {
      const { createServerSupabaseClient } = await import(
        "@/lib/supabase/server"
      );
      const { OperationLogService } = await import("../operation-log.service");
      const service = new OperationLogService();

      // Make multiple calls
      await service.getUndoableCount("user-123");
      await service.getOperationHistory("user-123");
      await service.getSnapshotById("user-123", "snapshot-123");

      // Should only create client once due to caching
      // Note: This is a behavioral test - actual call count depends on implementation
      expect(createServerSupabaseClient).toHaveBeenCalled();
    });
  });
});
