/**
 * ChaosPoolManager 单元测试
 */

import { ChaosPoolManager } from "../growth/chaos-pool.manager";

// Mock Supabase client
const mockSupabase = {
  rpc: jest.fn(),
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(),
        })),
      })),
      count: jest.fn(),
      head: jest.fn(),
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(),
      })),
    })),
  })),
};

describe("ChaosPoolManager", () => {
  let manager: ChaosPoolManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new ChaosPoolManager(mockSupabase as any);
  });

  describe("add", () => {
    it("should add bookmark to chaos pool", async () => {
      mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

      const result = await manager.add("user-123", 456);

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("add_to_chaos_pool", {
        p_user_id: "user-123",
        p_bookmark_id: 456,
      });
    });

    it("should return false on error", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "Error" },
      });

      const result = await manager.add("user-123", 456);

      expect(result).toBe(false);
    });
  });

  describe("markProcessed", () => {
    it("should mark bookmarks as processed", async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 3, error: null });

      const result = await manager.markProcessed("user-123", [1, 2, 3], 100);

      expect(result).toBe(3);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "mark_chaos_pool_processed",
        {
          p_user_id: "user-123",
          p_bookmark_ids: [1, 2, 3],
          p_result_folder_id: 100,
        },
      );
    });
  });

  describe("getBookmarkIds", () => {
    it("should return bookmark IDs", async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [1, 2, 3], error: null });

      const result = await manager.getBookmarkIds("user-123");

      expect(result).toEqual([1, 2, 3]);
    });

    it("should return empty array on error", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "Error" },
      });

      const result = await manager.getBookmarkIds("user-123");

      expect(result).toEqual([]);
    });
  });
});
