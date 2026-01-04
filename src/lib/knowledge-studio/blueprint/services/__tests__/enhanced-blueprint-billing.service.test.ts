/**
 * EnhancedBlueprintBillingService - 单元测试
 * @module knowledge-studio/blueprint/services
 *
 * Story 8.2 测试用例:
 * - Free 用户配额检查（3 次/月限制）
 * - Pro/Enterprise 用户无限配额
 * - 使用量记录（含 creditsCost）
 * - 配额不足错误处理
 */

import {
  EnhancedBlueprintBillingService,
  createEnhancedBlueprintBillingService,
  getEnhancedBlueprintBillingService,
} from "../enhanced-blueprint-billing.service";
import type { EnhancedBlueprintEngine } from "../../enhanced-blueprint-engine";
import type { StructuredOutput } from "../../types";

// ============================================================================
// Mocks
// ============================================================================

// Mock Supabase Server
const mockSupabaseSelect = jest.fn();
const mockSupabaseEq = jest.fn();
const mockSupabaseSingle = jest.fn();
const mockSupabaseFrom = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: mockSupabaseFrom,
    }),
  ),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Mock UsageTracker
const mockCheckQuota = jest.fn();
const mockTrackUsage = jest.fn();

jest.mock("../../../billing/usage-tracker", () => ({
  createUsageTracker: jest.fn(() => ({
    checkQuota: mockCheckQuota,
    trackUsage: mockTrackUsage,
  })),
}));

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * 创建 Mock 蓝图
 */
function createMockBlueprint(
  creditsCost: number = 2,
): EnhancedBlueprintEngine<StructuredOutput> {
  return {
    blueprintId: "test_blueprint",
    displayName: "Test Blueprint",
    creditsCost,
    tier: "free",
    execute: jest.fn().mockResolvedValue({ success: true }),
  } as unknown as EnhancedBlueprintEngine<StructuredOutput>;
}

/**
 * 设置 Supabase Mock 返回
 */
function setupSupabaseMock(membershipType: string, error: Error | null = null) {
  mockSupabaseSingle.mockResolvedValue({
    data: error ? null : { membership_type: membershipType },
    error: error ? { message: error.message } : null,
  });
  mockSupabaseEq.mockReturnValue({ single: mockSupabaseSingle });
  mockSupabaseSelect.mockReturnValue({ eq: mockSupabaseEq });
  mockSupabaseFrom.mockReturnValue({ select: mockSupabaseSelect });
}

// ============================================================================
// Tests
// ============================================================================

