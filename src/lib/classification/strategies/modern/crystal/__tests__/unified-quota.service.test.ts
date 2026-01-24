/**
 * UnifiedQuotaService 单元测试
 */

import { UnifiedQuotaService, QUOTA_CONFIG } from "../quota";

// Mock Supabase client
const mockSupabase = {
  rpc: jest.fn(),
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
      })),
    })),
  })),
};

describe("UnifiedQuotaService", () => {
  let service: UnifiedQuotaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UnifiedQuotaService(mockSupabase as any);
  });

  describe("calculateDynamicCap", () => {
    it("should return minimum cap for small bookmark counts", () => {
      expect(service.calculateDynamicCap(10)).toBe(QUOTA_CONFIG.SOFT_CAP_MIN);
      expect(service.calculateDynamicCap(20)).toBe(QUOTA_CONFIG.SOFT_CAP_MIN);
    });

    it("should calculate 15% of bookmark count for medium counts", () => {
      expect(service.calculateDynamicCap(100)).toBe(15);
      expect(service.calculateDynamicCap(200)).toBe(30);
    });

    it("should cap at hard limit for large bookmark counts", () => {
      expect(service.calculateDynamicCap(500)).toBe(QUOTA_CONFIG.AI_HARD_CAP);
      expect(service.calculateDynamicCap(1000)).toBe(QUOTA_CONFIG.AI_HARD_CAP);
    });
  });

  describe("checkQuota", () => {
    it("should return allowed=true when all checks pass", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            ai_folder_count: 5,
            total_folder_count: 10,
            empty_folder_count: 1,
            total_bookmark_count: 100,
            today_created_count: 2,
          },
        ],
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                settings: { autonomy_level: 1, ai_folder_daily_limit: 5 },
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await service.checkQuota("user-123");

      expect(result.allowed).toBe(true);
      expect(result.daily.used).toBe(2);
      expect(result.daily.limit).toBe(5);
      expect(result.total.aiCreated).toBe(5);
      expect(result.health.passed).toBe(true);
    });

    it("should return allowed=false when daily limit exceeded", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            ai_folder_count: 5,
            total_folder_count: 10,
            empty_folder_count: 1,
            total_bookmark_count: 100,
            today_created_count: 6, // 超过每日限制
          },
        ],
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { settings: { ai_folder_daily_limit: 5 } },
              error: null,
            }),
          }),
        }),
      });

      const result = await service.checkQuota("user-123");

      expect(result.allowed).toBe(false);
      expect(result.daily.remaining).toBe(0);
    });

    it("should return allowed=false when health gate fails", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            ai_folder_count: 5,
            total_folder_count: 10,
            empty_folder_count: 5, // 超过空文件夹阈值
            total_bookmark_count: 100,
            today_created_count: 2,
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

      const result = await service.checkQuota("user-123");

      expect(result.allowed).toBe(false);
      expect(result.health.passed).toBe(false);
      expect(result.health.reason).toContain("5 个空文件夹");
    });

    it("should return conservative result on error", async () => {
      mockSupabase.rpc.mockRejectedValue(new Error("Database error"));

      const result = await service.checkQuota("user-123");

      // 错误时允许创建，避免阻塞用户
      expect(result.allowed).toBe(true);
    });
  });
});
