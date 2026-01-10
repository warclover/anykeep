/**
 * ContextEnhancer - 上下文增强器
 *
 * 职责：
 * - 指代消解（如"这些"、"那个"）
 * - 上下文推断（从已选中的书签、当前文件夹等推断参数）
 * - 槽位补全（从上下文填充缺失的必需参数）
 *
 * @version 1.1.0
 * @since 2026-01-09
 * @updated 2026-01-10 - 支持规则配置化 (Code Review #6)
 */

import { logger } from "@/lib/logger";
import type { IntentSlot } from "./types";
import type { ClassificationContext } from "./hybrid-intent-classifier";
import { getSlotDefinition, validateSlotCompleteness } from "./slot-schemas";
import type { IntentType } from "./types";

/**
 * 指代消解规则
 */
export interface CoreferenceRule {
  pattern: RegExp;
  resolve: (context: ClassificationContext) => unknown;
  description: string;
}

/**
 * 上下文增强器配置 (Code Review #6: 支持规则配置化)
 */
export interface ContextEnhancerConfig {
  /** 自定义指代消解规则（会与默认规则合并） */
  customRules?: CoreferenceRule[];
  /** 是否禁用默认规则 */
  disableDefaultRules?: boolean;
}

/**
 * 默认指代消解规则
 * 可被配置覆盖或扩展
 */
export const DEFAULT_COREFERENCE_RULES: CoreferenceRule[] = [
  {
    pattern: /^(这些|这些书签|这些收藏|这些内容)$/i,
    resolve: (context) => {
      if (context.selectedBookmarks && context.selectedBookmarks.length > 0) {
        return context.selectedBookmarks;
      }
      return null;
    },
    description: "这些 → 已选中的书签",
  },
  {
    pattern: /^(那个|那个书签|那个收藏|那个内容)$/i,
    resolve: (context) => {
      if (context.selectedBookmarks && context.selectedBookmarks.length === 1) {
        return context.selectedBookmarks[0];
      }
      return null;
    },
    description: "那个 → 唯一选中的书签",
  },
  {
    pattern: /^(当前|当前文件夹|这里)$/i,
    resolve: (context) => {
      return context.currentFolder || null;
    },
    description: "当前/这里 → 当前文件夹",
  },
  {
    pattern: /^(最近|最近的|最近添加的)$/i,
    resolve: () => {
      // 返回时间范围标识，由执行层处理
      return { timeRange: "recent", days: 7 };
    },
    description: "最近 → 最近7天",
  },
  {
    pattern: /^(本周|这周|本周的)$/i,
    resolve: () => {
      return { timeRange: "this_week" };
    },
    description: "本周 → 本周时间范围",
  },
  {
    pattern: /^(本月|这个月|本月的)$/i,
    resolve: () => {
      return { timeRange: "this_month" };
    },
    description: "本月 → 本月时间范围",
  },
];

/**
 * 上下文增强结果
 */
export interface ContextEnhancementResult {
  /** 增强后的槽位 */
  slots: Record<string, IntentSlot>;
  /** 增强的槽位数量 */
  enhancedCount: number;
  /** 增强详情 */
  enhancements: Array<{
    slotName: string;
    source: "coreference" | "context" | "inferred";
    value: unknown;
  }>;
}

/**
 * 上下文增强器
 *
 * 支持配置化的指代消解规则 (Code Review #6)
 */
export class ContextEnhancer {
  private coreferenceRules: CoreferenceRule[];

  constructor(config: ContextEnhancerConfig = {}) {
    // 根据配置初始化规则
    if (config.disableDefaultRules) {
      // 仅使用自定义规则
      this.coreferenceRules = config.customRules ?? [];
    } else {
      // 合并默认规则和自定义规则（自定义规则优先级更高，放在前面）
      this.coreferenceRules = [
        ...(config.customRules ?? []),
        ...DEFAULT_COREFERENCE_RULES,
      ];
    }
  }

  /**
   * 增强槽位（指代消解 + 上下文推断）
   *
   * @param slots - 原始槽位
   * @param intentType - 意图类型
   * @param subType - 意图子类型
   * @param context - 分类上下文
   * @returns 增强后的槽位
   */
  enhanceSlots(
    slots: Record<string, IntentSlot> | undefined,
    intentType: IntentType,
    subType: string | undefined,
    context: ClassificationContext,
  ): ContextEnhancementResult {
    const enhancedSlots: Record<string, IntentSlot> = slots ? { ...slots } : {};
    const enhancements: ContextEnhancementResult["enhancements"] = [];

    // 1. 指代消解：处理槽位值中的指代
    for (const [slotName, slot] of Object.entries(enhancedSlots)) {
      if (typeof slot.value === "string") {
        const resolved = this.resolveCoreference(slot.value, context);
        if (resolved !== null && resolved !== slot.value) {
          enhancedSlots[slotName] = {
            ...slot,
            value: resolved,
            source: "inferred",
            confidence: Math.min(0.9, slot.confidence + 0.1), // 提升置信度
          };
          enhancements.push({
            slotName,
            source: "coreference",
            value: resolved,
          });
        }
      }
    }

    // 2. 上下文推断：从上下文填充缺失的必需参数
    const slotDefinition = getSlotDefinition(intentType, subType);
    if (slotDefinition) {
      for (const requiredSlot of slotDefinition.required) {
        if (!enhancedSlots[requiredSlot]) {
          const inferred = this.inferFromContext(requiredSlot, context);
          if (inferred !== null) {
            enhancedSlots[requiredSlot] = {
              name: requiredSlot,
              value: inferred.value,
              type: inferred.type,
              confidence: inferred.confidence,
              required: true,
              source: "context",
            };
            enhancements.push({
              slotName: requiredSlot,
              source: "context",
              value: inferred.value,
            });
          }
        }
      }
    }

    return {
      slots: enhancedSlots,
      enhancedCount: enhancements.length,
      enhancements,
    };
  }

