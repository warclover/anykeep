/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Trust Mode Repository Unit Tests
 * V4.2 托管模式数据访问层测试
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { TrustModeRepository } from "../trust-mode.repository";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Mock 设置
// ============================================================================

describe("TrustModeRepository", () => {
  let repository: TrustModeRepository;
  let mockSupabase: jest.Mocked<SupabaseClient>;

  // 标准测试用户
  const testUserId = "test-user-123";

  // 模拟数据库行
  const mockDbRow = {
    id: 1,
    user_id: testUserId,
    trust_mode: "full_auto",
    overrides: {},
    mode_history: [],
    auto_decisions_count: 100,
    user_corrections_count: 5,
    pending_confirmations_count: 3,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  // 创建 mock 查询构建器

  const createMockQueryBuilder = (data: any = mockDbRow, error: any = null) => {
    const single = jest.fn().mockResolvedValue({ data, error });
    const select = jest
      .fn()
      .mockReturnValue({ single, eq: jest.fn().mockReturnValue({ single }) });
    const insert = jest.fn().mockReturnValue({ select });
    const update = jest
      .fn()
      .mockReturnValue({ eq: jest.fn().mockReturnValue({ select }) });
    const del = jest
      .fn()
      .mockReturnValue({ eq: jest.fn().mockResolvedValue({ error }) });

    return {
      from: jest.fn().mockReturnValue({
        select,
        insert,
        update,
        delete: del,
      }),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // 创建完整的 mock Supabase client
    const queryBuilder = createMockQueryBuilder();
    mockSupabase = {
      ...queryBuilder,
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as jest.Mocked<SupabaseClient>;

    repository = new TrustModeRepository(mockSupabase);
  });

  // ============================================================================
  // findByUserId 测试
  // ============================================================================

  describe("findByUserId", () => {
    it("should return user trust mode record when found", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest
              .fn()
              .mockResolvedValue({ data: mockDbRow, error: null }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.findByUserId(testUserId);

      expect(result).not.toBeNull();
      expect(result?.user_id).toBe(testUserId);
      expect(result?.trust_mode).toBe("full_auto");
      expect(mockFrom).toHaveBeenCalledWith("user_trust_mode");
    });

    it("should return null when record not found", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116", message: "Not found" },
            }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.findByUserId(testUserId);

      expect(result).toBeNull();
    });

    it("should throw error on database error", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: "OTHER", message: "Database error" },
            }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      await expect(repository.findByUserId(testUserId)).rejects.toThrow(
        "Failed to fetch trust mode",
      );
    });
  });

  // ============================================================================
  // create 测试
  // ============================================================================

  describe("create", () => {
    it("should create new trust mode record with default values", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest
              .fn()
              .mockResolvedValue({ data: mockDbRow, error: null }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.create({ userId: testUserId });

      expect(result).not.toBeNull();
      expect(result.user_id).toBe(testUserId);
    });

    it("should create record with custom trust mode", async () => {
      const customRow = { ...mockDbRow, trust_mode: "semi_auto" };
      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest
              .fn()
              .mockResolvedValue({ data: customRow, error: null }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.create({
        userId: testUserId,
        trustMode: "semi_auto",
      });

      expect(result.trust_mode).toBe("semi_auto");
    });

    it("should create record with custom overrides", async () => {
      const overrides = {
        classification: {
          autoClassify: false,
          requireConfirmation: false,
          lowConfidenceAction: "direct_inbox" as const,
        },
      };
      const customRow = { ...mockDbRow, overrides };
      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest
              .fn()
              .mockResolvedValue({ data: customRow, error: null }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.create({
        userId: testUserId,
        overrides,
      });

      expect(result.overrides).toEqual(overrides);
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

      await expect(repository.create({ userId: testUserId })).rejects.toThrow(
        "Failed to create trust mode",
      );
    });
  });

  // ============================================================================
  // update 测试
  // ============================================================================

  describe("update", () => {
    it("should update trust mode via RPC function", async () => {
      mockSupabase.rpc = jest
        .fn()
        .mockResolvedValue({ data: { success: true }, error: null });

      // Mock findByUserId for re-fetch
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...mockDbRow, trust_mode: "manual" },
              error: null,
            }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.update({
        userId: testUserId,
        trustMode: "manual",
        reason: "User preference",
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith("update_user_trust_mode", {
        p_user_id: testUserId,
        p_trust_mode: "manual",
        p_reason: "User preference",
      });
      expect(result.trust_mode).toBe("manual");
    });

    it("should throw error when no update fields provided", async () => {
      await expect(repository.update({ userId: testUserId })).rejects.toThrow(
        "No update fields provided",
      );
    });
  });

  // ============================================================================
  // updateOverrides 测试
  // ============================================================================

  describe("updateOverrides", () => {
    it("should merge overrides with existing ones", async () => {
      // Mock findByUserId
      const existingOverrides = { classification: { autoClassify: true } };
      const findMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...mockDbRow, overrides: existingOverrides },
              error: null,
            }),
          }),
        }),
      });

      // Mock update
      const newOverrides = {
        classification: { autoClassify: true },
        notification: { onFolderCreate: true },
      };
      const updateMock = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { ...mockDbRow, overrides: newOverrides },
                error: null,
              }),
            }),
          }),
        }),
      });

      let callCount = 0;
      mockSupabase.from = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return findMock();
        return updateMock();
      });

      const result = await repository.updateOverrides(testUserId, {
        notification: { onFolderCreate: true } as any,
      });

      expect(result.overrides).toBeDefined();
    });

    it("should create new record if user does not exist", async () => {
      // Mock findByUserId returning null
      const findMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116" },
            }),
          }),
        }),
      });

      // Mock create
      const createMock = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockDbRow,
              error: null,
            }),
          }),
        }),
      });

      let callCount = 0;
      mockSupabase.from = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return findMock();
        return createMock();
      });

      const result = await repository.updateOverrides(testUserId, {
        classification: {
          autoClassify: false,
          requireConfirmation: false,
          lowConfidenceAction: "direct_inbox",
        },
      });

      expect(result).not.toBeNull();
    });
  });

  // ============================================================================
  // getOrCreate 测试
  // ============================================================================

  describe("getOrCreate", () => {
    it("should return existing record if found", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest
              .fn()
              .mockResolvedValue({ data: mockDbRow, error: null }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.getOrCreate(testUserId);

      expect(result.user_id).toBe(testUserId);
    });

    it("should create new record if not found", async () => {
      // Mock findByUserId returning null
      const findMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116" },
            }),
          }),
        }),
      });

      // Mock create
      const createMock = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockDbRow,
              error: null,
            }),
          }),
        }),
      });

      let callCount = 0;
      mockSupabase.from = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return findMock();
        return createMock();
      });

      const result = await repository.getOrCreate(testUserId);

      expect(result).not.toBeNull();
    });
  });

  // ============================================================================
  // incrementStats 测试
  // ============================================================================

  describe("incrementStats", () => {
    it("should call RPC function to increment stats", async () => {
      // Mock getOrCreate
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest
              .fn()
              .mockResolvedValue({ data: mockDbRow, error: null }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;
      mockSupabase.rpc = jest
        .fn()
        .mockResolvedValue({ data: null, error: null });

      await repository.incrementStats({
        userId: testUserId,
        autoDecisions: 1,
        userCorrections: 0,
        pendingConfirmations: 0,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "increment_trust_mode_stats",
        {
          p_user_id: testUserId,
          p_auto_decisions: 1,
          p_user_corrections: 0,
          p_pending_confirmations: 0,
        },
      );
    });

    it("should fallback to direct update when RPC does not exist", async () => {
      // Mock getOrCreate
      const selectMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockDbRow, error: null }),
        }),
      });

      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      mockSupabase.from = jest.fn().mockReturnValue({
        select: selectMock,
        update: updateMock,
      });

      // RPC function does not exist
      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: { code: "42883", message: "function does not exist" },
      });

      await repository.incrementStats({
        userId: testUserId,
        autoDecisions: 1,
      });

      // Should fall back to direct update
      expect(updateMock).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // resetPendingCount 测试
  // ============================================================================

  describe("resetPendingCount", () => {
    it("should reset pending confirmations count to zero", async () => {
      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      mockSupabase.from = jest.fn().mockReturnValue({
        update: updateMock,
      });

      await repository.resetPendingCount(testUserId);

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pending_confirmations_count: 0,
        }),
      );
    });

    it("should throw error on failure", async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockResolvedValue({ error: { message: "Update failed" } }),
        }),
      });

      await expect(repository.resetPendingCount(testUserId)).rejects.toThrow(
        "Failed to reset pending count",
      );
    });
  });

  // ============================================================================
  // getModeHistory 测试
  // ============================================================================

  describe("getModeHistory", () => {
    it("should return mode history from record", async () => {
      const mockHistory = [
        {
          from: "full_auto",
          to: "semi_auto",
          timestamp: "2025-01-01",
          reason: "test",
        },
      ];
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...mockDbRow, mode_history: mockHistory },
              error: null,
            }),
          }),
        }),
      });
      mockSupabase.from = mockFrom;

      const result = await repository.getModeHistory(testUserId);

      expect(result).toEqual(mockHistory);
    });

    it("should return empty array when no record exists", async () => {
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

      const result = await repository.getModeHistory(testUserId);

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // delete 测试
  // ============================================================================

  describe("delete", () => {
    it("should delete user trust mode record", async () => {
      const deleteMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      mockSupabase.from = jest.fn().mockReturnValue({
        delete: deleteMock,
      });

      await repository.delete(testUserId);

      expect(deleteMock).toHaveBeenCalled();
    });

    it("should throw error on delete failure", async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockResolvedValue({ error: { message: "Delete failed" } }),
        }),
      });

      await expect(repository.delete(testUserId)).rejects.toThrow(
        "Failed to delete trust mode",
      );
    });
  });
});
