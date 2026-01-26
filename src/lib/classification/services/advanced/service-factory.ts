/**
 * V4.0 服务工厂
 *
 * 统一管理所有 V4.0 分类服务的生命周期：
 * - 单例实例管理
 * - 依赖注入
 * - 优雅关闭
 * - 内存清理
 *
 * 设计原则：
 * - 集中式管理避免内存泄漏
 * - 支持 Next.js 热重载环境
 * - 延迟初始化减少启动时间
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";

// 服务导入
import { ConfigCenterService } from "./config-center.service";
import {
  CorrectionCacheService,
  type CorrectionCacheConfig,
} from "./correction-cache.service";
import { RerankerService, type RerankConfig } from "./reranker.service";
import { TraceStorageService } from "./trace.service";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 服务工厂配置
 */
export interface ServiceFactoryConfig {
  correctionCache?: Partial<CorrectionCacheConfig>;
  reranker?: Partial<RerankConfig>;
}

/**
 * 服务状态
 */
interface ServiceState {
  configCenter: ConfigCenterService | null;
  correctionCache: CorrectionCacheService | null;
  reranker: RerankerService | null;
  traceStorage: TraceStorageService | null;
}

// ============================================================================
// 服务工厂实现
// ============================================================================

/**
 * V4.0 服务工厂类
 */
class ServiceFactory {
  private supabase: SupabaseClient<Database> | null = null;
  private config: ServiceFactoryConfig = {};
  private services: ServiceState = {
    configCenter: null,
    correctionCache: null,
    reranker: null,
    traceStorage: null,
  };
  private initialized = false;

  /**
   * 初始化服务工厂
   *
   * @param supabase Supabase 客户端
   * @param config 可选配置
   */
  initialize(
    supabase: SupabaseClient<Database>,
    config?: ServiceFactoryConfig,
  ): void {
    if (this.initialized && this.supabase === supabase) {
      return; // 已初始化且客户端相同，跳过
    }

    // 如果客户端变化，先清理旧实例
    if (this.initialized && this.supabase !== supabase) {
      this.cleanup();
    }

    this.supabase = supabase;
    this.config = config || {};
    this.initialized = true;

    logger.debug("ServiceFactory: Initialized");
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized && this.supabase !== null;
  }

  /**
   * 获取 ConfigCenterService 实例（延迟初始化）
   */
  getConfigCenter(): ConfigCenterService {
    this.ensureInitialized();

    if (!this.services.configCenter) {
      if (!this.supabase) {
        throw new Error("ServiceFactory: Supabase client not initialized");
      }
      this.services.configCenter = new ConfigCenterService(this.supabase);
      logger.debug("ServiceFactory: ConfigCenterService created");
    }

    return this.services.configCenter;
  }

  /**
   * 获取 CorrectionCacheService 实例（延迟初始化）
   */
  getCorrectionCache(): CorrectionCacheService {
    // CorrectionCache 不依赖 Supabase，可以独立使用
    if (!this.services.correctionCache) {
      this.services.correctionCache = new CorrectionCacheService(
        this.config.correctionCache,
      );
      logger.debug("ServiceFactory: CorrectionCacheService created");
    }

    return this.services.correctionCache;
  }

  /**
   * 获取 RerankerService 实例（延迟初始化）
   */
  getReranker(): RerankerService {
    this.ensureInitialized();

    if (!this.services.reranker) {
      if (!this.supabase) {
        throw new Error("ServiceFactory: Supabase client not initialized");
      }
      this.services.reranker = new RerankerService(
        this.supabase,
        this.config.reranker,
      );
      logger.debug("ServiceFactory: RerankerService created");
    }

    return this.services.reranker;
  }

  /**
   * 获取 TraceStorageService 实例（延迟初始化）
   */
  getTraceStorage(): TraceStorageService {
    this.ensureInitialized();

    if (!this.services.traceStorage) {
      if (!this.supabase) {
        throw new Error("ServiceFactory: Supabase client not initialized");
      }
      this.services.traceStorage = new TraceStorageService(this.supabase);
      logger.debug("ServiceFactory: TraceStorageService created");
    }

    return this.services.traceStorage;
  }

  /**
   * 清理所有服务实例
   */
  cleanup(): void {
    // 停止 CorrectionCache 的定时器
    if (this.services.correctionCache) {
      this.services.correctionCache.stop();
    }

    // 清除 Reranker 缓存
    if (this.services.reranker) {
      this.services.reranker.clearCache();
    }

    // 停止 ConfigCenter 自动刷新
    if (this.services.configCenter) {
      this.services.configCenter.stop();
    }

    // 重置所有实例
    this.services = {
      configCenter: null,
      correctionCache: null,
      reranker: null,
      traceStorage: null,
    };

    this.supabase = null;
    this.initialized = false;

    logger.info("ServiceFactory: All services cleaned up");
  }

  /**
   * 获取服务状态统计
   */
  getStats(): {
    initialized: boolean;
    activeServices: string[];
    correctionCacheStats?: ReturnType<CorrectionCacheService["getStats"]>;
  } {
    const activeServices: string[] = [];

    if (this.services.configCenter) activeServices.push("configCenter");
    if (this.services.correctionCache) activeServices.push("correctionCache");
    if (this.services.reranker) activeServices.push("reranker");
    if (this.services.traceStorage) activeServices.push("traceStorage");

    return {
      initialized: this.initialized,
      activeServices,
      correctionCacheStats: this.services.correctionCache?.getStats(),
    };
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.supabase) {
      throw new Error(
        "ServiceFactory not initialized. Call initialize() first.",
      );
    }
  }
}

// ============================================================================
// 全局单例
// ============================================================================

// 使用 globalThis 确保在 Next.js 热重载时保持单例
const globalKey = "__v4_service_factory__";

function getGlobalFactory(): ServiceFactory {
  if (!(globalThis as Record<string, unknown>)[globalKey]) {
    (globalThis as Record<string, unknown>)[globalKey] = new ServiceFactory();
  }
  return (globalThis as Record<string, unknown>)[globalKey] as ServiceFactory;
}

/**
 * 获取全局服务工厂实例
 */
export const serviceFactory = getGlobalFactory();

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 初始化所有 V4.0 服务
 *
 * @param supabase Supabase 客户端
 * @param config 可选配置
 */
export function initializeV4Services(
  supabase: SupabaseClient<Database>,
  config?: ServiceFactoryConfig,
): void {
  serviceFactory.initialize(supabase, config);
}

/**
 * 清理所有 V4.0 服务
 */
export function cleanupV4Services(): void {
  serviceFactory.cleanup();
}

/**
 * 获取 ConfigCenterService
 */
export function getConfigCenter(): ConfigCenterService {
  return serviceFactory.getConfigCenter();
}

/**
 * 获取 CorrectionCacheService
 */
export function getCorrectionCache(): CorrectionCacheService {
  return serviceFactory.getCorrectionCache();
}

/**
 * 获取 RerankerService
 */
export function getReranker(): RerankerService {
  return serviceFactory.getReranker();
}

/**
 * 获取 TraceStorageService
 */
export function getTraceStorage(): TraceStorageService {
  return serviceFactory.getTraceStorage();
}