  /**
   * 指代消解
   *
   * @param value - 槽位值（可能是指代）
   * @param context - 分类上下文
   * @returns 消解后的值，如果无法消解则返回原值
   */
  private resolveCoreference(
    value: string,
    context: ClassificationContext,
  ): unknown {
    for (const rule of this.coreferenceRules) {
      if (rule.pattern.test(value.trim())) {
        const resolved = rule.resolve(context);
        if (resolved !== null) {
          if (logger.isLevelEnabled("debug")) {
            logger.debug(
              {
                original: value,
                resolved,
                rule: rule.description,
              },
              "ContextEnhancer: Coreference resolved",
            );
          }
          return resolved;
        }
      }
    }
    return value; // 无法消解，返回原值
  }

  /**
   * 从上下文推断槽位值
   *
   * @param slotName - 槽位名称
   * @param context - 分类上下文
   * @returns 推断的值，如果无法推断则返回 null
   */
  private inferFromContext(
    slotName: string,
    context: ClassificationContext,
  ): {
    value: unknown;
    type: IntentSlot["type"];
    confidence: number;
  } | null {
    // 根据槽位名称推断
    switch (slotName) {
      case "bookmarkIds":
      case "bookmarkIds[]":
        if (context.selectedBookmarks && context.selectedBookmarks.length > 0) {
          return {
            value: context.selectedBookmarks,
            type: "array",
            confidence: 0.9,
          };
        }
        break;

      case "bookmarkId":
        if (
          context.selectedBookmarks &&
          context.selectedBookmarks.length === 1
        ) {
          return {
            value: context.selectedBookmarks[0],
            type: "number",
            confidence: 0.9,
          };
        }
        break;

      case "folderId":
      case "targetFolder":
      case "sourceFolder":
      case "currentFolder":
        if (context.currentFolder) {
          return {
            value: context.currentFolder,
            type: "number",
            confidence: 0.8,
          };
        }
        break;

      case "scope":
        // 如果有选中的书签，推断为 "selected"
        if (context.selectedBookmarks && context.selectedBookmarks.length > 0) {
          return {
            value: "selected",
            type: "string",
            confidence: 0.7,
          };
        }
        // 如果有当前文件夹，推断为 "folder"
        if (context.currentFolder) {
          return {
            value: "folder",
            type: "string",
            confidence: 0.6,
          };
        }
        break;
    }

    return null;
  }

  /**
   * 验证增强后的槽位完整性
   *
   * @param intentType - 意图类型
   * @param subType - 意图子类型
   * @param slots - 增强后的槽位
   * @returns 验证结果
   */
  validateCompleteness(
    intentType: IntentType,
    subType: string | undefined,
    slots: Record<string, IntentSlot>,
  ): {
    complete: boolean;
    missing: string[];
    completeness: number;
  } {
    // 转换为 validateSlotCompleteness 期望的格式
    const slotsForValidation: Record<
      string,
      {
        value: string | number | boolean | Record<string, unknown> | unknown[];
        type: "string" | "number" | "boolean" | "array" | "object";
        confidence: number;
        source: "extracted" | "inferred" | "default" | "context";
      }
    > = {};
    for (const [slotName, slot] of Object.entries(slots)) {
      // 类型断言：确保 value 符合期望的类型
      const value = slot.value as
        | string
        | number
        | boolean
        | Record<string, unknown>
        | unknown[];
      slotsForValidation[slotName] = {
        value,
        type: slot.type,
        confidence: slot.confidence,
        source: slot.source,
      };
    }
    return validateSlotCompleteness(intentType, subType, slotsForValidation);
  }
}

/**
 * 创建上下文增强器实例
 *
 * @param config - 可选配置，支持自定义规则 (Code Review #6)
 */
export function createContextEnhancer(
  config?: ContextEnhancerConfig,
): ContextEnhancer {
  return new ContextEnhancer(config);
}

/**
 * 默认上下文增强器实例（懒加载）
 */
let defaultContextEnhancer: ContextEnhancer | null = null;

export function getContextEnhancer(): ContextEnhancer {
  if (!defaultContextEnhancer) {
    defaultContextEnhancer = createContextEnhancer();
  }
  return defaultContextEnhancer;
}
