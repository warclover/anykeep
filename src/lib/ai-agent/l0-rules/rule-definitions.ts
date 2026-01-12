/**
 * L0 规则定义 - 极简版
 *
 * 设计原则：
 * 1. 只处理 100% 确定的场景
 * 2. 有任何歧义就交给 LLM
 * 3. 宁可漏判，不可误判
 *
 * @version 1.0.0
 * @since 2026-01-12
 */

import type { IntentType } from "@/lib/shared/types";

/**
 * L0 规则定义
 */
export interface L0Rule {
  /** 规则 ID */
  id: string;
  /** 规则名称 */
  name: string;
  /** 匹配模式列表 */
  patterns: RegExp[];
  /** 对应意图类型 */
  intentType: IntentType;
  /** 直接调用的工具 ID */
  toolId: string;
  /** 参数提取器 */
  paramExtractor: (
    match: RegExpMatchArray,
    input: string,
  ) => Record<string, unknown>;
}

/**
 * L0 规则列表
 *
 * 按使用频率排序，覆盖最高频场景
 */
export const L0_RULES: L0Rule[] = [
  // ============================================
  // 统计类（最高频）
  // ============================================

  {
    id: "count_all",
    name: "总数统计",
    patterns: [
      /^(我有)?多少(个|条)?(书签|收藏)/,
      /^(统计|查看)(一下)?(书签|收藏)(总数|数量)/,
      /^(书签|收藏)(总数|数量|有多少)/,
      /^有多少(个|条)?(书签|收藏)/,
    ],
    intentType: "query",
    toolId: "count_total",
    paramExtractor: () => ({}),
  },

  {
    id: "count_today",
    name: "今日统计",
    patterns: [
      /^今(天|日)(添加|收藏|新增)了?多少/,
      /^今(天|日)的(书签|收藏)(数量)?/,
      /^今(天|日)收藏了(多少|几个|几条)/,
    ],
    intentType: "query",
    toolId: "count_total",
    paramExtractor: () => ({
      timeRange: { start: "today", end: "today" },
    }),
  },

  {
    id: "count_week",
    name: "本周统计",
    patterns: [
      /^(这|本)(周|星期)(添加|收藏|新增)了?多少/,
      /^(这|本)(周|星期)的(书签|收藏)(数量)?/,
    ],
    intentType: "query",
    toolId: "count_total",
    paramExtractor: () => ({
      timeRange: { start: "this_week", end: "today" },
    }),
  },

  {
    id: "count_month",
    name: "本月统计",
    patterns: [
      /^(这|本)月(添加|收藏|新增)了?多少/,
      /^(这|本)月的(书签|收藏)(数量)?/,
    ],
    intentType: "query",
    toolId: "count_total",
    paramExtractor: () => ({
      timeRange: { start: "this_month", end: "today" },
    }),
  },

  // ============================================
  // 列表类
  // ============================================

  {
    id: "list_recent",
    name: "最近列表",
    patterns: [
      /^(看看|查看|显示)(最近|最新)(的)?(书签|收藏)/,
      /^最近(的)?(书签|收藏)/,
      /^(我)?最近收藏了(什么|哪些)/,
    ],
    intentType: "query",
    toolId: "list_recent",
    paramExtractor: () => ({
      limit: 10,
    }),
  },

  {
    id: "list_folders",
    name: "文件夹列表",
    patterns: [
      /^(看看|查看|显示|列出)(我的|所有)?(文件夹|目录)/,
      /^(我有)?哪些(文件夹|目录)/,
      /^文件夹(列表|有哪些)/,
    ],
    intentType: "query",
    toolId: "list_folders",
    paramExtractor: () => ({}),
  },

  {
    id: "list_by_folder",
    name: "按文件夹查看",
    patterns: [
      /^(看看|查看|显示)(.+)(文件夹|目录)(里|中|内)?(的|有什么|有哪些)?$/,
      /^(.+)(文件夹|目录)(里|中|内)有(什么|哪些)/,
    ],
    intentType: "query",
    toolId: "list_by_folder",
    paramExtractor: (match) => ({
      folderName: (match[2] || match[1]).trim(),
      limit: 20,
    }),
  },

  // ============================================
  // 统计信息类
  // ============================================

  {
    id: "get_stats",
    name: "获取统计",
    patterns: [
      /^(看看|查看|显示)(我的)?(收藏|书签)?(统计|数据|概览)/,
      /^(统计|数据|概览)(信息)?/,
      /^我的(收藏|书签)情况/,
    ],
    intentType: "query",
    toolId: "get_stats",
    paramExtractor: () => ({}),
  },

  // ============================================
  // 搜索类
  // ============================================

  {
    id: "search_keyword",
    name: "关键词搜索",
    patterns: [
      /^搜[索一]?[下:]?\s*(.+)/,
      /^找[一下:]?\s*(.+)/,
      /^查[找一下:]?\s*(.+)/,
    ],
    intentType: "query",
    toolId: "search_bookmarks",
    paramExtractor: (match, input) => {
      // 提取搜索关键词
      const keyword =
        match[1] || input.replace(/^(搜索?|找|查)(一下)?[：:]?\s*/, "");
      return { query: keyword.trim(), limit: 20 };
    },
  },

  // ============================================
  // 标签类
  // ============================================

  {
    id: "list_tags",
    name: "标签列表",
    patterns: [
      /^(看看|查看|显示|列出)(我的|所有)?标签/,
      /^(我有)?哪些标签/,
      /^标签(列表|有哪些)/,
    ],
    intentType: "query",
    toolId: "list_tags",
    paramExtractor: () => ({}),
  },

  // ============================================
  // 平台类
  // ============================================

  {
    id: "list_by_platform",
    name: "按平台查看",
    patterns: [
      /^(看看|查看|显示)(微信|B站|bilibili|小红书|知乎|掘金|GitHub)(的)?(书签|收藏|文章)?/,
      /^(微信|B站|bilibili|小红书|知乎|掘金|GitHub)(的|收藏的)?(书签|收藏|文章)/,
    ],
    intentType: "query",
    toolId: "list_by_platform",
    paramExtractor: (match) => {
      const platformMap: Record<string, string> = {
        微信: "wechat",
        B站: "bilibili",
        bilibili: "bilibili",
        小红书: "xiaohongshu",
        知乎: "zhihu",
        掘金: "juejin",
        GitHub: "github",
      };
      const platform = match[2] || match[1];
      return {
        platform: platformMap[platform] || platform.toLowerCase(),
        limit: 20,
      };
    },
  },
];

/**
 * 获取所有 L0 规则
 */
export function getAllL0Rules(): L0Rule[] {
  return L0_RULES;
}

/**
 * 根据 ID 获取 L0 规则
 */
export function getL0RuleById(id: string): L0Rule | undefined {
  return L0_RULES.find((rule) => rule.id === id);
}

/**
 * 获取 L0 规则统计
 */
export function getL0RuleStats(): {
  totalRules: number;
  byIntentType: Record<string, number>;
} {
  const byIntentType: Record<string, number> = {};

  for (const rule of L0_RULES) {
    byIntentType[rule.intentType] = (byIntentType[rule.intentType] || 0) + 1;
  }

  return {
    totalRules: L0_RULES.length,
    byIntentType,
  };
}
