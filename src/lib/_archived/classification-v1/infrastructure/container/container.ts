/**
 * Classification Container - Enhanced Dependency Injection
 *
 * 增强型依赖注入容器，支持：
 * - 服务注册与解析
 * - 单例与瞬态生命周期
 * - 服务覆盖（测试用）
 * - 延迟初始化
 *
 * @version 1.0.0
 * @since 2026-01-24 Phase 4
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { SERVICE_TYPES, type ServiceTypeSymbol } from "./types";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 服务生命周期
 */
export type ServiceLifetime = "singleton" | "transient";

/**
 * 服务工厂函数
 */
export type ServiceFactory<T> = (container: EnhancedContainer) => T;

/**
 * 服务注册项
 */
interface ServiceRegistration<T = unknown> {
  factory: ServiceFactory<T>;
  lifetime: ServiceLifetime;
  instance?: T;
}

/**
 * 容器配置
 */
export interface ContainerConfig {
  /** Supabase 客户端 */
  supabase: SupabaseClient;

  /** 服务覆盖（用于��试） */
  overrides?: Map<ServiceTypeSymbol, unknown>;

  /** 是否启用延迟初始化 */
  lazyInit?: boolean;
}

// ============================================================================
// 增强容器实现
// ============================================================================

/**
 * 增强型依赖注入容器
 */
export class EnhancedContainer {
  private registrations = new Map<ServiceTypeSymbol, ServiceRegistration>();
  private supabase: SupabaseClient;
  private overrides: Map<ServiceTypeSymbol, unknown>;

  constructor(config: ContainerConfig) {
    this.supabase = config.supabase;
    this.overrides = config.overrides ?? new Map();

    // 注册核心服务
    this.registerCoreServices();
  }

  // ============================================================================
  // 公共 API
  // ============================================================================

  /**
   * 获取服务实例
   */
  get<T>(type: ServiceTypeSymbol): T {
    // 1. 检查覆盖
    if (this.overrides.has(type)) {
      return this.overrides.get(type) as T;
    }

    // 2. 检查注册
    const registration = this.registrations.get(type);
    if (!registration) {
      throw new Error(`Service not registered: ${type.toString()}`);
    }

    // 3. 解析服务
    if (registration.lifetime === "singleton") {
      if (!registration.instance) {
        registration.instance = registration.factory(this);
      }
      return registration.instance as T;
    }

    // transient: 每次创建新实例
    return registration.factory(this) as T;
  }

  /**
   * 注册服务
   */
  register<T>(
    type: ServiceTypeSymbol,
    factory: ServiceFactory<T>,
    lifetime: ServiceLifetime = "singleton",
  ): void {
    this.registrations.set(type, { factory, lifetime });
  }

  /**
   * 覆盖服务（测试用）
   */
  override<T>(type: ServiceTypeSymbol, instance: T): void {
    this.overrides.set(type, instance);
  }

  /**
   * 移除覆盖
   */
  removeOverride(type: ServiceTypeSymbol): void {
    this.overrides.delete(type);
  }

  /**
   * 清除所有覆盖
   */
  clearOverrides(): void {
    this.overrides.clear();
  }

  /**
   * 重置容器（清除所有单例实例）
   */
  reset(): void {
    for (const registration of this.registrations.values()) {
      registration.instance = undefined;
    }
    this.overrides.clear();
  }

  /**
   * 获取 Supabase 客户端
   */
  getSupabase(): SupabaseClient {
    return this.supabase;
  }

  /**
   * 检查服务是否已注册
   */
  isRegistered(type: ServiceTypeSymbol): boolean {
    return this.registrations.has(type) || this.overrides.has(type);
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 注册核心服务
   */
  private registerCoreServices(): void {
    // Supabase 客户端
    this.register(
      SERVICE_TYPES.SupabaseClient,
      () => this.supabase,
      "singleton",
    );

    // 其他服务将在具体模块中注册
    // 这里只注册基础设施层服务
  }
}

// ============================================================================
// 全局容器管理
// ============================================================================

let globalContainer: EnhancedContainer | null = null;

/**
 * 初始化全局容器
 */
export function initializeContainer(
  config: ContainerConfig,
): EnhancedContainer {
  globalContainer = new EnhancedContainer(config);
  return globalContainer;
}

/**
 * 获取全局容器
 * @throws Error 如果未初始化
 */
export function getContainer(): EnhancedContainer {
  if (!globalContainer) {
    throw new Error(
      "Container not initialized. Call initializeContainer() first.",
    );
  }
  return globalContainer;
}

/**
 * 检查容器是否已初始化
 */
export function isContainerInitialized(): boolean {
  return globalContainer !== null;
}

/**
 * 重置全局容器（测试用）
 */
export function resetContainer(): void {
  if (globalContainer) {
    globalContainer.reset();
  }
  globalContainer = null;
}

/**
 * 创建测试容器
 *
 * @example
 * ```typescript
 * const container = createTestContainer(mockSupabase, {
 *   [SERVICE_TYPES.LLMService]: mockLLM,
 *   [SERVICE_TYPES.EmbeddingService]: mockEmbedding,
 * });
 * ```
 */
export function createTestContainer(
  supabase: SupabaseClient,
  overrides?: Record<symbol, unknown>,
): EnhancedContainer {
  const overridesMap = new Map<ServiceTypeSymbol, unknown>();

  if (overrides) {
    // 使用 Object.getOwnPropertySymbols 正确处理 Symbol 键
    const symbolKeys = Object.getOwnPropertySymbols(overrides);
    for (const key of symbolKeys) {
      overridesMap.set(key as ServiceTypeSymbol, overrides[key]);
    }
  }

  return new EnhancedContainer({
    supabase,
    overrides: overridesMap,
  });
}
