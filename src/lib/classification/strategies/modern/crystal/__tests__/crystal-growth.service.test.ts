/**
 * CrystalGrowthService 单元测试
 */

import { CrystalGrowthService } from "../growth/crystal-growth.service";
import { V55FeatureFlags } from "../integration/v55-feature-flag";

// Mock feature flags
jest.mock("../integration/v55-feature-flag", () => ({
  V55FeatureFlags: {
    V55_ENABLED: true,
    V55_SHADOW_MODE: false,
    V55_DEBUG_LOG: false,
    isUserInRollout: jest.fn().mockReturnValue(true),
  },
}));

// Mock Supabase client
const createMockSupabase = () => ({
  rpc: jest.fn(),
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        maybeSingle: jest.fn(),
      })),
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(),
      })),
    })),
    update: jest.fn(() => ({
      in: jest.fn(),
      eq: jest.fn(),
    })),
  })),
});

describe("CrystalGrowthService", () => {
  let service: CrystalGrowthService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createMockSupabase();
    service = new CrystalGrowthService(mockSupabase as any);
  });

  describe("processInboxBookmark", () => {
    it("should return POOLED when user not in rollout", async () => {
      (V55FeatureFlags.isUserInRollout as jest.Mock).mockReturnValue(false);

      const result = await service.processInboxBookmark("user-123", {
        id: 1,
        title: "Test Bookmark",
      });

      expect(result.action).toBe("POOLED");
    });

    it("should return QUOTA_BLOCKED when health check fails", async () => {
      (V55FeatureFlags.isUserInRollout as jest.Mock).mockReturnValue(true);

      // Mock quota check - health failed
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [
          {
            ai_folder_count: 5,
            total_folder_count: 10,
            empty_folder_count: 5, // > 3, health fails
            total_bookmark_count: 100,
            today_created_count: 0,
          },
        ],
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { settings: {} },
              error: null,
            }),
          }),
        }),
      });

      const result = await service.processInboxBookmark("user-123", {
        id: 1,
        title: "Test Bookmark",
      });

      expect(result.action).toBe("QUOTA_BLOCKED");
      expect(result.notification?.type).toBe("info");
    });

    it("should return POOLED when nucleus not formed", async () => {
      (V55FeatureFlags.isUserInRollout as jest.Mock).mockReturnValue(true);

      // Mock quota check - allowed
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: [
            {
              ai_folder_count: 2,
              total_folder_count: 5,
              empty_folder_count: 0,
              total_bookmark_count: 100,
              today_created_count: 0,
            },
          ],
          error: null,
        })
        // Mock add to chaos pool
        .mockResolvedValueOnce({ data: true, error: null })
        // Mock find neighbors - not enough
        .mockResolvedValueOnce({
          data: [{ bookmark_id: 2, title: "Only one", similarity: 0.8 }],
          error: null,
        });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { settings: {} },
              error: null,
            }),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 1, title: "Test" },
              error: null,
            }),
          }),
        }),
      });

      const result = await service.processInboxBookmark("user-123", {
        id: 1,
        title: "Test Bookmark",
      });

      expect(result.action).toBe("POOLED");
    });
  });

  describe("generateTempName", () => {
    it("should extract high frequency word as name", () => {
      // Access private method via any
      const tempName = (service as any).generateTempName([
        "React Hooks 入门教程",
        "React 状态管理最佳实践",
        "React 组件设计模式",
      ]);

      expect(tempName).toBe("React");
    });

    it("should return default name for empty input", () => {
      const tempName = (service as any).generateTempName([]);

      expect(tempName).toBe("新主题");
    });
  });
});
