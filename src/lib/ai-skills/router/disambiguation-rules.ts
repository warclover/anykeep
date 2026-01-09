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
 * @version 2.0.0
 * @since 2025-12-25
 * @updated 2025-12-26 - 添加 DisambiguationRulesManager 支持可配置化
 *
 * @deprecated 自 2025-01-05 起废弃。
 *
 * 消歧规则已合并到 IntentAnalyzer 中（见 intent-analyzer.ts 第 130-240 行）。
 *
 * **迁移指南**：
 * 1. IntentRouter 应迁移为使用 IntentAnalyzer，而非旧的三层架构
 *    （IntentClassifier + ComplexityEvaluator + ModeSelector）
 * 2. 直接使用本模块的代码应迁移到 IntentAnalyzer
 *
 * **迁移后可删除此文件**
 *
 * @see {@link ./intent-analyzer.ts} - 统一意图分析器（推荐）
 */

import type { DisambiguationRule, IntentType } from "./types";

// ============================================
// 配置类型定义
// ============================================

/**
 * 消歧规则管理器配置
 */
export interface DisambiguationRulesConfig {
  /** 是否启用内置规则 */
  enableBuiltinRules?: boolean;
  /** 禁用的内置规则 ID 列表 */
  disabledRuleIds?: string[];
  /** 自定义规则列表 */
  customRules?: DisambiguationRule[];
  /** 规则优先级覆盖 (规则ID -> 新优先级) */
  priorityOverrides?: Record<string, number>;
}

/**
 * 消歧规则列表
 *
 * 按优先级降序排列
 *
 * @deprecated 使用 IntentAnalyzer 内置规则替代
 * @see {@link ./intent-analyzer.ts} - 统一意图分析器（推荐）
 */
