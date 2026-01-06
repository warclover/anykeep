/**
 * AI Skills 容器测试辅助工具
 *
 * 提供测试场景下的容器设置和 Mock 注入能力
 *
 * @example
 * ```typescript
 * describe('MySkillTest', () => {
 *   let cleanup: () => void;
 *
 *   beforeEach(() => {
 *     const { cleanup: c } = setupTestContainer({
 *       skillRegistry: mockSkillRegistry,
 *     });
 *     cleanup = c;
 *   });
 *
 *   afterEach(() => {
 *     cleanup();
 *   });
 *
 *   it('should work with mocked registry', () => {
 *     const container = getAISkillsContainer();
 *     expect(container.getSkillRegistry()).toBe(mockSkillRegistry);
 *   });
 * });
 * ```
 *
 * @version 1.0.0
 * @since 2026-01-06
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AISkillsContainer,
  type AISkillsContainerConfig,
  type AISkillsContainerOverrides,
} from "../../container";
import type { SkillRegistry } from "../../core/skill-registry";
import type { OrchestrationEngine } from "../../engine/orchestration-engine";
import type { IntentRouter } from "../../router/intent-router";

// ============================================
// 类型定义
// ============================================

/**
 * 测试容器设置选项
 */
export interface TestContainerSetupOptions {
  /** Supabase 客户端 Mock */
  supabase?: Partial<SupabaseClient>;
  /** 容器配置 */
  config?: AISkillsContainerConfig;
  /** 服务覆盖 */
  overrides?: AISkillsContainerOverrides;
}

/**
 * 测试容器设置结果
 */
export interface TestContainerSetupResult {
  /** 容器实例 */
  container: AISkillsContainer;
  /** 清理函数，在测试后调用 */
  cleanup: () => void;
}

// ============================================
// Mock 创建函数
// ============================================

/**
 * 创建 Supabase 客户端 Mock
 *
 * 返回一个最小可用的 Supabase Mock
 */
export function createMockSupabase(): SupabaseClient {
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user: null }, error: null }),
      getSession: jest
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
    },
  } as unknown as SupabaseClient;
}

/**
 * 创建 SkillRegistry Mock
 */
export function createMockSkillRegistry(): jest.Mocked<SkillRegistry> {
  return {
    register: jest.fn(),
    unregister: jest.fn().mockReturnValue(true),
    get: jest.fn().mockReturnValue(undefined),
    has: jest.fn().mockReturnValue(false),
    getRegistration: jest.fn().mockReturnValue(undefined),
    enable: jest.fn().mockReturnValue(true),
    disable: jest.fn().mockReturnValue(true),
    getAll: jest.fn().mockReturnValue([]),
    getByCategory: jest.fn().mockReturnValue([]),
    getByCapability: jest.fn().mockReturnValue([]),
    search: jest.fn().mockReturnValue([]),
    exportAsTools: jest.fn().mockReturnValue({}),
    getStats: jest.fn().mockReturnValue({
      total: 0,
      enabled: 0,
      disabled: 0,
      byCategory: {},
    }),
    clear: jest.fn(),
    listMetadata: jest.fn().mockReturnValue([]),
  } as unknown as jest.Mocked<SkillRegistry>;
}

/**
 * 创建 OrchestrationEngine Mock
 */
export function createMockOrchestrationEngine(): jest.Mocked<OrchestrationEngine> {
  return {
    register: jest.fn(),
    unregister: jest.fn().mockReturnValue(true),
    get: jest.fn().mockReturnValue(undefined),
    has: jest.fn().mockReturnValue(false),
    getAll: jest.fn().mockReturnValue([]),
    execute: jest.fn(),
    getStats: jest.fn().mockReturnValue({
      totalSkills: 0,
      registeredSkills: [],
    }),
  } as unknown as jest.Mocked<OrchestrationEngine>;
}

/**
 * 创建 IntentRouter Mock
 */
