/**
 * DistributionService 单元测试
 */

import { DistributionService } from "../core/distribution.service";
import { DistributionRegistry } from "../core/distribution.registry";
import type { IDistributionAdapter } from "../interfaces";
import type { DistributionResult } from "../types";
import {
  TargetNotFoundError,
  TargetDisabledError,
  AdapterNotFoundError,
  PlatformNotSupportedError,
} from "../errors";

// Mock target data
const mockTargetData = {
  id: "target-1",
  user_id: "user-1",
  target_type: "obsidian",
  name: "我的 Obsidian",
  enabled: true,
  trigger_mode: "manual",
  schedule_interval_minutes: null,
  filter_platforms: null,
  filter_folders: null,
  filter_tags: null,
  include_ai_summary: true,
  target_config: { vaultPath: "/path/to/vault" },
  status: "idle",
  last_sync_at: null,
  last_error: null,
  synced_count: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const mockBookmarkData = [
  {
    id: "bookmark-1",
    title: "Test Bookmark",
    url: "https://example.com",
    platform: "wechat",
    description: null,
    ai_summary: null,
    tags: [],
    folder_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

// Mock Adapter 工厂
function createMockAdapter(
  type: "obsidian" | "notion" | "webhook" | "rss" | "manual_export",
  options?: {
    supportedPlatforms?: ("web" | "mobile" | "desktop")[];
    distributeResult?: DistributionResult;
    distributeError?: Error;
    validateResult?: { valid: boolean; errors: string[] };
    testConnectionResult?: { success: boolean; error?: string };
  },
): IDistributionAdapter {
  const defaultResult: DistributionResult = {
    success: true,
    distributedCount: 1,
    failedCount: 0,
    records: [
      {
        id: "record-1",
        targetId: "target-1",
        bookmarkId: "bookmark-1",
        status: "success",
        distributedAt: new Date(),
        retryCount: 0,
        createdAt: new Date(),
      },
    ],
  };

  return {
    type,
    displayName: `${type} Adapter`,
    supportedPlatforms: options?.supportedPlatforms ?? [
      "web",
      "mobile",
      "desktop",
    ],
    initialize: jest.fn().mockResolvedValue(undefined),
    distribute: options?.distributeError
      ? jest.fn().mockRejectedValue(options.distributeError)
      : jest.fn().mockResolvedValue(options?.distributeResult ?? defaultResult),
    validateConfig: jest
      .fn()
      .mockResolvedValue(
        options?.validateResult ?? { valid: true, errors: [] },
      ),
    testConnection: jest
      .fn()
      .mockResolvedValue(options?.testConnectionResult ?? { success: true }),
  };
}

// 创建链式 mock
function createChainableMock(finalResult: any) {
  const chain: any = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    overlaps: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(finalResult),
  };
  return chain;
}

describe("DistributionService", () => {
  let registry: DistributionRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new DistributionRegistry();
  });

  describe("distribute", () => {
    it("should return empty result when bookmarkIds is empty", async () => {
      const mockSupabase = createChainableMock({
        data: mockTargetData,
        error: null,
      });
      const service = new DistributionService(registry, mockSupabase as any, {
        persistRecords: false,
      });
      registry.register(createMockAdapter("obsidian"));

      const result = await service.distribute("target-1", []);

      expect(result.success).toBe(true);
      expect(result.distributedCount).toBe(0);
      expect(result.records).toEqual([]);
    });

    it("should throw TargetNotFoundError when target does not exist", async () => {
      const mockSupabase = createChainableMock({
        data: null,
        error: { message: "Not found" },
      });
      const service = new DistributionService(registry, mockSupabase as any, {
        persistRecords: false,
      });
      registry.register(createMockAdapter("obsidian"));

      await expect(
        service.distribute("non-existent", ["bookmark-1"]),
      ).rejects.toThrow(TargetNotFoundError);
    });

    it("should throw TargetDisabledError when target is disabled", async () => {
      const mockSupabase = createChainableMock({
        data: { ...mockTargetData, enabled: false },
        error: null,
      });
      const service = new DistributionService(registry, mockSupabase as any, {
        persistRecords: false,
      });
      registry.register(createMockAdapter("obsidian"));

      await expect(
        service.distribute("target-1", ["bookmark-1"]),
      ).rejects.toThrow(TargetDisabledError);
    });

    it("should throw AdapterNotFoundError when adapter is not registered", async () => {
      const mockSupabase = createChainableMock({
        data: mockTargetData,
        error: null,
      });
      const service = new DistributionService(registry, mockSupabase as any, {
        persistRecords: false,
      });
      // 不注册任何适配器

      await expect(
        service.distribute("target-1", ["bookmark-1"]),
      ).rejects.toThrow(AdapterNotFoundError);
    });

    it("should throw PlatformNotSupportedError when platform is not supported", async () => {
      const mockSupabase = createChainableMock({
        data: mockTargetData,
        error: null,
      });
      const service = new DistributionService(registry, mockSupabase as any, {
        persistRecords: false,
      });
      registry.register(
        createMockAdapter("obsidian", { supportedPlatforms: ["desktop"] }),
      );

      await expect(
        service.distribute("target-1", ["bookmark-1"], {
          currentPlatform: "web",
        }),
      ).rejects.toThrow(PlatformNotSupportedError);
    });

    it("should distribute bookmarks successfully", async () => {
      // 创建一个更复杂的 mock，支持多次调用
      let callCount = 0;
      const mockSupabase: any = {
        from: jest.fn().mockImplementation(() => mockSupabase),
        select: jest.fn().mockImplementation(() => mockSupabase),
        insert: jest.fn().mockImplementation(() => mockSupabase),
        update: jest.fn().mockImplementation(() => mockSupabase),
        eq: jest.fn().mockImplementation(() => mockSupabase),
        in: jest.fn().mockImplementation(() => ({
          data: mockBookmarkData,
          error: null,
          then: (fn: any) => fn({ data: mockBookmarkData, error: null }),
        })),
        single: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({ data: mockTargetData, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };

      const service = new DistributionService(registry, mockSupabase, {
        persistRecords: false,
      });
      registry.register(createMockAdapter("obsidian"));

      const result = await service.distribute("target-1", ["bookmark-1"]);

      expect(result.success).toBe(true);
      expect(result.distributedCount).toBe(1);
    });
  });

  describe("isDistributing", () => {
    it("should return false when not distributing", () => {
      const mockSupabase = createChainableMock({ data: null, error: null });
      const service = new DistributionService(registry, mockSupabase as any);

      expect(service.isDistributing("target-1")).toBe(false);
    });
  });

  describe("getTarget", () => {
    it("should return target when exists", async () => {
      const mockSupabase = createChainableMock({
        data: mockTargetData,
        error: null,
      });
      const service = new DistributionService(registry, mockSupabase as any);

      const target = await service.getTarget("target-1");

      expect(target).not.toBeNull();
      expect(target?.id).toBe("target-1");
      expect(target?.targetType).toBe("obsidian");
    });

    it("should return null when target does not exist", async () => {
      const mockSupabase = createChainableMock({
        data: null,
        error: { message: "Not found" },
      });
      const service = new DistributionService(registry, mockSupabase as any);

      const target = await service.getTarget("non-existent");

      expect(target).toBeNull();
    });
  });

  describe("getTargets", () => {
    it("should return user targets", async () => {
      const mockSupabase: any = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest
          .fn()
          .mockResolvedValue({ data: [mockTargetData], error: null }),
      };
      const service = new DistributionService(registry, mockSupabase);

      const targets = await service.getTargets("user-1");

      expect(targets).toHaveLength(1);
      expect(targets[0].userId).toBe("user-1");
    });

    it("should return empty array when no targets", async () => {
      const mockSupabase: any = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
      const service = new DistributionService(registry, mockSupabase);

      const targets = await service.getTargets("user-1");

      expect(targets).toEqual([]);
    });
  });

  describe("createTarget", () => {
    it("should create target successfully", async () => {
      const mockSupabase = createChainableMock({
        data: mockTargetData,
        error: null,
      });
      const service = new DistributionService(registry, mockSupabase as any);
      registry.register(createMockAdapter("obsidian"));

      const target = await service.createTarget({
        userId: "user-1",
        targetType: "obsidian",
        name: "我的 Obsidian",
        trigger: { mode: "manual" },
        targetConfig: { vaultPath: "/path/to/vault" },
      });

      expect(target.id).toBe("target-1");
      expect(target.name).toBe("我的 Obsidian");
    });

    it("should throw AdapterNotFoundError for unknown adapter type", async () => {
      const mockSupabase = createChainableMock({ data: null, error: null });
      const service = new DistributionService(registry, mockSupabase as any);

      await expect(
        service.createTarget({
          userId: "user-1",
          targetType: "notion" as any,
          name: "Test",
          trigger: { mode: "manual" },
          targetConfig: {},
        }),
      ).rejects.toThrow(AdapterNotFoundError);
    });
  });

  describe("updateTarget", () => {
    it("should update target successfully", async () => {
      const mockSupabase = createChainableMock({
        data: { ...mockTargetData, name: "更新后的名称" },
        error: null,
      });
      const service = new DistributionService(registry, mockSupabase as any);

      const target = await service.updateTarget("target-1", {
        name: "更新后的名称",
      });

      expect(target.name).toBe("更新后的名称");
    });
  });

  describe("deleteTarget", () => {
    it("should delete target successfully", async () => {
      const mockSupabase: any = {
        from: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      const service = new DistributionService(registry, mockSupabase);

      await expect(service.deleteTarget("target-1")).resolves.not.toThrow();
    });
  });

  describe("validateConfig", () => {
    it("should return valid result for valid config", async () => {
      const mockSupabase = createChainableMock({ data: null, error: null });
      const service = new DistributionService(registry, mockSupabase as any);
      registry.register(createMockAdapter("obsidian"));

      const result = await service.validateConfig("obsidian", {
        vaultPath: "/path/to/vault",
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should return invalid result for unknown adapter type", async () => {
      const mockSupabase = createChainableMock({ data: null, error: null });
      const service = new DistributionService(registry, mockSupabase as any);

      const result = await service.validateConfig("unknown" as any, {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("未知的分发类型: unknown");
    });
  });

  describe("testConnection", () => {
    it("should return success for valid connection", async () => {
      const mockSupabase = createChainableMock({ data: null, error: null });
      const service = new DistributionService(registry, mockSupabase as any);
      registry.register(createMockAdapter("obsidian"));

      const result = await service.testConnection("obsidian", {
        vaultPath: "/path/to/vault",
      });

      expect(result.success).toBe(true);
    });

    it("should return failure for unknown adapter type", async () => {
      const mockSupabase = createChainableMock({ data: null, error: null });
      const service = new DistributionService(registry, mockSupabase as any);

      const result = await service.testConnection("unknown" as any, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain("未知的分发类型");
    });
  });
});
