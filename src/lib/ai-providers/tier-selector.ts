/**
 * 模型层级选择器
 *
 * 根据上下文智能选择最适合的模型层级
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { logger } from "@/lib/logger";
import type {
  IntentClassification,
  ComplexityEvaluation,
} from "@/lib/ai-skills/router/types";
import {
  type ModelTierId,
  type TierConfig,
  type TierProviderConfig,
  MODEL_TIER_CONFIG,
  DEFAULT_TIER_ID,
} from "./model-tier-config";
import {
  getTierByIntent,
  getTierByComplexity,
  getTierBySkill,
  isSimpleIntent,
} from "./task-tier-mapping";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 层级选择上下文
 */
export interface TierSelectionContext {
  /** 意图分类结果 */
  intent: IntentClassification;
  /** 复杂度评估结果 */
  complexity: ComplexityEvaluation;
  /** 是否有预加载的动态上下文 */
  hasPreloadedContext?: boolean;
  /** 编排 Skill ID（如果是编排模式） */
  skillId?: string;
  /** 用户偏好的层级（可选） */
  preferredTier?: ModelTierId;
  /** 是否强制使用最低层级（节省成本模式） */
  costSavingMode?: boolean;
}

/**
 * 层级选择结果
 */
export interface TierSelection {
  /** 选择的层级 ID */
  tierId: ModelTierId;
  /** 选择理由 */
  reason: TierSelectionReason;
  /** 选择理由描述 */
  reasonDescription: string;
  /** 模型配置 */
  modelConfig: TierProviderConfig;
  /** 层级完整配置 */
  tierConfig: TierConfig;
  /** 是否降级（从更高层级降到当前层级） */
  downgraded?: boolean;
  /** 原始推荐层级（如果降级） */
  originalTier?: ModelTierId;
}

/**
 * 选择理由类型
 */
export type TierSelectionReason =
  | "preloaded_context" // 有预加载上下文，使用快速层
  | "intent_mapping" // 意图映射
  | "skill_mapping" // Skill 映射
  | "complexity_fallback" // 复杂度兜底
  | "user_preference" // 用户偏好
  | "cost_saving" // 成本节省模式
  | "default"; // 默认

// =============================================================================
// 层级选择器类
// =============================================================================

/**
 * 模型层级选择器
 *
 * 实现智能层级选择逻辑，支持多种选择策略
 */
export class ModelTierSelector {
  /**
   * 根据上下文选择最适合的模型层级
   *
   * 选择优先级：
   * 1. 用户偏好（如果指定）
   * 2. 成本节省模式（如果启用）
   * 3. 预加载上下文 + 简单问题 → 快速层
   * 4. Skill 映射（编排模式）
   * 5. 意图映射
   * 6. 复杂度兜底
   * 7. 默认层级
   */
  selectTier(context: TierSelectionContext): TierSelection {
    const {
      intent,
      complexity,
      hasPreloadedContext,
      skillId,
      preferredTier,
      costSavingMode,
    } = context;

    // 1. 用户偏好优先
    if (preferredTier) {
      return this.createSelection(
        preferredTier,
        "user_preference",
        "用户指定层级",
      );
    }

    // 2. 成本节省模式 → 强制使用快速层
    if (costSavingMode) {
      return this.createSelection(
        "fast",
        "cost_saving",
        "成本节省模式，使用快速层",
      );
    }

    // 3. 如果有预加载上下文且是简单问题，使用快速层
    if (hasPreloadedContext && isSimpleIntent(intent.type, intent.subType)) {
      return this.createSelection(
        "fast",
        "preloaded_context",
        "预加载上下文 + 简单问题，使用快速层",
      );
    }

    // 4. Skill 映射（编排模式）
    if (skillId) {
      const skillTier = getTierBySkill(skillId);
      if (skillTier) {
        return this.createSelection(
          skillTier,
          "skill_mapping",
          `编排 Skill ${skillId} 映射到 ${skillTier} 层`,
        );
      }
    }

    // 5. 意图映射
    const intentTier = getTierByIntent(intent.type, intent.subType);
    if (intentTier) {
      return this.createSelection(
        intentTier,
        "intent_mapping",
        `意图 ${intent.type}:${intent.subType ?? "*"} 映射到 ${intentTier} 层`,
      );
    }

    // 6. 复杂度兜底
    const complexityTier = getTierByComplexity(complexity.level);
    return this.createSelection(
      complexityTier,
      "complexity_fallback",
      `复杂度 ${complexity.level} 映射到 ${complexityTier} 层`,
    );
  }

