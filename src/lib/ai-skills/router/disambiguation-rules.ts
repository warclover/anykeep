/**
 * 消歧规则配置
 *
 * 当多个意图候选置信度接近时，使用这些规则选择正确的意图
 *
 * 设计原则：
 * - 明确性原则：规则条件越具体，优先级越高
 * - 可解释性：每条规则必须有 reason 字段
 * - 可测试性：每条规则至少 3 个测试用例
 *
 * 优先级分层：
 * - 100+: 语法结构规则（动词+宾语）
 * - 50-99: 关键词规则（明确的动作词）
 * - 30-49: 场景规则（时间/语境修饰）
 * - 10-29: 默认规则
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { DisambiguationRule, IntentType } from "./types";

/**
 * 消歧规则列表
 *
 * 按优先级降序排列
 */
export const DISAMBIGUATION_RULES: DisambiguationRule[] = [
  // ============================================
  // 语法结构规则（高优先级 100+）
  // ============================================

  // 规则 1.2.3: 动词+宾语结构 → create
  // "梳理内容总结纪要" → 行为是"总结"，产出物是"纪要"
  {
    id: "verb-object-create-summary",
    conflicts: ["organize", "create"],
    pattern: /(梳理|整理|归纳).{0,10}(总结|纪要|摘要|笔记|报告)/,
    winner: "create",
    priority: 110,
    reason: "动词+宾语结构：行为产出总结类文档",
  },

  // 规则 1.2.4: 主谓结构 → create
  // "总结并整理" → 主要动作是"总结"
  {
    id: "verb-object-create-lead",
    conflicts: ["organize", "create"],
    pattern:
      /(总结|概括|归纳|撰写|生成).{0,5}(并|和|后再?|再)?.{0,5}(整理|分类|归档)?/,
    winner: "create",
    priority: 105,
    reason: "主谓结构：主要动作是创建内容",
  },

  // 规则: 整理为主 → organize
  // "整理后总结" → 主要动作是"整理"
  {
    id: "verb-object-organize-lead",
    conflicts: ["organize", "create"],
    pattern: /(整理|清理|分类|归档).{0,5}(后|完).{0,5}(总结|生成|写)/,
    winner: "organize",
    priority: 100,
    reason: "主谓结构：主要动作是整理内容",
  },

  // ============================================
  // 关键词规则（中优先级 50-99）
  // ============================================

  // 规则 1.2.5: 搜索优先
  {
    id: "search-keyword-priority",
    conflicts: ["query", "organize", "action"],
    pattern: /找.{0,10}(那篇|那个|哪篇|哪个)|搜.{0,5}(一下|下)/,
    winner: "query",
    priority: 80,
    reason: "明确的搜索动作词 + 指示代词",
  },

  // 规则 1.2.6: 统计优先
  {
    id: "count-keyword-priority",
    conflicts: ["query", "analyze"],
    pattern: /有多少|多少个|多少篇|总共|一共|数量/,
    winner: "query",
    priority: 75,
    reason: "明确的数量查询词",
  },

  // 规则 1.2.7: 导出优先
  {
    id: "export-keyword-priority",
    conflicts: ["create", "action"],
    pattern: /导出.{0,5}(成|为|到)|输出.{0,5}(成|为|到)|下载.{0,5}(成|为)/,
    winner: "create",
    priority: 70,
    reason: "明确的导出动作词 + 格式说明",
  },

  // 规则: 生成/创建类明确意图
  {
    id: "create-explicit",
    conflicts: ["organize", "create"],
    pattern: /帮我(生成|创建|写|做).{0,10}(总结|摘要|笔记|报告)/,
    winner: "create",
    priority: 85,
    reason: "明确的创建类动词",
  },

  // 规则: 分析类明确意图
  {
    id: "analyze-explicit",
    conflicts: ["query", "analyze"],
    pattern: /(分析|洞察|评估|评价).{0,10}(趋势|情况|数据|内容)/,
    winner: "analyze",
    priority: 65,
    reason: "明确的分析动作词",
  },

  // 规则: 学习/复习类
  {
    id: "learn-explicit",
    conflicts: ["query", "learn"],
    pattern: /(复习|巩固|温习|回顾).{0,10}(知识|内容|收藏)/,
    winner: "learn",
    priority: 85,
    reason: "明确的学习类动词",
  },

  // ============================================
  // 场景规则（低优先级 30-49）
  // ============================================

  // 规则: 时间修饰词通常表示搜索
  {
    id: "time-modifier-query",
    conflicts: ["query", "organize"],
    pattern: /(最近|上周|昨天|今天|本周|本月).{0,10}(的|收藏|保存)/,
    winner: "query",
    priority: 40,
    reason: "时间修饰词通常表示搜索意图",
  },

  // 规则: 批量操作通常是整理
  {
    id: "batch-operation-organize",
    conflicts: ["action", "organize"],
    pattern: /(批量|全部|所有|这些).{0,5}(整理|分类|归档|清理)/,
    winner: "organize",
    priority: 45,
    reason: "批量操作通常需要编排模式",
  },

  // 规则: 单条操作是 action
  {
    id: "single-operation-action",
    conflicts: ["action", "organize"],
    pattern: /(把|将).{0,10}(这个|那个|这篇|那篇).{0,10}(移|删|改)/,
    winner: "action",
    priority: 45,
    reason: "单条操作使用原子模式",
  },

  // ============================================
  // 默认规则（最低优先级 10-29）
  // ============================================

  // 规则: 问句默认查询
  {
    id: "question-default-query",
    conflicts: ["query", "chitchat"],
    pattern: /[？?]$/,
    winner: "query",
    priority: 20,
    reason: "问句形式默认为查询意图",
  },
];

/**
 * 获取适用于指定冲突类型的消歧规则
 *
 * @param conflictTypes - 冲突的意图类型列表
 * @returns 适用的消歧规则列表（按优先级降序）
 */
export function getApplicableRules(
  conflictTypes: IntentType[],
): DisambiguationRule[] {
  return DISAMBIGUATION_RULES.filter((rule) =>
    // 规则的冲突类型必须包含所有指定的冲突类型
    conflictTypes.every((type) => rule.conflicts.includes(type)),
  ).sort((a, b) => b.priority - a.priority);
}

/**
 * 根据消息和冲突类型找到最佳匹配规则
 *
 * @param message - 用户输入的消息
 * @param conflictTypes - 冲突的意图类型列表
 * @returns 匹配的规则，如果无匹配返回 null
 */
export function findMatchingRule(
  message: string,
  conflictTypes: IntentType[],
): DisambiguationRule | null {
  const applicableRules = getApplicableRules(conflictTypes);

  for (const rule of applicableRules) {
    if (rule.pattern.test(message)) {
      return rule;
    }
  }

  return null;
}
