/**
 * Confirmation Repository Unit Tests
 * V4.2 待确认消息数据访问层测试
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { ConfirmationRepository } from "../confirmation.repository";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ConfirmationType,
  ClassificationSuggestion,
} from "@/types/confirmation";

// ============================================================================
// Mock 设置
// ============================================================================

describe("ConfirmationRepository", () => {
  let repository: ConfirmationRepository;
  let mockSupabase: jest.Mocked<SupabaseClient>;

  const testUserId = "test-user-123";
  const testBookmarkId = 1;

  const mockClassificationSuggestion: ClassificationSuggestion = {
    folderId: 10,
    folderName: "技术文章",
    confidence: 75,
    reason: "基于内容语义匹配",
    alternatives: [],
  };

  const mockDbRow = {
    id: 1,
    user_id: testUserId,
    confirmation_type: "classification" as ConfirmationType,
    bookmark_id: testBookmarkId,
    folder_id: null,
    suggestion: mockClassificationSuggestion,
    status: "pending",
    user_choice: null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    resolved_at: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // 创建 mock Supabase client
    mockSupabase = {
      from: jest.fn(),
    } as unknown as jest.Mocked<SupabaseClient>;

    repository = new ConfirmationRepository();

    // Mock getSupabase 方法
    (repository as any).getSupabase = jest.fn().mockResolvedValue(mockSupabase);
  });

  // ============================================================================
  // create 测试
  // ============================================================================

  describe("create", () => {
    it("should create new confirmation record", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockDbRow, error: null }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.create({
        userId: testUserId,
        confirmationType: "classification",
        bookmarkId: testBookmarkId,
        suggestion: mockClassificationSuggestion,
      });

      expect(result).not.toBeNull();
      expect(result.user_id).toBe(testUserId);
      expect(result.confirmation_type).toBe("classification");
      expect(mockFrom).toHaveBeenCalledWith("pending_confirmations");
    });

    it("should set expiration date correctly", async () => {
      let insertedData: any;
      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockImplementation((data) => {
          insertedData = data;
          return {
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockDbRow, error: null }),
            }),
          };
        }),
      });
      mockSupabase.from = mockFrom;

      await repository.create({
        userId: testUserId,
        confirmationType: "classification",
        bookmarkId: testBookmarkId,
        suggestion: mockClassificationSuggestion,
        expiresInDays: 14, // 自定义过期天数
      });

      const expiresAt = new Date(insertedData.expires_at);
      const now = new Date();
      const diffDays = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBeCloseTo(14, 0);
    });

    it("should throw error on create failure", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: "Insert failed" },
            }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      await expect(
        repository.create({
          userId: testUserId,
          confirmationType: "classification",
          bookmarkId: testBookmarkId,
          suggestion: mockClassificationSuggestion,
        })
      ).rejects.toThrow("Failed to create confirmation");
    });
  });

  // ============================================================================
  // createMany 测试
  // ============================================================================

  describe("createMany", () => {
    it("should create multiple records", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [mockDbRow, { ...mockDbRow, id: 2 }],
            error: null,
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.createMany([
        {
          userId: testUserId,
          confirmationType: "classification",
          bookmarkId: 1,
          suggestion: mockClassificationSuggestion,
        },
        {
          userId: testUserId,
          confirmationType: "classification",
          bookmarkId: 2,
          suggestion: mockClassificationSuggestion,
        },
      ]);

      expect(result).toHaveLength(2);
    });

    it("should return empty array for empty input", async () => {
      const result = await repository.createMany([]);
      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // findById 测试
  // ============================================================================

  describe("findById", () => {
    it("should return confirmation by id", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockDbRow, error: null }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.findById(1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
    });

    it("should return null for non-existent id", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116" },
            }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // findByUser 测试
  // ============================================================================

  describe("findByUser", () => {
    it("should return user confirmations", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [mockDbRow],
              error: null,
            }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.findByUser(testUserId);

      expect(result).toHaveLength(1);
    });

    it("should apply status filter", async () => {
      const mockEq = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: mockEq,
        }),
      });
      mockSupabase.from = mockFrom;

      await repository.findByUser(testUserId, { status: "pending" });

      expect(mockEq).toHaveBeenCalled();
    });

    it("should apply type filter", async () => {
      const mockIn = jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });
      const mockEq = jest.fn().mockReturnValue({
        in: mockIn,
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: mockEq,
        }),
      });
      mockSupabase.from = mockFrom;

      await repository.findByUser(testUserId, {
        type: ["classification", "folder_create"]
      });

      expect(mockIn).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // findByBookmarkId 测试
  // ============================================================================

  describe("findByBookmarkId", () => {
    it("should find confirmation by bookmark id", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [mockDbRow],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.findByBookmarkId(testUserId, testBookmarkId);

      expect(result).not.toBeNull();
    });
  });

  // ============================================================================
  // countPending 测试
  // ============================================================================

  describe("countPending", () => {
    it("should return pending count", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ count: 5, error: null }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.countPending(testUserId);

      expect(result).toBe(5);
    });

    it("should return 0 when no pending", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ count: null, error: null }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.countPending(testUserId);

      expect(result).toBe(0);
    });
  });

  // ============================================================================
  // findExpired 测试
  // ============================================================================

  describe("findExpired", () => {
    it("should return expired confirmations", async () => {
      const expiredRow = { ...mockDbRow, expires_at: new Date(Date.now() - 1000).toISOString() };
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [expiredRow],
                error: null,
              }),
            }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.findExpired();

      expect(result).toHaveLength(1);
    });
  });

  // ============================================================================
  // updateStatus 测试
  // ============================================================================

  describe("updateStatus", () => {
    it("should update confirmation status", async () => {
      const updatedRow = { ...mockDbRow, status: "confirmed" };
      const mockFrom = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: updatedRow, error: null }),
            }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.updateStatus(1, "confirmed");

      expect(result.status).toBe("confirmed");
    });

    it("should include user choice when provided", async () => {
      let updateData: any;
      const updatedRow = { ...mockDbRow, status: "confirmed" };
      const mockFrom = jest.fn().mockReturnValue({
        update: jest.fn().mockImplementation((data) => {
          updateData = data;
          return {
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: updatedRow, error: null }),
              }),
            }),
          };
        }),
      });
      mockSupabase.from = mockFrom;

      const userChoice = {
        choice: { selectedFolderId: 10 },
        timestamp: new Date().toISOString(),
      };
      await repository.updateStatus(1, "confirmed", userChoice);

      expect(updateData.user_choice).toEqual(userChoice);
    });

    it("should set resolved_at when status is not pending", async () => {
      let updateData: any;
      const updatedRow = { ...mockDbRow, status: "confirmed" };
      const mockFrom = jest.fn().mockReturnValue({
        update: jest.fn().mockImplementation((data) => {
          updateData = data;
          return {
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: updatedRow, error: null }),
              }),
            }),
          };
        }),
      });
      mockSupabase.from = mockFrom;

      await repository.updateStatus(1, "confirmed");

      expect(updateData.resolved_at).toBeDefined();
    });
  });

  // ============================================================================
  // batchUpdateStatus 测试
  // ============================================================================

  describe("batchUpdateStatus", () => {
    it("should update multiple confirmations", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ count: 3, error: null }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.batchUpdateStatus([1, 2, 3], "expired");

      expect(result).toBe(3);
    });

    it("should return 0 for empty ids array", async () => {
      const result = await repository.batchUpdateStatus([], "expired");
      expect(result).toBe(0);
    });
  });

  // ============================================================================
  // delete 测试
  // ============================================================================

  describe("delete", () => {
    it("should delete confirmation", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });
      mockSupabase.from = mockFrom;

      await expect(repository.delete(1)).resolves.not.toThrow();
    });

    it("should throw error on delete failure", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: "Delete failed" } }),
        }),
      });
      mockSupabase.from = mockFrom;

      await expect(repository.delete(1)).rejects.toThrow("Failed to delete confirmation");
    });
  });

  // ============================================================================
  // deleteAllByUser 测试
  // ============================================================================

  describe("deleteAllByUser", () => {
    it("should delete all user confirmations", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ count: 5, error: null }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.deleteAllByUser(testUserId);

      expect(result).toBe(5);
    });
  });
});