export function createMockIntentRouter(): jest.Mocked<IntentRouter> {
  const mockRouteResult = {
    intent: {
      type: "query" as const,
      confidence: 0.9,
      entities: [],
      requiresMultiStep: false,
      hasDeliverableExpectation: false,
      source: "rule" as const,
    },
    complexity: {
      level: "simple" as const,
      score: 20,
      factors: [],
      estimatedSteps: 1,
      estimatedDurationMs: 1000,
    },
    mode: "atomic" as const,
    suggestedSkill: null,
    reason: "Simple query",
    routingDurationMs: 10,
  };

  return {
    route: jest.fn().mockResolvedValue(mockRouteResult),
    routeQuick: jest.fn().mockResolvedValue({ mode: "atomic", skill: null }),
    getClassifier: jest.fn(),
    getEvaluator: jest.fn(),
    getSelector: jest.fn(),
    getMetricsAggregation: jest.fn().mockReturnValue(null),
    getRecentMetrics: jest.fn().mockReturnValue([]),
    clearMetrics: jest.fn(),
    updateConfig: jest.fn(),
  } as unknown as jest.Mocked<IntentRouter>;
}

// ============================================
// 测试容器设置
// ============================================

/**
 * 设置测试容器
 *
 * 创建一个用于测试的 AISkillsContainer，支持 Mock 注入
 *
 * @param options - 设置选项
 * @returns 容器实例和清理函数
 */
export function setupTestContainer(
  options: TestContainerSetupOptions = {},
): TestContainerSetupResult {
  // 确保先重置任何现有实例
  AISkillsContainer.reset();

  // 创建 Supabase Mock
  const supabase = (options.supabase ?? createMockSupabase()) as SupabaseClient;

  // 初始化容器
  const container = AISkillsContainer.initialize(supabase, options.config);

  // 应用覆盖
  if (options.overrides) {
    container.setOverrides(options.overrides);
  }

  // 返回容器和清理函数
  return {
    container,
    cleanup: () => {
      container.clearOverrides();
      AISkillsContainer.reset();
    },
  };
}

/**
 * 设置带完整 Mock 的测试容器
 *
 * 所有服务都使用 Mock 实现
 */
export function setupFullyMockedContainer(): TestContainerSetupResult & {
  mocks: {
    skillRegistry: jest.Mocked<SkillRegistry>;
    orchestrationEngine: jest.Mocked<OrchestrationEngine>;
    intentRouter: jest.Mocked<IntentRouter>;
  };
} {
  const mocks = {
    skillRegistry: createMockSkillRegistry(),
    orchestrationEngine: createMockOrchestrationEngine(),
    intentRouter: createMockIntentRouter(),
  };

  const result = setupTestContainer({
    overrides: mocks,
  });

  return {
    ...result,
    mocks,
  };
}

// ============================================
// Jest 集成辅助
// ============================================

/**
 * 创建 beforeEach/afterEach 钩子
 *
 * @example
 * ```typescript
 * describe('MyTest', () => {
 *   const { beforeEachHook, afterEachHook, getContainer } = createTestHooks();
 *
 *   beforeEach(beforeEachHook);
 *   afterEach(afterEachHook);
 *
 *   it('test', () => {
 *     const container = getContainer();
 *     // ...
 *   });
 * });
 * ```
 */
export function createTestHooks(options?: TestContainerSetupOptions): {
  beforeEachHook: () => void;
  afterEachHook: () => void;
  getContainer: () => AISkillsContainer;
} {
  let container: AISkillsContainer | null = null;
  let cleanup: (() => void) | null = null;

  return {
    beforeEachHook: () => {
      const result = setupTestContainer(options);
      container = result.container;
      cleanup = result.cleanup;
    },
    afterEachHook: () => {
      cleanup?.();
      container = null;
      cleanup = null;
    },
    getContainer: () => {
      if (!container) {
        throw new Error(
          "Container not initialized. Call beforeEachHook first.",
        );
      }
      return container;
    },
  };
}