export const DISAMBIGUATION_RULES: DisambiguationRule[] = [
  // ============================================
  // Phase 1: digest vs synthesis 消歧规则 (2026-01-09)
  // ============================================

  // 规则: 融合信号 → synthesis
  // "结合...写..."、"融合...生成..." → 综合性输出
  {
    id: "digest-vs-synthesis-fusion",
    conflicts: ["create"],
    pattern: /(结合|融合|整合|汇总|合成|归纳).{0,10}(写|生成|做|成)/,
    winner: "create",
    priority: 105,
    reason: "融合动词 + 创作动词 → 综合性输出 (synthesis)",
  },

  // 规则: "一篇/一份" 结构 → synthesis
  // "写一篇..."、"整理成一份..." → 单一综合输出
  {
    id: "digest-vs-synthesis-single-output",
    conflicts: ["create"],
    pattern: /(写|生成|做|形成|整理成).{0,5}(一篇|一份|一个)/,
    winner: "create",
    priority: 100,
    reason: "单一输出期望 → 综合性文章 (synthesis)",
  },

  // 规则: 列表信号 → digest
  // "逐条..."、"分别..."、"每篇..." → 独立摘要
  {
    id: "digest-vs-synthesis-list",
    conflicts: ["create"],
    pattern: /(逐条|分别|每篇|每个|列出|要点)/,
    winner: "create",
    priority: 100,
    reason: "列表信号 → 独立摘要 (digest)",
  },

  // 规则: organize vs synthesis (整理成文章)
  // "整理成文章"、"梳理成报告" → 内容合成
  {
    id: "organize-vs-synthesis-article",
    conflicts: ["organize", "create"],
    pattern: /(整理|梳理).{0,5}(成|为).{0,5}(文章|报告|笔记|文档)/,
    winner: "create",
    priority: 95,
    reason: "整理成文章 → 内容合成 (synthesis) 而非书签整理",
  },

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
 *
 * @deprecated 使用 IntentAnalyzer 内置逻辑替代
 * @see {@link ./intent-analyzer.ts} - 统一意图分析器（推荐）
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
 *
 * @deprecated 使用 IntentAnalyzer 内置逻辑替代
 * @see {@link ./intent-analyzer.ts} - 统一意图分析器（推荐）
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

// ============================================
// DisambiguationRulesManager 类
// ============================================

/**
 * 消歧规则管理器
 *
 * 提供消歧规则的可配置化管理，支持：
 * - 启用/禁用内置规则
 * - 添加自定义规则
 * - 覆盖规则优先级
 * - 动态更新规则集
 *
 * @deprecated 使用 IntentAnalyzer.addRule() 替代
 * @see {@link ./intent-analyzer.ts} - 统一意图分析器（推荐）
 *
 * @example
 * ```typescript
 * // 旧代码
 * const manager = new DisambiguationRulesManager({...});
 *
 * // 新代码
 * const analyzer = new IntentAnalyzer();
 * analyzer.addRule({ pattern: /.../, type: '...', ... });
 * ```
 */
export class DisambiguationRulesManager {
  private config: Required<DisambiguationRulesConfig>;
  private activeRulesCache: DisambiguationRule[] | null = null;

  constructor(config: DisambiguationRulesConfig = {}) {
    this.config = {
      enableBuiltinRules: config.enableBuiltinRules ?? true,
      disabledRuleIds: config.disabledRuleIds ?? [],
      customRules: config.customRules ?? [],
      priorityOverrides: config.priorityOverrides ?? {},
    };
  }

  /**
   * 获取所有激活的规则（按优先级降序）
   */
  getActiveRules(): DisambiguationRule[] {
    if (this.activeRulesCache) {
      return this.activeRulesCache;
    }

    const rules: DisambiguationRule[] = [];

    // 添加内置规则（如果启用）
    if (this.config.enableBuiltinRules) {
      for (const rule of DISAMBIGUATION_RULES) {
        if (!this.config.disabledRuleIds.includes(rule.id)) {
          // 应用优先级覆盖
          const overriddenPriority = this.config.priorityOverrides[rule.id];
          if (overriddenPriority !== undefined) {
            rules.push({ ...rule, priority: overriddenPriority });
          } else {
            rules.push(rule);
          }
        }
      }
    }

    // 添加自定义规则
    for (const rule of this.config.customRules) {
      // 检查是否与内置规则 ID 冲突
      const existingIndex = rules.findIndex((r) => r.id === rule.id);
      if (existingIndex >= 0) {
        // 自定义规则覆盖同 ID 的内置规则
        rules[existingIndex] = rule;
      } else {
        rules.push(rule);
      }
    }

    // 按优先级降序排序并缓存
    this.activeRulesCache = rules.sort((a, b) => b.priority - a.priority);
    return this.activeRulesCache;
  }

  /**
   * 获取适用于指定冲突类型的规则
   */
  getApplicableRulesFor(conflictTypes: IntentType[]): DisambiguationRule[] {
    return this.getActiveRules().filter((rule) =>
      conflictTypes.every((type) => rule.conflicts.includes(type)),
    );
  }

  /**
   * 根据消息和冲突类型找到最佳匹配规则
   */
  findMatch(
    message: string,
    conflictTypes: IntentType[],
  ): DisambiguationRule | null {
    const applicableRules = this.getApplicableRulesFor(conflictTypes);

    for (const rule of applicableRules) {
      if (rule.pattern.test(message)) {
        return rule;
      }
    }

    return null;
  }

  /**
   * 添加自定义规则
   */
  addRule(rule: DisambiguationRule): void {
    this.config.customRules.push(rule);
    this.invalidateCache();
  }

  /**
   * 移除自定义规则
   */
  removeRule(ruleId: string): boolean {
    const index = this.config.customRules.findIndex((r) => r.id === ruleId);
    if (index >= 0) {
      this.config.customRules.splice(index, 1);
      this.invalidateCache();
      return true;
    }
    return false;
  }

  /**
   * 禁用内置规则
   */
  disableBuiltinRule(ruleId: string): void {
    if (!this.config.disabledRuleIds.includes(ruleId)) {
      this.config.disabledRuleIds.push(ruleId);
      this.invalidateCache();
    }
  }

  /**
   * 启用内置规则
   */
  enableBuiltinRule(ruleId: string): void {
    const index = this.config.disabledRuleIds.indexOf(ruleId);
    if (index >= 0) {
      this.config.disabledRuleIds.splice(index, 1);
      this.invalidateCache();
    }
  }

  /**
   * 设置规则优先级覆盖
   */
  setPriorityOverride(ruleId: string, priority: number): void {
    this.config.priorityOverrides[ruleId] = priority;
    this.invalidateCache();
  }

  /**
   * 清除规则优先级覆盖
   */
  clearPriorityOverride(ruleId: string): void {
    delete this.config.priorityOverrides[ruleId];
    this.invalidateCache();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DisambiguationRulesConfig>): void {
    if (config.enableBuiltinRules !== undefined) {
      this.config.enableBuiltinRules = config.enableBuiltinRules;
    }
    if (config.disabledRuleIds !== undefined) {
      this.config.disabledRuleIds = config.disabledRuleIds;
    }
    if (config.customRules !== undefined) {
      this.config.customRules = config.customRules;
    }
    if (config.priorityOverrides !== undefined) {
      this.config.priorityOverrides = config.priorityOverrides;
    }
    this.invalidateCache();
  }

  /**
   * 获取当前配置
   */
  getConfig(): DisambiguationRulesConfig {
    return { ...this.config };
  }

  /**
   * 获取规则统计信息
   */
  getStats(): {
    totalRules: number;
    builtinRules: number;
    customRules: number;
    disabledRules: number;
  } {
    const activeRules = this.getActiveRules();
    const builtinCount = this.config.enableBuiltinRules
      ? DISAMBIGUATION_RULES.length - this.config.disabledRuleIds.length
      : 0;

    return {
      totalRules: activeRules.length,
      builtinRules: builtinCount,
      customRules: this.config.customRules.length,
      disabledRules: this.config.disabledRuleIds.length,
    };
  }

  /**
   * 检查规则是否存在
   */
  hasRule(ruleId: string): boolean {
    return this.getActiveRules().some((r) => r.id === ruleId);
  }

  /**
   * 获取指定规则
   */
  getRule(ruleId: string): DisambiguationRule | null {
    return this.getActiveRules().find((r) => r.id === ruleId) ?? null;
  }

  /**
   * 重置为默认配置
   */
  reset(): void {
    this.config = {
      enableBuiltinRules: true,
      disabledRuleIds: [],
      customRules: [],
      priorityOverrides: {},
    };
    this.invalidateCache();
  }

  /**
   * 清除缓存
   */
  private invalidateCache(): void {
    this.activeRulesCache = null;
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建消歧规则管理器
 */
export function createDisambiguationRulesManager(
  config?: DisambiguationRulesConfig,
): DisambiguationRulesManager {
  return new DisambiguationRulesManager(config);
}

/**
 * 默认消歧规则管理器（全局单例）
 */
let defaultManager: DisambiguationRulesManager | null = null;

export function getDefaultDisambiguationRulesManager(): DisambiguationRulesManager {
  if (!defaultManager) {
    defaultManager = createDisambiguationRulesManager();
  }
  return defaultManager;
}
