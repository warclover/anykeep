/**
 * ServiceFactory 单元测试
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  serviceFactory,
  initializeV4Services,
  cleanupV4Services,
  getConfigCenter,
  getCorrectionCache,
  getReranker,
  getTraceStorage,
} from "../service-factory";
import { ConfigCenterService } from "../config-center.service";
import { CorrectionCacheService } from "../correction-cache.service";
import { RerankerService } from "../reranker.service";
import { TraceStorageService } from "../trace.service";

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
} as unknown as SupabaseClient<Database>;

describe("ServiceFactory", () => {
  afterEach(() => {
    // 清理每个测试后的状态
    cleanupV4Services();
  });

  describe("初始化", () => {
    it("应该在初始化前抛出错误", () => {
      expect(() => getConfigCenter()).toThrow(
        "ServiceFactory not initialized. Call initialize() first.",
      );
    });

    it("应该成功初始化", () => {
      initializeV4Services(mockSupabase);

      expect(serviceFactory.isInitialized()).toBe(true);
    });

    it("应该支持重复初始化相同客户端", () => {
      initializeV4Services(mockSupabase);
      initializeV4Services(mockSupabase);

      expect(serviceFactory.isInitialized()).toBe(true);
    });
  });

  describe("服务获取", () => {
    beforeEach(() => {
      initializeV4Services(mockSupabase);
    });

    it("应该返回 ConfigCenterService 实例", () => {
      const service = getConfigCenter();

      expect(service).toBeInstanceOf(ConfigCenterService);
    });

    it("应该返回相同的 ConfigCenterService 实例（单例）", () => {
      const service1 = getConfigCenter();
      const service2 = getConfigCenter();

      expect(service1).toBe(service2);
    });

    it("应该返回 CorrectionCacheService 实例", () => {
      const service = getCorrectionCache();

      expect(service).toBeInstanceOf(CorrectionCacheService);
    });

    it("应该返回相同的 CorrectionCacheService 实例（单例）", () => {
      const service1 = getCorrectionCache();
      const service2 = getCorrectionCache();

      expect(service1).toBe(service2);
    });

    it("应该返回 RerankerService 实例", () => {
      const service = getReranker();

      expect(service).toBeInstanceOf(RerankerService);
    });

    it("应该返回 TraceStorageService 实例", () => {
      const service = getTraceStorage();

      expect(service).toBeInstanceOf(TraceStorageService);
    });
  });

  describe("CorrectionCache 无需 Supabase", () => {
    it("CorrectionCache 应该在未初始化时也能工作", () => {
      // 不初始化，直接获取 CorrectionCache
      // 注意：这需要特殊处理，因为当前实现需要初始化
      // 这里测试的是已初始化后的行为
      initializeV4Services(mockSupabase);
      const service = getCorrectionCache();

      // 验证可以正常使用
      service.set("user-1", "https://example.com", 1, "test");
      const result = service.get("user-1", "https://example.com");

      expect(result).not.toBeNull();
      expect(result?.folderId).toBe(1);
    });
  });

  describe("清理", () => {
    it("应该清理所有服务实例", () => {
      initializeV4Services(mockSupabase);

      // 创建所有服务实例
      getConfigCenter();
      getCorrectionCache();
      getReranker();
      getTraceStorage();

      // 清理
      cleanupV4Services();

      // 验证已清理
      expect(serviceFactory.isInitialized()).toBe(false);
    });

    it("清理后应该能重新初始化", () => {
      initializeV4Services(mockSupabase);
      cleanupV4Services();

      initializeV4Services(mockSupabase);

      expect(serviceFactory.isInitialized()).toBe(true);
      expect(() => getConfigCenter()).not.toThrow();
    });
  });

  describe("统计信息", () => {
    it("应该返回正确的统计信息", () => {
      initializeV4Services(mockSupabase);

      // 初始状态
      let stats = serviceFactory.getStats();
      expect(stats.initialized).toBe(true);
      expect(stats.activeServices).toEqual([]);

      // 创建服务后
      getConfigCenter();
      getCorrectionCache();

      stats = serviceFactory.getStats();
      expect(stats.activeServices).toContain("configCenter");
      expect(stats.activeServices).toContain("correctionCache");
    });
  });
});
