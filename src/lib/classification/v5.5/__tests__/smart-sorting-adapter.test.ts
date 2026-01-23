/**
 * SmartSortingAdapter 单元测试
 */

import { SmartSortingAdapter } from "../integration/smart-sorting-adapter";

// Mock feature flags
jest.mock("../integration/v55-feature-flag", () => ({
  V55FeatureFlags: {
    V55_ENABLED: true,
    isUserInRollout: jest.fn().mockReturnValue(true),
  },
}));

// Mock Supabase client
const mockSupabase = {
  rpc: jest.fn(),
  from: jest.fn(() => ({
    update: jest.fn(() => ({
      eq: jest.fn(),
    })),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(),
          })),
        })),
      })),
    })),
  })),
};

describe("SmartSortingAdapter", () => {
  let adapter: SmartSortingAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new SmartSortingAdapter(mockSupabase as any);
  });

  describe("filterBookmarksForSmartSorting", () => {
    it("should filter out bookmarks in chaos pool", async () => {
      const inboxBookmarks = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
      const chaosPoolIds = [2, 4];

      mockSupabase.rpc.mockResolvedValue({
        data: chaosPoolIds,
        error: null,
      });

      const result = await adapter.filterBookmarksForSmartSorting(
        "user-123",
        inboxBookmarks,
      );

      expect(result).toEqual([{ id: 1 }, { id: 3 }]);
    });

    it("should return all bookmarks when chaos pool is empty", async () => {
      const inboxBookmarks = [{ id: 1 }, { id: 2 }, { id: 3 }];

      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await adapter.filterBookmarksForSmartSorting(
        "user-123",
        inboxBookmarks,
      );

      expect(result).toEqual(inboxBookmarks);
    });

    it("should return all bookmarks on error", async () => {
      const inboxBookmarks = [{ id: 1 }, { id: 2 }];

      mockSupabase.rpc.mockRejectedValue(new Error("Database error"));

      const result = await adapter.filterBookmarksForSmartSorting(
        "user-123",
        inboxBookmarks,
      );

      expect(result).toEqual(inboxBookmarks);
    });
  });

  describe("getChaosPoolBookmarkIds", () => {
    it("should return bookmark IDs from chaos pool", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [1, 2, 3],
        error: null,
      });

      const result = await adapter.getChaosPoolBookmarkIds("user-123");

      expect(result).toEqual([1, 2, 3]);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "get_chaos_pool_bookmark_ids",
        {
          p_user_id: "user-123",
        },
      );
    });

    it("should return empty array on error", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "Error" },
      });

      const result = await adapter.getChaosPoolBookmarkIds("user-123");

      expect(result).toEqual([]);
    });
  });
});