  /**
   * 获取层级对应的模型配置
   */
  getModelConfig(tierId: ModelTierId): TierProviderConfig {
    return MODEL_TIER_CONFIG[tierId].provider;
  }

  /**
   * 获取层级完整配置
   */
  getTierConfig(tierId: ModelTierId): TierConfig {
    return MODEL_TIER_CONFIG[tierId];
  }

  /**
   * 降级到更低层级（当高层级不可用时）
   */
  downgrade(currentTier: ModelTierId): TierSelection | null {
    const tiers: ModelTierId[] = ["deep", "standard", "fast"];
    const currentIndex = tiers.indexOf(currentTier);

    if (currentIndex === -1 || currentIndex >= tiers.length - 1) {
      // 已经是最低层级，无法降级
      return null;
    }

    const nextTier = tiers[currentIndex + 1];

    logger.warn(
      { from: currentTier, to: nextTier },
      `ModelTierSelector: 降级从 ${currentTier} 到 ${nextTier}`,
    );

    const selection = this.createSelection(
      nextTier,
      "default",
      `从 ${currentTier} 降级到 ${nextTier}`,
    );

    return {
      ...selection,
      downgraded: true,
      originalTier: currentTier,
    };
  }

  /**
   * 升级到更高层级（当任务复杂度增加时）
   */
  upgrade(currentTier: ModelTierId): TierSelection | null {
    const tiers: ModelTierId[] = ["fast", "standard", "deep"];
    const currentIndex = tiers.indexOf(currentTier);

    if (currentIndex === -1 || currentIndex >= tiers.length - 1) {
      // 已经是最高层级，无法升级
      return null;
    }

    const nextTier = tiers[currentIndex + 1];

    logger.info(
      { from: currentTier, to: nextTier },
      `ModelTierSelector: 升级从 ${currentTier} 到 ${nextTier}`,
    );

    return this.createSelection(
      nextTier,
      "default",
      `从 ${currentTier} 升级到 ${nextTier}`,
    );
  }

  /**
   * 创建选择结果
   */
  private createSelection(
    tierId: ModelTierId,
    reason: TierSelectionReason,
    reasonDescription: string,
  ): TierSelection {
    const tierConfig = MODEL_TIER_CONFIG[tierId];
    const modelConfig = tierConfig.provider;

    logger.debug(
      {
        tierId,
        reason,
        model: modelConfig.model,
        temperature: modelConfig.temperature,
      },
      `ModelTierSelector: ${reasonDescription}`,
    );

    return {
      tierId,
      reason,
      reasonDescription,
      modelConfig,
      tierConfig,
    };
  }

  /**
   * 判断是否为简单查询（可以使用快速层直接回答）
   */
  isSimpleQuery(intent: IntentClassification): boolean {
    return isSimpleIntent(intent.type, intent.subType);
  }

  /**
   * 获取推荐层级（不考虑上下文优化）
   */
  getRecommendedTier(
    intent: IntentClassification,
    complexity: ComplexityEvaluation,
  ): ModelTierId {
    // 先尝试意图映射
    const intentTier = getTierByIntent(intent.type, intent.subType);
    if (intentTier) {
      return intentTier;
    }

    // 再尝试复杂度映射
    return getTierByComplexity(complexity.level);
  }

  /**
   * 估算层级成本
   *
   * @param tierId - 层级 ID
   * @param estimatedTokens - 预估 Token 数
   * @returns 相对成本值
   */
  estimateCost(tierId: ModelTierId, estimatedTokens: number): number {
    const tierConfig = MODEL_TIER_CONFIG[tierId];
    return tierConfig.costFactor * (estimatedTokens / 1000);
  }

  /**
   * 获取默认层级
   */
  getDefaultTier(): ModelTierId {
    return DEFAULT_TIER_ID;
  }
}

// =============================================================================
// 单例导出
// =============================================================================

/**
 * 全局层级选择器实例
 */
export const tierSelector = new ModelTierSelector();

/**
 * 便捷函数：选择层级
 */
export function selectTier(context: TierSelectionContext): TierSelection {
  return tierSelector.selectTier(context);
}

/**
 * 便捷函数：获取模型配置
 */
export function getModelConfigForTier(tierId: ModelTierId): TierProviderConfig {
  return tierSelector.getModelConfig(tierId);
}
