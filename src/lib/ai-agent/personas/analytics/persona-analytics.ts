/**
 * Persona Analytics Service
 *
 * 提供画像功能的埋点和统计服务
 *
 * @module ai-agent/personas/analytics/persona-analytics
 * @version 1.0.0
 * @since 2025-12-28
 */

import { eventBus } from "@/lib/shared/event-bus";
import { logger } from "@/lib/logger";
import type { PersonaType, PersonaGroup } from "../types";
import type {
  PersonaInferredEvent,
  PersonaSettingsChangedEvent,
  PersonaIntentRoutedEvent,
  PersonaErrorEvent,
  PersonaRolloutCheckEvent,
} from "./types";

// =============================================================================
// 事件名称常量
// =============================================================================

export const PersonaEvents = {
  INFERRED: "persona:inferred",
  SETTINGS_CHANGED: "persona:settings_changed",
  INTENT_ROUTED: "persona:intent_routed",
  ERROR: "persona:error",
  ROLLOUT_CHECK: "persona:rollout_check",
} as const;

// =============================================================================
// 埋点函数
// =============================================================================

/**
 * 追踪画像推断事件
 */
export function trackPersonaInferred(params: {
  userId: string;
  personaType: PersonaType;
  personaGroup: PersonaGroup;
  confidence: number;
  alternativesCount: number;
  bookmarkCount: number;
  inferenceTimeMs: number;
}): void {
  const event: PersonaInferredEvent = {
    ...params,
    timestamp: new Date().toISOString(),
  };

  try {
    // 发送事件到事件总线
    eventBus.emit(PersonaEvents.INFERRED, event);

    // 记录日志
    logger.info(
      {
        event: PersonaEvents.INFERRED,
        personaType: params.personaType,
        confidence: params.confidence,
        bookmarkCount: params.bookmarkCount,
      },
      "[PersonaAnalytics] Persona inferred",
    );
  } catch (error) {
    logger.error(
      { error, params },
      "[PersonaAnalytics] Failed to track persona inferred event",
    );
  }
}

/**
 * 追踪画像设置变更事件
 */
export function trackPersonaSettingsChanged(params: {
  userId: string;
  changeType: "set_manual" | "reset_to_inferred" | "update_preferences";
  previousType: PersonaType | null;
  newType: PersonaType | null;
  previousSource: "inferred" | "manual" | null;
  newSource: "inferred" | "manual";
}): void {
  const event: PersonaSettingsChangedEvent = {
    ...params,
    timestamp: new Date().toISOString(),
  };

  try {
    eventBus.emit(PersonaEvents.SETTINGS_CHANGED, event);

    logger.info(
      {
        event: PersonaEvents.SETTINGS_CHANGED,
        changeType: params.changeType,
        previousType: params.previousType,
        newType: params.newType,
      },
      "[PersonaAnalytics] Persona settings changed",
    );
  } catch (error) {
    logger.error(
      { error, params },
      "[PersonaAnalytics] Failed to track settings changed event",
    );
  }
}

/**
 * 追踪画像意图路由事件
 */
export function trackPersonaIntentRouted(params: {
  userId: string;
  personaType: PersonaType;
  intentType: string;
  intentSubType?: string;
  boostApplied: boolean;
  originalConfidence: number;
  boostedConfidence: number;
}): void {
  const event: PersonaIntentRoutedEvent = {
    ...params,
    timestamp: new Date().toISOString(),
  };

  try {
    eventBus.emit(PersonaEvents.INTENT_ROUTED, event);

    // 只有应用了加成时才记录详细日志
    if (params.boostApplied) {
      logger.debug(
        {
          event: PersonaEvents.INTENT_ROUTED,
          personaType: params.personaType,
          intentType: params.intentType,
          boostDelta: params.boostedConfidence - params.originalConfidence,
        },
        "[PersonaAnalytics] Intent routed with persona boost",
      );
    }
  } catch (error) {
    logger.error(
      { error, params },
      "[PersonaAnalytics] Failed to track intent routed event",
    );
  }
}

/**
 * 追踪画像功能错误事件
 */
export function trackPersonaError(params: {
  userId: string;
  errorType:
    | "inference_failed"
    | "settings_save_failed"
    | "prompt_inject_failed";
  errorMessage: string;
  context?: Record<string, unknown>;
}): void {
  const event: PersonaErrorEvent = {
    ...params,
    timestamp: new Date().toISOString(),
  };

  try {
    eventBus.emit(PersonaEvents.ERROR, event);

    logger.error(
      {
        event: PersonaEvents.ERROR,
        errorType: params.errorType,
        errorMessage: params.errorMessage,
      },
      "[PersonaAnalytics] Persona error occurred",
    );
  } catch (error) {
    logger.error(
      { error, params },
      "[PersonaAnalytics] Failed to track error event",
    );
  }
}

/**
 * 追踪灰度发布检查事件
 */
export function trackPersonaRolloutCheck(params: {
  userId: string;
  inRollout: boolean;
  rolloutPercentage: number;
  userHash: number;
}): void {
  const event: PersonaRolloutCheckEvent = {
    ...params,
    timestamp: new Date().toISOString(),
  };

  try {
    eventBus.emit(PersonaEvents.ROLLOUT_CHECK, event);

    // 只在 debug 级别记录灰度检查
    logger.debug(
      {
        event: PersonaEvents.ROLLOUT_CHECK,
        inRollout: params.inRollout,
        rolloutPercentage: params.rolloutPercentage,
      },
      "[PersonaAnalytics] Rollout check performed",
    );
  } catch (error) {
    logger.error(
      { error, params },
      "[PersonaAnalytics] Failed to track rollout check event",
    );
  }
}

// =============================================================================
// 统计查询函数
// =============================================================================

/**
 * 获取画像推断性能指标
 *
 * @description 用于监控画像推断的成功率和延迟
 */
export function createInferenceMetrics() {
  let totalCount = 0;
  let successCount = 0;
  let totalLatencyMs = 0;
  let totalConfidence = 0;

  return {
    /**
     * 记录一次推断
     */
    record(success: boolean, latencyMs: number, confidence: number): void {
      totalCount++;
      if (success) {
        successCount++;
        totalConfidence += confidence;
      }
      totalLatencyMs += latencyMs;
    },

    /**
     * 获取统计数据
     */
    getStats(): {
      totalCount: number;
      successRate: number;
      avgLatencyMs: number;
      avgConfidence: number;
    } {
      return {
        totalCount,
        successRate: totalCount > 0 ? (successCount / totalCount) * 100 : 0,
        avgLatencyMs: totalCount > 0 ? totalLatencyMs / totalCount : 0,
        avgConfidence: successCount > 0 ? totalConfidence / successCount : 0,
      };
    },

    /**
     * 重置统计
     */
    reset(): void {
      totalCount = 0;
      successCount = 0;
      totalLatencyMs = 0;
      totalConfidence = 0;
    },
  };
}

// 全局推断指标实例
export const inferenceMetrics = createInferenceMetrics();

// =============================================================================
// 辅助工具
// =============================================================================

/**
 * 计算用户 ID 的哈希值（与 persona-rollout.ts 保持一致）
 *
 * @internal 仅用于埋点记录
 */
export function hashUserIdForAnalytics(userId: string): number {
  let hash = 5381;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) + hash) ^ char;
  }
  return Math.abs(hash) % 100;
}
