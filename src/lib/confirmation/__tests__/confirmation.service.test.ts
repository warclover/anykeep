/**
 * Confirmation Service Integration Tests
 * V4.2 半托管流程集成测试
 *
 * @description 测试待确认消息服务的核心功能
 * - 创建确认消息
 * - 处理用户响应
 * - 过期处理
 * - 批量操作
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { confirmationService } from "../confirmation.service";
import { confirmationRepository } from "../confirmation.repository";
import { preferenceLearner } from "@/lib/classification-learning/preference-learner";
import type {
  PendingConfirmationRecord,
  ClassificationSuggestion,
  FolderCreateSuggestion,
} from "@/types/confirmation";

// ============================================================================
// Mock 设置
// ============================================================================

jest.mock("../confirmation.repository");
jest.mock("@/lib/classification-learning/preference-learner");
jest.mock("@/lib/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock Supabase server client
jest.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn().mockResolvedValue({}),
}));

// Mock BookmarkRepository
const mockMoveToFolder = jest.fn().mockResolvedValue(undefined);
const mockBatchMoveToFolder = jest.fn().mockResolvedValue(undefined);
jest.mock("@/repositories/bookmark.repository", () => ({
  BookmarkRepository: jest.fn().mockImplementation(() => ({
    moveToFolder: mockMoveToFolder,
    batchMoveToFolder: mockBatchMoveToFolder,
  })),
}));

describe("ConfirmationService", () => {
  // 测试数据
  const testUserId = "test-user-123";
  const testBookmarkId = 1;

  const mockClassificationSuggestion: ClassificationSuggestion = {
    folderId: 10,
    folderName: "技术文章",
    confidence: 75,
    reason: "基于内容语义匹配",
    alternatives: [],
  };

  const mockFolderCreateSuggestion: FolderCreateSuggestion = {
    suggestedName: "新文件夹",
    reason: "发现多个相似内容",
    estimatedCount: 5,
    bookmarkIds: [],
  };

  const createMockRecord = (
    type: "classification" | "folder_create" = "classification",
    status:
      | "pending"
      | "confirmed"
      | "rejected"
      | "modified"
      | "expired" = "pending",
  ): PendingConfirmationRecord => ({
    id: 1,
    user_id: testUserId,
    confirmation_type: type,
    bookmark_id: type === "classification" ? testBookmarkId : null,
    folder_id: type === "folder_create" ? 5 : null,
    suggestion:
      type === "classification"
        ? mockClassificationSuggestion
        : mockFolderCreateSuggestion,
    status,
    user_choice: null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    resolved_at: null,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // 创建确认消息测试
  // ============================================================================

  describe("createClassificationConfirmation", () => {
    it("should create new classification confirmation", async () => {
      const mockRecord = createMockRecord("classification");
      (confirmationRepository.findByBookmarkId as jest.Mock).mockResolvedValue(
        null,
      );
      (confirmationRepository.create as jest.Mock).mockResolvedValue(
        mockRecord,
      );

      const result = await confirmationService.createClassificationConfirmation(
        {
          userId: testUserId,
          bookmarkId: testBookmarkId,
          bookmarkTitle: "测试书签",
          bookmarkUrl: "https://example.com",
          suggestion: mockClassificationSuggestion,
        },
      );

      expect(result).toEqual(mockRecord);
      expect(confirmationRepository.create).toHaveBeenCalledWith({
        userId: testUserId,
        confirmationType: "classification",
        bookmarkId: testBookmarkId,
        suggestion: mockClassificationSuggestion,
      });
    });

    it("should return existing confirmation if one exists", async () => {
      const existingRecord = createMockRecord("classification");
      (confirmationRepository.findByBookmarkId as jest.Mock).mockResolvedValue(
        existingRecord,
      );

      const result = await confirmationService.createClassificationConfirmation(
        {
          userId: testUserId,
          bookmarkId: testBookmarkId,
          bookmarkTitle: "测试书签",
          bookmarkUrl: "https://example.com",
          suggestion: mockClassificationSuggestion,
        },
      );

      expect(result).toEqual(existingRecord);
      expect(confirmationRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("createFolderConfirmation", () => {
    it("should create folder creation confirmation", async () => {
      const mockRecord = createMockRecord("folder_create");
      (confirmationRepository.create as jest.Mock).mockResolvedValue(
        mockRecord,
      );

      const result = await confirmationService.createFolderConfirmation({
        userId: testUserId,
        suggestion: mockFolderCreateSuggestion,
        type: "folder_create",
      });

      expect(result).toEqual(mockRecord);
      expect(confirmationRepository.create).toHaveBeenCalledWith({
        userId: testUserId,
        confirmationType: "folder_create",
        folderId: undefined,
        suggestion: mockFolderCreateSuggestion,
      });
    });
  });

  // ============================================================================
  // 查询测试
  // ============================================================================

  describe("getUserConfirmations", () => {
    it("should return user confirmations from repository", async () => {
      const mockRecords = [createMockRecord(), createMockRecord()];
      (confirmationRepository.findByUser as jest.Mock).mockResolvedValue(
        mockRecords,
      );

      const result = await confirmationService.getUserConfirmations(testUserId);

      expect(result).toEqual(mockRecords);
      expect(confirmationRepository.findByUser).toHaveBeenCalledWith(
        testUserId,
        undefined,
      );
    });

    it("should pass filters to repository", async () => {
      const filters = { status: "pending" as const };
      (confirmationRepository.findByUser as jest.Mock).mockResolvedValue([]);

      await confirmationService.getUserConfirmations(testUserId, filters);

      expect(confirmationRepository.findByUser).toHaveBeenCalledWith(
        testUserId,
        filters,
      );
    });
  });

  describe("getPendingCount", () => {
    it("should return pending count from repository", async () => {
      (confirmationRepository.countPending as jest.Mock).mockResolvedValue(5);

      const result = await confirmationService.getPendingCount(testUserId);

      expect(result).toBe(5);
    });
  });

  describe("getById", () => {
    it("should return confirmation by id", async () => {
      const mockRecord = createMockRecord();
      (confirmationRepository.findById as jest.Mock).mockResolvedValue(
        mockRecord,
      );

      const result = await confirmationService.getById(1);

      expect(result).toEqual(mockRecord);
    });

    it("should return null for non-existent id", async () => {
      (confirmationRepository.findById as jest.Mock).mockResolvedValue(null);

      const result = await confirmationService.getById(999);

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // 用户响应处理测试
  // ============================================================================

  describe("respondToClassification", () => {
    it("should confirm when user accepts suggestion", async () => {
      const mockRecord = createMockRecord("classification");
      const updatedRecord = { ...mockRecord, status: "confirmed" as const };

      (confirmationRepository.findById as jest.Mock).mockResolvedValue(
        mockRecord,
      );
      (confirmationRepository.updateStatus as jest.Mock).mockResolvedValue(
        updatedRecord,
      );
      (preferenceLearner.recordEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await confirmationService.respondToClassification(
        1,
        testUserId,
        { selectedFolderId: mockClassificationSuggestion.folderId },
      );

      expect(result.success).toBe(true);
      expect(result.confirmation.status).toBe("confirmed");
      expect(confirmationRepository.updateStatus).toHaveBeenCalledWith(
        1,
        "confirmed",
        expect.objectContaining({
          choice: { selectedFolderId: mockClassificationSuggestion.folderId },
        }),
      );
    });

    it("should mark as modified when user selects different folder", async () => {
      const mockRecord = createMockRecord("classification");
      const updatedRecord = { ...mockRecord, status: "modified" as const };

      (confirmationRepository.findById as jest.Mock).mockResolvedValue(
        mockRecord,
      );
      (confirmationRepository.updateStatus as jest.Mock).mockResolvedValue(
        updatedRecord,
      );
      (preferenceLearner.recordEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await confirmationService.respondToClassification(
        1,
        testUserId,
        { selectedFolderId: 99 }, // 不同的文件夹
      );

      expect(result.success).toBe(true);
      expect(result.confirmation.status).toBe("modified");
    });

    it("should mark as rejected when user selects null without new folder", async () => {
      const mockRecord = createMockRecord("classification");
      const updatedRecord = { ...mockRecord, status: "rejected" as const };

      (confirmationRepository.findById as jest.Mock).mockResolvedValue(
        mockRecord,
      );
      (confirmationRepository.updateStatus as jest.Mock).mockResolvedValue(
        updatedRecord,
      );

      const result = await confirmationService.respondToClassification(
        1,
        testUserId,
        { selectedFolderId: null },
      );

      expect(result.success).toBe(true);
      expect(result.confirmation.status).toBe("rejected");
    });

    it("should return error for non-existent confirmation", async () => {
      (confirmationRepository.findById as jest.Mock).mockResolvedValue(null);

      const result = await confirmationService.respondToClassification(
        999,
        testUserId,
        { selectedFolderId: 10 },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Confirmation not found");
    });

    it("should return error for unauthorized user", async () => {
      const mockRecord = createMockRecord("classification");
      mockRecord.user_id = "other-user";

      (confirmationRepository.findById as jest.Mock).mockResolvedValue(
        mockRecord,
      );

      const result = await confirmationService.respondToClassification(
        1,
        testUserId,
        { selectedFolderId: 10 },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });

    it("should return error for already processed confirmation", async () => {
      const mockRecord = createMockRecord("classification", "confirmed");

      (confirmationRepository.findById as jest.Mock).mockResolvedValue(
        mockRecord,
      );

      const result = await confirmationService.respondToClassification(
        1,
        testUserId,
        { selectedFolderId: 10 },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Confirmation already processed");
    });

    it("should apply learning when user responds", async () => {
      const mockRecord = createMockRecord("classification");
      const updatedRecord = { ...mockRecord, status: "confirmed" as const };

      (confirmationRepository.findById as jest.Mock).mockResolvedValue(
        mockRecord,
      );
      (confirmationRepository.updateStatus as jest.Mock).mockResolvedValue(
        updatedRecord,
      );
      (preferenceLearner.recordEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await confirmationService.respondToClassification(
        1,
        testUserId,
        { selectedFolderId: mockClassificationSuggestion.folderId },
      );

      expect(result.learningApplied).toBe(true);
      expect(preferenceLearner.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          eventType: "classification_confirmed",
          bookmarkId: testBookmarkId,
        }),
      );
    });
  });

  describe("respondToFolderOperation", () => {
    it("should confirm folder operation when accepted", async () => {
      const mockRecord = createMockRecord("folder_create");
      const updatedRecord = { ...mockRecord, status: "confirmed" as const };

      (confirmationRepository.findById as jest.Mock).mockResolvedValue(
        mockRecord,
      );
      (confirmationRepository.updateStatus as jest.Mock).mockResolvedValue(
        updatedRecord,
      );

      const result = await confirmationService.respondToFolderOperation(
        1,
        testUserId,
        { accepted: true },
      );

      expect(result.success).toBe(true);
      expect(result.confirmation.status).toBe("confirmed");
    });

    it("should mark as modified when accepted with modifications", async () => {
      const mockRecord = createMockRecord("folder_create");
      const updatedRecord = { ...mockRecord, status: "modified" as const };

      (confirmationRepository.findById as jest.Mock).mockResolvedValue(
        mockRecord,
      );
      (confirmationRepository.updateStatus as jest.Mock).mockResolvedValue(
        updatedRecord,
      );

      const result = await confirmationService.respondToFolderOperation(
        1,
        testUserId,
        { accepted: true, modifications: { newName: "自定义名称" } },
      );

      expect(result.success).toBe(true);
      expect(result.confirmation.status).toBe("modified");
    });

    it("should reject folder operation when not accepted", async () => {
      const mockRecord = createMockRecord("folder_create");
      const updatedRecord = { ...mockRecord, status: "rejected" as const };

      (confirmationRepository.findById as jest.Mock).mockResolvedValue(
        mockRecord,
      );
      (confirmationRepository.updateStatus as jest.Mock).mockResolvedValue(
        updatedRecord,
      );

      const result = await confirmationService.respondToFolderOperation(
        1,
        testUserId,
        { accepted: false },
      );

      expect(result.success).toBe(true);
      expect(result.confirmation.status).toBe("rejected");
    });
  });

  // ============================================================================
  // 过期处理测试
  // ============================================================================

  describe("processExpired", () => {
    it("should process expired classification confirmations", async () => {
      const expiredRecord = createMockRecord("classification");

      (confirmationRepository.findExpired as jest.Mock).mockResolvedValue([
        expiredRecord,
      ]);
      (confirmationRepository.updateStatus as jest.Mock).mockResolvedValue({
        ...expiredRecord,
        status: "expired",
      });

      const result = await confirmationService.processExpired();

      expect(result.processed).toBe(1);
      expect(result.autoExecuted).toBe(1);
      expect(confirmationRepository.updateStatus).toHaveBeenCalledWith(
        expiredRecord.id,
        "expired",
      );
    });

    it("should move to inbox when no folder suggested", async () => {
      const expiredRecord = createMockRecord("classification");
      (expiredRecord.suggestion as ClassificationSuggestion).folderId = null;

      (confirmationRepository.findExpired as jest.Mock).mockResolvedValue([
        expiredRecord,
      ]);
      (confirmationRepository.updateStatus as jest.Mock).mockResolvedValue({
        ...expiredRecord,
        status: "expired",
      });

      const result = await confirmationService.processExpired();

      expect(result.movedToInbox).toBe(1);
    });

    it("should handle errors gracefully", async () => {
      const expiredRecord = createMockRecord("classification");

      (confirmationRepository.findExpired as jest.Mock).mockResolvedValue([
        expiredRecord,
      ]);
      (confirmationRepository.updateStatus as jest.Mock).mockRejectedValue(
        new Error("Update failed"),
      );

      const result = await confirmationService.processExpired();

      expect(result.errors).toContain(`ID ${expiredRecord.id}: Update failed`);
    });
  });

  // ============================================================================
  // 批量操作测试
  // ============================================================================

  describe("batchConfirm", () => {
    it("should confirm multiple confirmations", async () => {
      const mockRecords = [
        createMockRecord("classification"),
        { ...createMockRecord("classification"), id: 2 },
      ];

      mockRecords.forEach((record, _index) => {
        (confirmationRepository.findById as jest.Mock).mockResolvedValueOnce(
          record,
        );
        (
          confirmationRepository.updateStatus as jest.Mock
        ).mockResolvedValueOnce({ ...record, status: "confirmed" });
      });
      (preferenceLearner.recordEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await confirmationService.batchConfirm(testUserId, [1, 2]);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });

    it("should handle partial failures", async () => {
      const mockRecord = createMockRecord("classification");
      const otherUserRecord = createMockRecord("classification");
      otherUserRecord.user_id = "other-user"; // 不同用户的记录

      (confirmationRepository.findById as jest.Mock)
        .mockResolvedValueOnce(mockRecord)
        .mockResolvedValueOnce(mockRecord) // 内部 respondToClassification 会再次查找
        .mockResolvedValueOnce(otherUserRecord); // ID 2 属于另一个用户
      (confirmationRepository.updateStatus as jest.Mock).mockResolvedValueOnce({
        ...mockRecord,
        status: "confirmed",
      });
      (preferenceLearner.recordEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await confirmationService.batchConfirm(testUserId, [1, 2]);

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe("batchReject", () => {
    it("should reject multiple confirmations", async () => {
      const mockRecords = [
        createMockRecord("classification"),
        { ...createMockRecord("classification"), id: 2 },
      ];

      mockRecords.forEach((record) => {
        (confirmationRepository.findById as jest.Mock).mockResolvedValueOnce(
          record,
        );
        (
          confirmationRepository.updateStatus as jest.Mock
        ).mockResolvedValueOnce({ ...record, status: "rejected" });
      });

      const result = await confirmationService.batchReject(testUserId, [1, 2]);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  // ============================================================================
  // 展示数据测试
  // ============================================================================

  describe("getDisplayData", () => {
    it("should return formatted display data", async () => {
      const mockRecord = createMockRecord("classification");
      (confirmationRepository.findByUser as jest.Mock).mockResolvedValue([
        mockRecord,
      ]);

      const result = await confirmationService.getDisplayData(testUserId);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("id", mockRecord.id);
      expect(result[0]).toHaveProperty("type", "classification");
      expect(result[0]).toHaveProperty("title");
      expect(result[0]).toHaveProperty("description");
      expect(result[0]).toHaveProperty("expiresIn");
    });

    it("should show expiration status correctly", async () => {
      // 创建一个已过期的记录
      const expiredRecord = createMockRecord("classification");
      expiredRecord.expires_at = new Date(Date.now() - 1000).toISOString();

      (confirmationRepository.findByUser as jest.Mock).mockResolvedValue([
        expiredRecord,
      ]);

      const result = await confirmationService.getDisplayData(testUserId);

      expect(result[0].expiresIn).toBe("已过期");
    });
  });
});
