/**
 * 胶囊注册表 - 极简版
 *
 * 提供基于意图类型的工具胶囊查询功能
 * 无 LLM 分析，纯静态映射
 *
 * @version 1.0.0
 * @since 2026-01-12
 */

import { logger } from "@/lib/logger";
import type { IntentType } from "@/lib/shared/types";
import {
  STATIC_CAPSULES,
  type StaticCapsule,
  getCapsulesForIntent,
  getCapsuleById,
} from "./static-capsules";

/**
 * 胶囊注册表
 *
 * 单例模式，提供胶囊查询和工具加载功能
 */
class StaticCapsuleRegistry {
  private static instance: StaticCapsuleRegistry;

  /** 按胶囊 ID 索引 */
  private capsuleMap: Map<string, StaticCapsule>;

  /** 按意图类型索引 */
  private intentMap: Map<IntentType, StaticCapsule[]>;

  private constructor() {
    this.capsuleMap = new Map();
    this.intentMap = new Map();
    this.initialize();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): StaticCapsuleRegistry {
    if (!StaticCapsuleRegistry.instance) {
      StaticCapsuleRegistry.instance = new StaticCapsuleRegistry();
    }
    return StaticCapsuleRegistry.instance;
  }

  /**
   * 初始化索引
   */
  private initialize(): void {
    for (const capsule of STATIC_CAPSULES) {
      // 构建 ID 索引
      this.capsuleMap.set(capsule.id, capsule);

      // 构建意图类型索引
      for (const intent of capsule.intentTypes) {
        const existing = this.intentMap.get(intent) || [];
        existing.push(capsule);
        this.intentMap.set(intent, existing);
      }
    }

    // 按优先级排序
    for (const [intent, capsules] of this.intentMap.entries()) {
      capsules.sort((a, b) => a.priority - b.priority);
      this.intentMap.set(intent, capsules);
    }

    logger.info(
      {
        capsuleCount: STATIC_CAPSULES.length,
        intentCount: this.intentMap.size,
      },
      "CapsuleRegistry: Initialized",
    );
  }

  /**
   * 根据意图获取胶囊列表
   *
   * @param intent - 意图类型
   * @returns 适用的胶囊列表（按优先级排序）
   */
  getCapsulesForIntent(intent: IntentType): StaticCapsule[] {
    return this.intentMap.get(intent) || [];
  }

  /**
   * 根据意图获取工具 ID 列表
   *
   * @param intent - 意图类型
   * @returns 去重后的工具 ID 列表
   */
  getToolIdsForIntent(intent: IntentType): string[] {
    const capsules = this.getCapsulesForIntent(intent);
    const toolIds = new Set<string>();

    for (const capsule of capsules) {
      for (const toolId of capsule.toolIds) {
        toolIds.add(toolId);
      }
    }

    const result = Array.from(toolIds);

    logger.debug(
      {
        intent,
        capsuleCount: capsules.length,
        toolCount: result.length,
      },
      "CapsuleRegistry: Tools loaded for intent",
    );

    return result;
  }

  /**
   * 根据 ID 获取胶囊
   *
   * @param id - 胶囊 ID
   * @returns 胶囊定义，未找到返回 undefined
   */
  getCapsuleById(id: string): StaticCapsule | undefined {
    return this.capsuleMap.get(id);
  }

  /**
   * 获取所有胶囊
   *
   * @returns 所有胶囊列表
   */
  getAllCapsules(): StaticCapsule[] {
    return STATIC_CAPSULES;
  }

  /**
   * 获取所有意图类型
   *
   * @returns 所有已注册的意图类型
   */
  getAllIntentTypes(): IntentType[] {
    return Array.from(this.intentMap.keys());
  }

  /**
   * 获取注册表统计信息
   */
  getStats(): {
    capsuleCount: number;
    intentCount: number;
    toolCount: number;
  } {
    const allToolIds = new Set<string>();
    for (const capsule of STATIC_CAPSULES) {
      for (const toolId of capsule.toolIds) {
        allToolIds.add(toolId);
      }
    }

    return {
      capsuleCount: STATIC_CAPSULES.length,
      intentCount: this.intentMap.size,
      toolCount: allToolIds.size,
    };
  }
}

// 导出单例实例
export const capsuleRegistry = StaticCapsuleRegistry.getInstance();

// 导出类型和工具函数
export type { StaticCapsule };
export { getCapsulesForIntent, getCapsuleById };
