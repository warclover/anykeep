/**
 * 根据任务类型获取最佳模型
 *
 * 提供统一的模型选择接口，根据任务复杂度自动选择合适的模型层级。
 *
 * @module ai-providers/get-model-by-task
 * @version 1.0.0
 * @since 2026-01-07
 */

import { MODEL_TIER_CONFIG, type ModelTierId } from "./model-tier-config";
import { aiProviderRouter } from "./provider-router";
import type { LanguageModel } from "ai";
import { logger } from "@/lib/logger";

// =============================================================================
// 任务类型定义
// =============================================================================

/**
 * AI 任务类型
 *
 * 分为三类：
 * - 内容生成类：使用 standard 层（deepseek-chat）
 * - 分析推理类：使用 deep 层（deepseek-reasoner）
 * - 快速响应类：使用 fast 层（deepseek-chat，低 token）
 */
export type AITaskType =
  // 内容生成类 → standard
  | "content-generation" // 内容生成
  | "outline-generation" // 大纲生成
  | "content-condense" // 内容精简
  | "style-adapt" // 风格适配
  | "summary" // 摘要生成
  | "tagging" // 标签生成
  | "export" // 数据导出
  | "tool-calling" // 工具调用

  // 分析推理类 → deep
  | "insight-analysis" // 洞察分析
  | "batch-organize" // 批量整理
  | "duplicate-detect" // 重复检测
  | "theme-discovery" // 主题发现
  | "knowledge-extract" // 知识提取
  | "review-planning" // 复习规划
  | "slow-thinking" // 慢思考

  // 快速响应类 → fast
  | "intent-classify" // 意图分类
  | "simple-query" // 简单查询
  | "chitchat"; // 闲聊

// =============================================================================
// 任务 → 层级映射
// =============================================================================

/**
 * 任务类型到模型层级的映射
 */
const TASK_TIER_MAP: Record<AITaskType, ModelTierId> = {
  // 内容生成类 → standard (deepseek-chat)
  "content-generation": "standard",
  "outline-generation": "standard",
  "content-condense": "standard",
  "style-adapt": "standard",
  summary: "standard",
  tagging: "standard",
  export: "standard",
  "tool-calling": "standard",

  // 分析推理类 → deep (deepseek-reasoner)
  "insight-analysis": "deep",
  "batch-organize": "deep",
  "duplicate-detect": "deep",
  "theme-discovery": "deep",
  "knowledge-extract": "deep",
  "review-planning": "deep",
  "slow-thinking": "deep",

  // 快速响应类 → fast (deepseek-chat, 低 token)
  "intent-classify": "fast",
  "simple-query": "fast",
  chitchat: "fast",
};

// =============================================================================
// 主函数
// =============================================================================

/**
 * 根据任务类型获取最佳模型
 *
 * @param taskType - 任务类型
 * @returns LanguageModel 实例，或 null（获取失败）
 *
 * @example
 * ```typescript
 * // 内容生成任务 → deepseek-chat
 * const model = getModelByTask("content-generation");
 *
 * // 洞察分析任务 → deepseek-reasoner
 * const model = getModelByTask("insight-analysis");
 * ```
 */
export function getModelByTask(taskType: AITaskType): LanguageModel | null {
  const tier = TASK_TIER_MAP[taskType];
  const tierConfig = MODEL_TIER_CONFIG[tier];

  const model = aiProviderRouter.getModel(
    tierConfig.provider.name,
    tierConfig.provider.model,
  );

  if (model) {
    logger.debug(
      {
        taskType,
        tier,
        provider: tierConfig.provider.name,
        model: tierConfig.provider.model,
      },
      `Model selected for task: ${taskType}`,
    );
  } else {
    logger.error(
      {
        taskType,
        tier,
        provider: tierConfig.provider.name,
        model: tierConfig.provider.model,
      },
      `Failed to get model for task: ${taskType}`,
    );
  }

  return model;
}

/**
 * 获取任务对应的层级配置
 *
 * @param taskType - 任务类型
 * @returns 层级配置
 */
export function getTierConfigByTask(taskType: AITaskType) {
  const tier = TASK_TIER_MAP[taskType];
  return MODEL_TIER_CONFIG[tier];
}

/**
 * 获取任务对应的层级 ID
 *
 * @param taskType - 任务类型
 * @returns 层级 ID
 */
export function getTierByTask(taskType: AITaskType): ModelTierId {
  return TASK_TIER_MAP[taskType];
}

/**
 * 检查任务是否需要深度推理模型
 *
 * @param taskType - 任务类型
 * @returns 是否需要深度推理
 */
export function requiresDeepReasoning(taskType: AITaskType): boolean {
  return TASK_TIER_MAP[taskType] === "deep";
}
