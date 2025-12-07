/**
 * User Stage Service Unit Tests
 * 测试用户生命周期阶段判断逻辑
 */

import { UserStageService } from "../services/user-stage.service";
import { USER_LIFECYCLE_THRESHOLDS } from "../constants";

// Mock Supabase client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSupabase: any = {
  rpc: jest.fn(),
};

describe("UserStageService", () => {
  let service: UserStageService;

  beforeEach(() => {
    service = new UserStageService(mockSupabase);
    jest.clearAllMocks();
  });

  describe("getStageFromCount", () => {
    describe("onboarding stage", () => {
      it("should return onboarding when not completed and 0 bookmarks", () => {
        const stage = service.getStageFromCount(0, false);
        expect(stage).toBe("onboarding");
      });

      it("should NOT return onboarding when completed even with 0 bookmarks", () => {
        const stage = service.getStageFromCount(0, true);
        expect(stage).toBe("cold_start");
      });
    });

    describe("cold_start stage", () => {
      it("should return cold_start for 0 bookmarks (onboarding completed)", () => {
        const stage = service.getStageFromCount(0, true);
        expect(stage).toBe("cold_start");
      });

      it("should return cold_start for bookmarks <= COLD_START_MAX", () => {
        const stage = service.getStageFromCount(
          USER_LIFECYCLE_THRESHOLDS.COLD_START_MAX,
          true,
        );
        expect(stage).toBe("cold_start");
      });

      it("should return cold_start at boundary (20 bookmarks)", () => {
        const stage = service.getStageFromCount(20, true);
        expect(stage).toBe("cold_start");
      });

      it("should return cold_start for 1 bookmark (not completed)", () => {
        // When not completed but has bookmarks, it uses count-based logic
        const stage = service.getStageFromCount(1, false);
        expect(stage).toBe("cold_start");
      });
    });

    describe("growing stage", () => {
      it("should return growing for bookmarks > COLD_START_MAX", () => {
        const stage = service.getStageFromCount(
          USER_LIFECYCLE_THRESHOLDS.COLD_START_MAX + 1,
          true,
        );
        expect(stage).toBe("growing");
      });

      it("should return growing at boundary (21 bookmarks)", () => {
        const stage = service.getStageFromCount(21, true);
        expect(stage).toBe("growing");
      });

      it("should return growing for bookmarks <= GROWING_MAX", () => {
        const stage = service.getStageFromCount(
          USER_LIFECYCLE_THRESHOLDS.GROWING_MAX,
          true,
        );
        expect(stage).toBe("growing");
      });

      it("should return growing at upper boundary (100 bookmarks)", () => {
        const stage = service.getStageFromCount(100, true);
        expect(stage).toBe("growing");
      });
    });

    describe("mature stage", () => {
      it("should return mature for bookmarks > GROWING_MAX", () => {
        const stage = service.getStageFromCount(
          USER_LIFECYCLE_THRESHOLDS.GROWING_MAX + 1,
          true,
        );
        expect(stage).toBe("mature");
      });

      it("should return mature at boundary (101 bookmarks)", () => {
        const stage = service.getStageFromCount(101, true);
        expect(stage).toBe("mature");
      });

      it("should return mature for large bookmark count", () => {
        const stage = service.getStageFromCount(1000, true);
        expect(stage).toBe("mature");
      });

      it("should return mature for very large bookmark count", () => {
        const stage = service.getStageFromCount(10000, false);
        expect(stage).toBe("mature");
      });
    });
  });

  describe("getStageDescription", () => {
    it("should return correct description for onboarding", () => {
      const desc = service.getStageDescription("onboarding");
      expect(desc.title).toBe("新手入门");
      expect(desc.description).toContain("欢迎");
      expect(desc.tip).toContain("兴趣领域");
    });

    it("should return correct description for cold_start", () => {
      const desc = service.getStageDescription("cold_start");
      expect(desc.title).toBe("冷启动期");
      expect(desc.description).toContain("待整理");
      expect(desc.tip).toContain("20");
    });

    it("should return correct description for growing", () => {
      const desc = service.getStageDescription("growing");
      expect(desc.title).toBe("成长期");
      expect(desc.description).toContain("学习");
      expect(desc.tip).toContain("定期整理");
    });

    it("should return correct description for mature", () => {
      const desc = service.getStageDescription("mature");
      expect(desc.title).toBe("成熟期");
      expect(desc.description).toContain("充分了解");
      expect(desc.tip).toContain("手动调整");
    });

    it("each stage should have all required fields", () => {
      const stages = ["onboarding", "cold_start", "growing", "mature"] as const;

      for (const stage of stages) {
        const desc = service.getStageDescription(stage);
        expect(desc).toHaveProperty("title");
        expect(desc).toHaveProperty("description");
        expect(desc).toHaveProperty("tip");
        expect(typeof desc.title).toBe("string");
        expect(typeof desc.description).toBe("string");
        expect(typeof desc.tip).toBe("string");
        expect(desc.title.length).toBeGreaterThan(0);
        expect(desc.description.length).toBeGreaterThan(0);
        expect(desc.tip.length).toBeGreaterThan(0);
      }
    });
  });

  describe("getStage (with mock)", () => {
    it("should return stage from RPC call", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: "growing", error: null });

      const stage = await service.getStage("user-123");

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "get_user_classification_stage",
        {
          p_user_id: "user-123",
        },
      );
      expect(stage).toBe("growing");
    });

    it("should return onboarding as default when RPC returns null", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });

      const stage = await service.getStage("user-123");
      expect(stage).toBe("onboarding");
    });

    it("should return fallback stage when RPC fails", async () => {
      // V2: getStage now has fallback logic instead of throwing
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Database error" },
      });

      // Mock fallback queries
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              not: jest.fn().mockResolvedValue({ count: 0 }),
            }),
            single: jest.fn().mockResolvedValue({
              data: { settings: {} },
              error: null,
            }),
          }),
        }),
      });

      // Should return cold_start as safe default
      const stage = await service.getStage("user-123");
      expect(stage).toBe("cold_start");
    });
  });

  describe("isInColdStart", () => {
    it("should return true for onboarding stage", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: "onboarding",
        error: null,
      });

      const result = await service.isInColdStart("user-123");
      expect(result).toBe(true);
    });

    it("should return true for cold_start stage", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: "cold_start",
        error: null,
      });

      const result = await service.isInColdStart("user-123");
      expect(result).toBe(true);
    });

    it("should return false for growing stage", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: "growing", error: null });

      const result = await service.isInColdStart("user-123");
      expect(result).toBe(false);
    });

    it("should return false for mature stage", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: "mature", error: null });

      const result = await service.isInColdStart("user-123");
      expect(result).toBe(false);
    });
  });
});

describe("USER_LIFECYCLE_THRESHOLDS values", () => {
  it("should have correct cold start threshold", () => {
    expect(USER_LIFECYCLE_THRESHOLDS.COLD_START_MAX).toBe(20);
  });

  it("should have correct growing threshold", () => {
    expect(USER_LIFECYCLE_THRESHOLDS.GROWING_MAX).toBe(100);
  });

  it("should have growing threshold greater than cold start", () => {
    expect(USER_LIFECYCLE_THRESHOLDS.GROWING_MAX).toBeGreaterThan(
      USER_LIFECYCLE_THRESHOLDS.COLD_START_MAX,
    );
  });
});
