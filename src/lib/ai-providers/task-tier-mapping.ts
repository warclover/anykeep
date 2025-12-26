/**
 * 任务-层级映射
 *
 * 定义意图类型和复杂度到模型层级的映射规则
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import type { ModelTierId } from "./model-tier-config";
import type { IntentType, ComplexityLevel } from "@/lib/ai-skills/router/types";

// =============================================================================
// 意图-层级映射
// =============================================================================

/**
 * 意图类型 → 模型层级 映射
 *
 * 格式：
 * - "type:subType" → tier（精确匹配）
 * - "type" → tier（类型匹配）
 *
 * 匹配优先级：精确匹配 > 类型匹配 > 复杂度兜底
 */
export const INTENT_TIER_MAPPING: Record<string, ModelTierId> = {
  // ========================================
  // 快速层：简单问答、闲聊
  // ========================================

  // 查询类 - 简单
  "query:count": "fast", // 数量查询
  "query:list": "fast", // 简单列表

  // 闲聊类
  chitchat: "fast", // 闲聊
  "chitchat:greeting": "fast", // 问候
  "chitchat:help": "fast", // 帮助
  "chitchat:goodbye": "fast", // 告别
  "chitchat:other": "fast", // 其他

  // ========================================
  // 标准层：常规操作、搜索、摘要
  // ========================================

  // 查询类 - 搜索
  "query:search": "standard", // 搜索查询
  "query:detail": "standard", // 详情查询
  query: "standard", // 查询类兜底

  // 操作类
  "action:tag": "standard", // 标签操作
  "action:move": "standard", // 移动操作
  "action:delete": "standard", // 删除操作
  "action:batch": "standard", // 批量操作
  "action:archive": "standard", // 归档操作
  action: "standard", // 操作类兜底

  // 创建类 - 简单
  "create:summary": "standard", // 创建摘要
  "create:export": "standard", // 导出操作
  "create:note": "standard", // 创建笔记
  create: "standard", // 创建类兜底

  // ========================================
  // 深度层：复杂分析、学习、整理
  // ========================================

  // 分析类
  "analyze:insight": "deep", // 洞察分析
  "analyze:report": "deep", // 报告生成
  "analyze:stats": "standard", // 统计分析（相对简单）
  "analyze:trend": "deep", // 趋势分析
  analyze: "deep", // 分析类兜底

  // 学习类
  "learn:review": "deep", // 知识复习
  "learn:path": "deep", // 学习路径
  "learn:interview": "deep", // 面试准备
  "learn:flashcard": "deep", // 记忆卡片
  learn: "deep", // 学习类兜底

  // 整理类
  "organize:cleanup": "deep", // 清理整理
  "organize:classify": "deep", // 分类整理
  "organize:dedupe": "deep", // 去重整理
  "organize:batch_organize": "deep", // 批量整理
  organize: "deep", // 整理类兜底

  // 创建类 - 复杂
  "create:document": "deep", // 文档生成
};

// =============================================================================
// 复杂度-层级映射
// =============================================================================

/**
 * 复杂度 → 层级 映射（兜底规则）
 *
 * 当意图映射未命中时，根据复杂度级别选择层级
 */
export const COMPLEXITY_TIER_MAPPING: Record<ComplexityLevel, ModelTierId> = {
  simple: "fast",
  medium: "standard",
  complex: "deep",
};

// =============================================================================
// Skill-层级映射
// =============================================================================

/**
 * 编排 Skill ID → 层级 映射
 *
 * 编排模式的 Skill 通常需要更高层级的模型
 */
export const SKILL_TIER_MAPPING: Record<string, ModelTierId> = {
  knowledge_review: "deep", // 知识回顾
  data_export: "standard", // 数据导出
  insight_report: "deep", // 洞察报告
  batch_organize: "deep", // 批量整理
};

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 根据意图获取层级
 *
 * @param intentType - 意图类型
 * @param subType - 子类型（可选）
 * @returns 层级 ID 或 null（未匹配）
 */
export function getTierByIntent(
  intentType: IntentType,
  subType?: string,
): ModelTierId | null {
  // 1. 尝试精确匹配（type:subType）
  if (subType) {
    const exactKey = `${intentType}:${subType}`;
    if (exactKey in INTENT_TIER_MAPPING) {
      return INTENT_TIER_MAPPING[exactKey];
    }
  }

  // 2. 尝试类型匹配（type）
  if (intentType in INTENT_TIER_MAPPING) {
    return INTENT_TIER_MAPPING[intentType];
  }

  // 3. 未匹配
  return null;
}

/**
 * 根据复杂度获取层级
 *
 * @param complexity - 复杂度级别
 * @returns 层级 ID
 */
export function getTierByComplexity(complexity: ComplexityLevel): ModelTierId {
  return COMPLEXITY_TIER_MAPPING[complexity];
}

/**
 * 根据 Skill ID 获取层级
 *
 * @param skillId - Skill ID
 * @returns 层级 ID 或 null（未匹配）
 */
export function getTierBySkill(skillId: string): ModelTierId | null {
  return SKILL_TIER_MAPPING[skillId] ?? null;
}

/**
 * 获取意图键（用于映射查找）
 *
 * @param intentType - 意图类型
 * @param subType - 子类型（可选）
 * @returns 意图键
 */
export function getIntentKey(intentType: IntentType, subType?: string): string {
  return subType ? `${intentType}:${subType}` : intentType;
}

/**
 * 检查意图是否为简单类型（适合快速层）
 *
 * @param intentType - 意图类型
 * @param subType - 子类型（可选）
 * @returns 是否为简单类型
 */
export function isSimpleIntent(
  intentType: IntentType,
  subType?: string,
): boolean {
  const tier = getTierByIntent(intentType, subType);
  return tier === "fast";
}

/**
 * 检查意图是否为复杂类型（适合深度层）
 *
 * @param intentType - 意图类型
 * @param subType - 子类型（可选）
 * @returns 是否为复杂类型
 */
export function isComplexIntent(
  intentType: IntentType,
  subType?: string,
): boolean {
  const tier = getTierByIntent(intentType, subType);
  return tier === "deep";
}
