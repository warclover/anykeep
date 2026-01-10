/**
 * 画像意图权重配置
 *
 * 为不同画像类型配置意图权重提升因子
 *
 * @version 1.1.0 - Phase 2 新增 analyst, cert_seeker, ux_researcher
 * @since 2025-12-28
 */

import type { PersonaType } from "./types";

// =============================================================================
// 意图类型
// =============================================================================

/**
 * 意图类型
 */
export type IntentType =
  // 搜索类
  | "search"
  | "fuzzy_search"
  // 整理类
  | "organize"
  | "theme_organize"
  | "batch_summarize"
  // 分析类
  | "competitive_analysis"
  | "industry_research"
  | "feedback_cluster"
  | "trend_tracking"
  | "data_tracking" // Phase 2 新增
  | "generate_report" // Phase 2 新增
  // 教学类
  | "course_organize"
  | "paper_tracking"
  | "teaching_case"
  // 咨询类
  | "case_library"
  | "find_related"
  // 知识管理类
  | "knowledge_map"
  // 导出类
  | "data_export"
  // Phase 2 新增 - 备考类
  | "exam_organize" // 考试资料整理
  | "error_analysis" // 错题分析
  | "progress_track" // 进度追踪
  | "review_remind" // 复习提醒
  | "learning_path" // 学习路径
  // Phase 2 新增 - UX 研究类
  | "insight_organize" // 洞察整理
  | "pattern_library" // 模式库检索
  | "case_search" // 案例搜索
  | "usability_track"; // 可用性追踪

// =============================================================================
// Phase 1 新增画像意图权重
// =============================================================================

/**
 * Phase 1 新增画像的意图权重配置
 */
export const PHASE1_NEW_INTENT_BOOSTS: Partial<
  Record<PersonaType, Partial<Record<IntentType, number>>>
> = {
  pm: {
    competitive_analysis: 1.7, // 竞品分析
    feedback_cluster: 1.6, // 反馈聚类
    trend_tracking: 1.4, // 趋势追踪
    fuzzy_search: 1.3, // 模糊搜索
    theme_organize: 1.2, // 主题整理
    data_export: 1.2, // 数据导出
  },

  consultant: {
    industry_research: 1.7, // 行业研究
    case_library: 1.6, // 案例检索
    theme_organize: 1.5, // 主题整理
    find_related: 1.4, // 关联发现
    batch_summarize: 1.3, // 批量摘要
    data_export: 1.2, // 导出报告
  },

  teacher: {
    course_organize: 1.7, // 课程整理
    paper_tracking: 1.5, // 论文追踪
    teaching_case: 1.5, // 教学案例
    batch_summarize: 1.4, // 资料摘要
    knowledge_map: 1.3, // 知识图谱
    find_related: 1.2, // 关联发现
  },
};

// =============================================================================
// Phase 2 新增画像意图权重
// =============================================================================

/**
 * Phase 2 新增画像的意图权重配置
 */
export const PHASE2_NEW_INTENT_BOOSTS: Partial<
  Record<PersonaType, Partial<Record<IntentType, number>>>
> = {
  analyst: {
    data_tracking: 1.7, // 数据追踪
    industry_research: 1.6, // 行业研究
    competitive_analysis: 1.5, // 竞品分析
    trend_tracking: 1.4, // 趋势追踪
    generate_report: 1.3, // 生成报告
  },

  cert_seeker: {
    exam_organize: 1.8, // 考试资料整理
    error_analysis: 1.7, // 错题分析
    progress_track: 1.5, // 进度追踪
    review_remind: 1.4, // 复习提醒
    learning_path: 1.3, // 学习路径
  },

  ux_researcher: {
    insight_organize: 1.7, // 洞察整理
    pattern_library: 1.6, // 模式库检索
    case_search: 1.5, // 案例搜索
    usability_track: 1.4, // 可用性追踪
    find_related: 1.3, // 关联发现
  },
};

// =============================================================================
// 原有画像意图权重
// =============================================================================

/**
 * 原有画像的意图权重配置
 */
export const LEGACY_INTENT_BOOSTS: Partial<
  Record<PersonaType, Partial<Record<IntentType, number>>>
> = {
  student: {
    search: 1.3,
    course_organize: 1.4,
    batch_summarize: 1.2,
  },

  master: {
    paper_tracking: 1.5,
    search: 1.4, // 搜索（已包含语义搜索）
    batch_summarize: 1.3,
    knowledge_map: 1.2,
  },

  phd: {
    paper_tracking: 1.7,
    search: 1.5, // 搜索（已包含语义搜索）
    find_related: 1.4,
    knowledge_map: 1.3,
  },

  tech_blogger: {
    trend_tracking: 1.5,
    theme_organize: 1.4,
    batch_summarize: 1.3,
  },

  knowledge_blogger: {
    theme_organize: 1.5,
    batch_summarize: 1.4,
    knowledge_map: 1.3,
  },

  dev_blogger: {
    fuzzy_search: 1.4,
    theme_organize: 1.3,
    data_export: 1.2,
  },

  indie_dev: {
    fuzzy_search: 1.5,
    find_related: 1.3,
    trend_tracking: 1.2,
  },

  ai_enthusiast: {
    paper_tracking: 1.5,
    trend_tracking: 1.5,
    search: 1.4, // 搜索（已包含语义搜索）
  },

  creator: {
    trend_tracking: 1.5,
    theme_organize: 1.4,
    batch_summarize: 1.2,
  },
};

// =============================================================================
// 合并后的意图权重
// =============================================================================

/**
 * 所有画像的意图权重配置
 */
export const PERSONA_INTENT_BOOSTS: Partial<
  Record<PersonaType, Partial<Record<IntentType, number>>>
> = {
  ...LEGACY_INTENT_BOOSTS,
  ...PHASE1_NEW_INTENT_BOOSTS,
  ...PHASE2_NEW_INTENT_BOOSTS,
};

// =============================================================================
// 权重获取函数
// =============================================================================

/**
 * 获取画像对特定意图的权重提升因子
 *
 * @param persona 画像类型
 * @param intent 意图类型
 * @returns 权重因子（默认 1.0，无提升）
 */
export function getIntentBoost(
  persona: PersonaType,
  intent: IntentType,
): number {
  const boosts = PERSONA_INTENT_BOOSTS[persona];
  if (!boosts) return 1.0;
  return boosts[intent] ?? 1.0;
}

/**
 * 获取画像的所有意图权重配置
 *
 * @param persona 画像类型
 * @returns 意图权重映射
 */
export function getPersonaIntentBoosts(
  persona: PersonaType,
): Partial<Record<IntentType, number>> {
  return PERSONA_INTENT_BOOSTS[persona] || {};
}

/**
 * 获取意图在各画像中的最高权重
 *
 * @param intent 意图类型
 * @returns 最高权重因子
 */
export function getMaxIntentBoost(intent: IntentType): number {
  let max = 1.0;
  for (const boosts of Object.values(PERSONA_INTENT_BOOSTS)) {
    const boost = boosts?.[intent];
    if (boost && boost > max) {
      max = boost;
    }
  }
  return max;
}

/**
 * 检查意图是否被任何画像增强
 */
export function isIntentBoosted(intent: IntentType): boolean {
  return getMaxIntentBoost(intent) > 1.0;
}