describe("EnhancedBlueprintBillingService", () => {
  let service: EnhancedBlueprintBillingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EnhancedBlueprintBillingService();
  });

  // ==========================================================================
  // checkQuota
  // ==========================================================================

  describe("checkQuota", () => {
    const userId = "test-user-id";

    describe("Free 用户", () => {
      beforeEach(() => {
        setupSupabaseMock("free");
      });

      it("应该在有足够配额时返回 hasQuota: true", async () => {
        const blueprint = createMockBlueprint(2);
        mockCheckQuota.mockResolvedValue({
          remaining: 5,
          limit: 3,
          isExceeded: false,
        });

        const result = await service.checkQuota(userId, blueprint);

        expect(result.hasQuota).toBe(true);
        expect(result.remaining).toBe(5);
        expect(result.creditsCost).toBe(2);
        expect(result.membershipType).toBe("free");
        expect(result.message).toBeUndefined();
      });

      it("应该在配额不足时返回 hasQuota: false", async () => {
        const blueprint = createMockBlueprint(3);
        mockCheckQuota.mockResolvedValue({
          remaining: 2,
          limit: 3,
          isExceeded: false,
        });

        const result = await service.checkQuota(userId, blueprint);

        expect(result.hasQuota).toBe(false);
        expect(result.remaining).toBe(2);
        expect(result.creditsCost).toBe(3);
        expect(result.message).toContain("剩余 2 点配额");
      });

      it("应该在配额用尽时返回升级提示", async () => {
        const blueprint = createMockBlueprint(2);
        mockCheckQuota.mockResolvedValue({
          remaining: 0,
          limit: 3,
          isExceeded: true,
        });

        const result = await service.checkQuota(userId, blueprint);

        expect(result.hasQuota).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.message).toContain("升级到专业版");
      });
    });

    describe("Pro 用户", () => {
      beforeEach(() => {
        setupSupabaseMock("pro");
      });

      it("应该返回无限配额", async () => {
        const blueprint = createMockBlueprint(3);

        const result = await service.checkQuota(userId, blueprint);

        expect(result.hasQuota).toBe(true);
        expect(result.limit).toBe(-1);
        expect(result.remaining).toBe(999999);
        expect(result.membershipType).toBe("pro");
        // 不应调用 UsageTracker.checkQuota
        expect(mockCheckQuota).not.toHaveBeenCalled();
      });
    });

    describe("Enterprise 用户", () => {
      beforeEach(() => {
        setupSupabaseMock("enterprise");
      });

      it("应该返回无限配额", async () => {
        const blueprint = createMockBlueprint(3);

        const result = await service.checkQuota(userId, blueprint);

        expect(result.hasQuota).toBe(true);
        expect(result.limit).toBe(-1);
        expect(result.membershipType).toBe("enterprise");
      });
    });

    describe("错误处理", () => {
      it("应该在获取用户信息失败时返回 fail-secure", async () => {
        setupSupabaseMock("free", new Error("Database error"));
        const blueprint = createMockBlueprint(2);

        const result = await service.checkQuota(userId, blueprint);

        expect(result.hasQuota).toBe(false);
        expect(result.message).toContain("无法验证会员状态");
      });
    });
  });

  // ==========================================================================
  // executeWithQuota
  // ==========================================================================

  describe("executeWithQuota", () => {
    const userId = "test-user-id";

    describe("成功执行", () => {
      beforeEach(() => {
        setupSupabaseMock("free");
        mockCheckQuota.mockResolvedValue({
          remaining: 5,
          limit: 3,
          isExceeded: false,
        });
        mockTrackUsage.mockResolvedValue(undefined);
      });

      it("应该执行操作并记录使用量", async () => {
        const blueprint = createMockBlueprint(2);
        const operation = jest.fn().mockResolvedValue({ content: "test" });

        const result = await service.executeWithQuota(
          userId,
          blueprint,
          operation,
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ content: "test" });
        expect(operation).toHaveBeenCalled();
        expect(mockTrackUsage).toHaveBeenCalledWith(
          expect.objectContaining({
            userId,
            type: "generation",
            amount: 2, // creditsCost
            unit: "credits",
          }),
        );
      });

      it("应该记录蓝图元数据", async () => {
        const blueprint = createMockBlueprint(3);
        const operation = jest.fn().mockResolvedValue({});

        await service.executeWithQuota(userId, blueprint, operation, {
          resourceId: "report-123",
        });

        expect(mockTrackUsage).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceId: "report-123",
            metadata: expect.objectContaining({
              blueprintId: "test_blueprint",
              blueprintName: "Test Blueprint",
              creditsCost: 3,
            }),
          }),
        );
      });
    });

    describe("配额不足", () => {
      beforeEach(() => {
        setupSupabaseMock("free");
        mockCheckQuota.mockResolvedValue({
          remaining: 1,
          limit: 3,
          isExceeded: false,
        });
      });

      it("应该在配额不足时返回错误", async () => {
        const blueprint = createMockBlueprint(2); // 需要 2 点，只有 1 点
        const operation = jest.fn();

        const result = await service.executeWithQuota(
          userId,
          blueprint,
          operation,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("QUOTA_EXCEEDED");
        expect(operation).not.toHaveBeenCalled();
        expect(mockTrackUsage).not.toHaveBeenCalled();
      });
    });

    describe("执行失败", () => {
      beforeEach(() => {
        setupSupabaseMock("free");
        mockCheckQuota.mockResolvedValue({
          remaining: 5,
          limit: 3,
          isExceeded: false,
        });
      });

      it("应该返回错误且不记录使用量", async () => {
        const blueprint = createMockBlueprint(2);
        const operation = jest
          .fn()
          .mockRejectedValue(new Error("Generation failed"));

        const result = await service.executeWithQuota(
          userId,
          blueprint,
          operation,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("EXECUTION_FAILED");
        expect(result.error?.message).toBe("Generation failed");
        expect(mockTrackUsage).not.toHaveBeenCalled();
      });
    });

    describe("禁用配额检查", () => {
      it("应该跳过配额检查直接执行", async () => {
        const disabledService = new EnhancedBlueprintBillingService({
          enableQuotaCheck: false,
        });
        setupSupabaseMock("free");
        mockCheckQuota.mockResolvedValue({
          remaining: 0, // 配额用尽
          limit: 3,
          isExceeded: true,
        });
        mockTrackUsage.mockResolvedValue(undefined);

        const blueprint = createMockBlueprint(2);
        const operation = jest.fn().mockResolvedValue({ done: true });

        const result = await disabledService.executeWithQuota(
          userId,
          blueprint,
          operation,
        );

        expect(result.success).toBe(true);
        expect(operation).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // trackUsage
  // ==========================================================================

  describe("trackUsage", () => {
    beforeEach(() => {
      mockTrackUsage.mockResolvedValue(undefined);
    });

    it("应该使用蓝图的 creditsCost 记录使用量", async () => {
      const blueprint = createMockBlueprint(3);

      await service.trackUsage("user-123", blueprint);

      expect(mockTrackUsage).toHaveBeenCalledWith({
        userId: "user-123",
        type: "generation",
        amount: 3,
        unit: "credits",
        timestamp: expect.any(Date),
        resourceId: undefined,
        metadata: expect.objectContaining({
          blueprintId: "test_blueprint",
          creditsCost: 3,
        }),
      });
    });
  });

  // ==========================================================================
  // getMonthlyUsage
  // ==========================================================================

  describe("getMonthlyUsage", () => {
    const userId = "test-user-id";

    it("应该返回 Free 用户的月度使用统计", async () => {
      setupSupabaseMock("free");
      mockCheckQuota.mockResolvedValue({
        remaining: 1,
        limit: 3,
        isExceeded: false,
      });

      const usage = await service.getMonthlyUsage(userId);

      expect(usage.used).toBe(2); // 3 - 1
      expect(usage.limit).toBe(3);
      expect(usage.remaining).toBe(1);
      expect(usage.membershipType).toBe("free");
      expect(usage.resetAt).toBeInstanceOf(Date);
    });

    it("应该返回 Pro 用户的无限配额", async () => {
      setupSupabaseMock("pro");

      const usage = await service.getMonthlyUsage(userId);

      expect(usage.limit).toBe(-1);
      expect(usage.remaining).toBe(999999);
      expect(usage.membershipType).toBe("pro");
    });
  });

  // ==========================================================================
  // 工厂函数
  // ==========================================================================

  describe("工厂函数", () => {
    it("createEnhancedBlueprintBillingService 应该创建新实例", () => {
      const service1 = createEnhancedBlueprintBillingService();
      const service2 = createEnhancedBlueprintBillingService();

      expect(service1).toBeInstanceOf(EnhancedBlueprintBillingService);
      expect(service1).not.toBe(service2);
    });

    it("getEnhancedBlueprintBillingService 应该返回单例", () => {
      const service1 = getEnhancedBlueprintBillingService();
      const service2 = getEnhancedBlueprintBillingService();

      expect(service1).toBe(service2);
    });
  });

  // ==========================================================================
  // Story 8.2 验收测试
  // ==========================================================================

  describe("Story 8.2: Free 用户试用限制", () => {
    const userId = "free-user-id";

    beforeEach(() => {
      setupSupabaseMock("free");
    });

    it("应该允许 Free 用户在配额内使用蓝图", async () => {
      mockCheckQuota.mockResolvedValue({
        remaining: 3, // 满配额
        limit: 3,
        isExceeded: false,
      });
      mockTrackUsage.mockResolvedValue(undefined);

      const blueprint = createMockBlueprint(2);
      const operation = jest.fn().mockResolvedValue({ success: true });

      const result = await service.executeWithQuota(
        userId,
        blueprint,
        operation,
      );

      expect(result.success).toBe(true);
    });

    it("应该在第 3 次使用后阻止 Free 用户", async () => {
      mockCheckQuota.mockResolvedValue({
        remaining: 0, // 配额用尽
        limit: 3,
        isExceeded: true,
      });

      const blueprint = createMockBlueprint(2);
      const operation = jest.fn();

      const result = await service.executeWithQuota(
        userId,
        blueprint,
        operation,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("QUOTA_EXCEEDED");
      expect(result.quotaInfo?.message).toContain("升级到专业版");
    });

    it("应该正确消耗差异化配额（2 点蓝图）", async () => {
      mockCheckQuota
        .mockResolvedValueOnce({ remaining: 3, limit: 3, isExceeded: false }) // 执行前检查
        .mockResolvedValueOnce({ remaining: 1, limit: 3, isExceeded: false }); // 执行后检查
      mockTrackUsage.mockResolvedValue(undefined);

      const blueprint = createMockBlueprint(2);
      const operation = jest.fn().mockResolvedValue({});

      const result = await service.executeWithQuota(
        userId,
        blueprint,
        operation,
      );

      expect(result.success).toBe(true);
      expect(mockTrackUsage).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 2 }),
      );
    });

    it("应该正确消耗差异化配额（3 点蓝图）", async () => {
      mockCheckQuota.mockResolvedValue({
        remaining: 3,
        limit: 3,
        isExceeded: false,
      });
      mockTrackUsage.mockResolvedValue(undefined);

      const blueprint = createMockBlueprint(3);
      const operation = jest.fn().mockResolvedValue({});

      await service.executeWithQuota(userId, blueprint, operation);

      expect(mockTrackUsage).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 3 }),
      );
    });
  });
});
