/**
 * AI 能力中心 - 类型、常量、工具函数
 */

import type { SkillCategory } from "@/lib/ai-skills/core/types";

// FilterCategory type without workflow
export type FilterCategory = "all" | SkillCategory;

// ============================================
// 常量
// ============================================

export const AI_HUB = {
  TITLE: "AI 能力中心",
  DESCRIPTION:
    "探索和使用 AnyKeep 的所有 AI 能力，让智能助手帮你更高效地管理知识",
  SEARCH_PLACEHOLDER: "搜索 AI 能力...",
  FILTER: {
    ALL: "全部",
    UNDERSTANDING: "理解增强",
    ORGANIZING: "整理优化",
    LEARNING: "学习助手",
    UTILITY: "实用工具",
  },
  STATS: {
    TOTAL: "总计",
    ORCHESTRATION: "编排型",
    ATOMIC: "原子型",
    FEATURE_FLAG: "需开关",
  },
  SKILL_CARD: {
    ORCHESTRATION: "编排",
    ATOMIC: "原子",
    REQUIRES_CONFIRM: "需确认",
    DURATION: "预计耗时",
    CAPABILITIES: "能力",
    DELIVERABLES: "交付物",
    OUTPUT_FORMATS: "输出格式",
    FEATURE_FLAG: "Feature Flag",
    USE_NOW: "立即使用",
    GO_TO_PAGE: "前往页面",
    VIEW_DETAILS: "查看详情",
  },
  EMPTY: {
    TITLE: "未找到匹配的 AI 能力",
    DESCRIPTION: "尝试使用不同的搜索词或筛选条件",
  },
};

// Skill 到页面的映射
export const SKILL_PAGE_MAP: Record<string, string> = {
  thematic_synthesis: "/synthesis",
  data_export: "/export",
  batch_organize: "/batch",

  insight_report: "/analytics",
};

// Skill 触发提示词映射
export const SKILL_TRIGGER_PROMPTS: Record<string, string> = {
  // 原子 Skills
  search: "帮我搜索书签",
  classify: "帮我分类这些书签",
  summary: "帮我生成书签摘要",
  folder_recommend: "推荐文件夹结构",

  // 编排 Skills - 理解增强
  knowledge_extract: "提取我收藏中的关键知识点",

  // 编排 Skills - 整理优化
  batch_organize: "智能整理我的书签",
  duplicate_cleanup: "检查并清理重复的书签",
  smart_tagging: "自动为书签添加标签",

  data_export: "导出我的书签数据",
  inbox_triage: "整理收件箱里的未分类书签",
  folder_health_check: "检查文件夹健康状态",

  // 编排 Skills - 学习助手
  periodic_report: "生成我的学习周报",
  related_discovery: "发现与我收藏相关的内容",
  // 编排 Skills - 实用工具
  insight_report: "生成我的收藏洞察报告",
  tts_synthesis: "朗读这个书签的内容",
  wechat_digest: "生成微信文章摘要",

  thematic_synthesis: "合成一个主题报告",
};

// ============================================
// 辅助函数
// ============================================

export function formatDuration(ms?: number): string {
  if (!ms) return "未知";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

export function getCategoryStyle(category: SkillCategory): {
  bg: string;
  text: string;
  border: string;
} {
  const styles: Record<
    SkillCategory,
    { bg: string; text: string; border: string }
  > = {
    understanding: {
      bg: "bg-purple-50 dark:bg-purple-900/20",
      text: "text-purple-600 dark:text-purple-400",
      border: "border-purple-200 dark:border-purple-800",
    },
    organizing: {
      bg: "bg-cyan-50 dark:bg-cyan-900/20",
      text: "text-cyan-600 dark:text-cyan-400",
      border: "border-cyan-200 dark:border-cyan-800",
    },
    learning: {
      bg: "bg-amber-50 dark:bg-amber-900/20",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-800",
    },
    utility: {
      bg: "bg-slate-50 dark:bg-slate-900/20",
      text: "text-slate-600 dark:text-slate-400",
      border: "border-slate-200 dark:border-slate-800",
    },
  };
  return styles[category];
}
