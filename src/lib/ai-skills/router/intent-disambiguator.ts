/**
 * IntentDisambiguator - 意图消歧器
 *
 * 职责：
 * - 判断是否需要消歧
 * - 生成用户友好的消歧问题
 * - 过滤备选项
 *
 * 触发条件：
 * - 置信度在模糊区间（0.5 - 0.75）
 * - 有高置信度的备选项（与 top1 差值 < 0.1）
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import { logger } from "@/lib/logger";
import type { IntentType } from "./types";

// ============================================
// 类型定义
// ============================================

/**
 * 意图匹配结果（与 HybridIntentMatch 兼容）
 */
export interface IntentMatch {
  /** 意图类型 */
  type: IntentType;
  /** 子类型 */
  subType?: string;
  /** 置信度 0-1 */
  confidence: number;
  /** 备选意图 */
  alternatives?: IntentAlternative[];
}

/**
 * 备选意图
 */
export interface IntentAlternative {
  /** 意图类型 */
  type: IntentType;
  /** 子类型 */
  subType?: string;
  /** 置信度 */
  confidence: number;
}

/**
 * 消歧选项
 */
export interface DisambiguationOption {
  /** 显示标签 */
  label: string;
  /** 选项值（格式: type:subType） */
  value: string;
  /** 选项描述 */
  description: string;
}

/**
 * 消歧问题
 */
export interface DisambiguationQuestion {
  /** 问题类型 */
  type: "disambiguation";
  /** 问题文本 */
  question: string;
  /** 选项列表 */
  options: DisambiguationOption[];
  /** 是否允许自定义输入 */
  allowCustomInput: boolean;
  /** 超时时间（毫秒） */
  timeout: number;
}

/**
 * 消歧器配置
 */
export interface IntentDisambiguatorConfig {
  /** 消歧触发的最低置信度（默认 0.5） */
  minConfidenceForDisambiguation?: number;
  /** 消歧触发的最高置信度（默认 0.75） */
  maxConfidenceForDisambiguation?: number;
  /** 备选项与 top1 的最大差值（默认 0.1） */
  alternativeConfidenceGap?: number;
  /** 超时时间（毫秒，默认 30000） */
  timeout?: number;
  /** 是否启用调试模式 */
  debug?: boolean;
}

// ============================================
// 常量配置
// ============================================

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  minConfidenceForDisambiguation: 0.5,
  maxConfidenceForDisambiguation: 0.75,
  alternativeConfidenceGap: 0.1,
  timeout: 30000,
  debug: false,
};

/**
 * 意图用户友好标签
 */
const INTENT_LABELS: Record<string, Record<string, string>> = {
  query: {
    search: "搜索收藏",
    list: "查看列表",
    count: "统计数量",
    get: "查看详情",
  },
  action: {
    delete: "删除书签",
    move: "移动书签",
    tag: "打标签",
    star: "收藏/取消收藏",
    mark_read: "标记已读",
    archive: "归档",
    undo: "撤销操作",
    cancel: "取消操作",
  },
  organize: {
    cleanup: "整理收藏",
    dedupe: "清理重复",
    classify: "自动分类",
    tag: "智能标签",
  },
  create: {
    digest: "生成摘要",
    export: "导出数据",
    tts: "语音朗读",
    md_collection: "保存为笔记",
    import: "导入书签",
    smart_list: "创建智能列表",
  },
  analyze: {
    report: "生成报告",
    insight: "数据洞察",
    discover: "相关发现",
  },
  learn: {
    active_recall_start: "开始复习",
    review: "知识回顾",
    path: "学习路径",
    plan: "阅读计划",
  },
  chitchat: {
    greeting: "打招呼",
    help: "获取帮助",
    thanks: "表达感谢",
    general: "闲聊",
  },
  refine: {
    filter: "筛选结果",
    sort: "排序结果",
  },
};

/**
 * 意图描述
 */
const INTENT_DESCRIPTIONS: Record<string, string> = {
  "query:search": "在您的收藏中搜索内容",
  "query:list": "列出您的收藏或文件夹内容",
  "query:count": "统计收藏数量",
  "query:get": "查看某个书签的详细信息",
  "action:delete": "删除选中的书签",
  "action:move": "将书签移动到指定文件夹",
  "action:tag": "为书签添加或修改标签",
  "action:star": "收藏或取消收藏",
  "action:archive": "归档书签",
  "action:undo": "撤销上一步操作",
  "action:cancel": "取消当前操作",
  "organize:cleanup": "智能整理您的收藏",
  "organize:dedupe": "查找并清理重复书签",
  "organize:classify": "自动分类未整理的书签",
  "organize:tag": "为没有标签的书签智能打标签",
  "create:digest": "为选中的内容生成摘要",
  "create:export": "导出您的收藏数据",
  "create:tts": "将内容转换为语音朗读",
  "create:md_collection": "将内容保存为 Markdown 笔记",
  "create:import": "从浏览器导入书签",
  "analyze:report": "生成收藏统计报告",
  "analyze:insight": "分析您的收藏习惯和洞察",
  "learn:active_recall_start": "开始主动复习收藏内容",
  "learn:review": "回顾之前收藏的知识",
  "learn:path": "规划学习路径",
  "chitchat:greeting": "与 AI 助手打招呼",
  "chitchat:help": "获取使用帮助",
};

// ============================================
// IntentDisambiguator 类
// ============================================

/**
 * 意图消歧器
 *
 * 当用户意图不明确时，生成澄清问题帮助确定真实意图
 */
export class IntentDisambiguator {
  private config: Required<IntentDisambiguatorConfig>;

  constructor(config: IntentDisambiguatorConfig = {}) {
    this.config = {
      minConfidenceForDisambiguation:
        config.minConfidenceForDisambiguation ??
        DEFAULT_CONFIG.minConfidenceForDisambiguation,
      maxConfidenceForDisambiguation:
        config.maxConfidenceForDisambiguation ??
        DEFAULT_CONFIG.maxConfidenceForDisambiguation,
      alternativeConfidenceGap:
        config.alternativeConfidenceGap ??
        DEFAULT_CONFIG.alternativeConfidenceGap,
      timeout: config.timeout ?? DEFAULT_CONFIG.timeout,
      debug: config.debug ?? DEFAULT_CONFIG.debug,
    };
  }

  /**
   * 判断是否需要消歧
   *
   * @param match - 意图匹配结果
   * @returns 是否需要消歧
   */
  needsDisambiguation(match: IntentMatch): boolean {
    // 条件 1: 置信度在模糊区间
    const inAmbiguousRange =
      match.confidence >= this.config.minConfidenceForDisambiguation &&
      match.confidence < this.config.maxConfidenceForDisambiguation;

    if (!inAmbiguousRange) {
      return false;
    }

    // 条件 2: 有高置信度的备选项
    const hasStrongAlternative = match.alternatives?.some(
      (alt) =>
        alt.confidence >
        match.confidence - this.config.alternativeConfidenceGap,
    );

    if (this.config.debug && hasStrongAlternative) {
      logger.debug(
        {
          intent: `${match.type}:${match.subType}`,
          confidence: match.confidence,
          alternatives: match.alternatives?.slice(0, 3),
        },
        "IntentDisambiguator: Disambiguation needed",
      );
    }

    return hasStrongAlternative ?? false;
  }

  /**
   * 生成消歧问题
   *
   * @param match - 意图匹配结果
   * @returns 消歧问题
   */
  generateDisambiguationQuestion(match: IntentMatch): DisambiguationQuestion {
    const options: DisambiguationOption[] = [];

    // 添加主意图选项
    options.push({
      label: this.getIntentLabel(match.type, match.subType),
      value: `${match.type}:${match.subType || "*"}`,
      description: this.getIntentDescription(match.type, match.subType),
    });

    // 添加备选意图选项（最多 2 个）
    if (match.alternatives) {
      const topAlternatives = match.alternatives
        .filter((alt) => {
          // 过滤掉与主意图相同的
          return !(alt.type === match.type && alt.subType === match.subType);
        })
        .slice(0, 2);

      for (const alt of topAlternatives) {
        options.push({
          label: this.getIntentLabel(alt.type, alt.subType),
          value: `${alt.type}:${alt.subType || "*"}`,
          description: this.getIntentDescription(alt.type, alt.subType),
        });
      }
    }

    return {
      type: "disambiguation",
      question: "我不太确定您的意思，您是想要：",
      options,
      allowCustomInput: true,
      timeout: this.config.timeout,
    };
  }

  /**
   * 根据上下文过滤备选项
   *
   * @param alternatives - 备选意图列表
   * @param context - 上下文信息
   * @returns 过滤后的备选意图
   */
  filterByContext(
    alternatives: IntentAlternative[],
    context: {
      hasSelection?: boolean;
      hasRecentSearch?: boolean;
      currentView?: string;
    },
  ): IntentAlternative[] {
    return alternatives.filter((alt) => {
      // 如果没有选中项，过滤掉需要选中项的操作
      if (!context.hasSelection) {
        const needsSelection = [
          "action:delete",
          "action:move",
          "action:tag",
          "create:digest",
          "create:tts",
        ];
        if (needsSelection.includes(`${alt.type}:${alt.subType}`)) {
          return false;
        }
      }

      // 如果没有最近搜索，过滤掉 refine 类型
      if (!context.hasRecentSearch && alt.type === "refine") {
        return false;
      }

      return true;
    });
  }

  /**
   * 解析用户选择的消歧选项
   *
   * @param value - 选项值（格式: type:subType）
   * @returns 解析后的意图类型和子类型
   */
  parseDisambiguationChoice(value: string): {
    type: IntentType;
    subType?: string;
  } | null {
    const parts = value.split(":");
    if (parts.length < 2) {
      return null;
    }

    const type = parts[0] as IntentType;
    const subType = parts[1] === "*" ? undefined : parts[1];

    return { type, subType };
  }

  /**
   * 获取意图的用户友好标签
   */
  getIntentLabel(type: IntentType, subType?: string): string {
    const typeLabels = INTENT_LABELS[type];
    if (typeLabels && subType && typeLabels[subType]) {
      return typeLabels[subType];
    }

    // 默认标签
    const defaultLabels: Record<IntentType, string> = {
      query: "查询",
      action: "操作",
      organize: "整理",
      analyze: "分析",
      learn: "学习",
      create: "创建",
      refine: "筛选",
      chitchat: "对话",
    };

    return defaultLabels[type] || type;
  }

  /**
   * 获取意图的描述
   */
  getIntentDescription(type: IntentType, subType?: string): string {
    const key = subType ? `${type}:${subType}` : `${type}:*`;
    return (
      INTENT_DESCRIPTIONS[key] ||
      `执行${this.getIntentLabel(type, subType)}操作`
    );
  }

  /**
   * 基于输入模式推断更可能的意图
   *
   * @param input - 用户输入
   * @param candidates - 候选意图
   * @returns 推荐的意图（如果能确定）
   */
  inferFromInputPattern(
    input: string,
    candidates: IntentAlternative[],
  ): IntentAlternative | null {
    // 特征模式匹配
    const patterns: Array<{
      pattern: RegExp;
      preferredType: IntentType;
      preferredSubType?: string;
    }> = [
      // 明确的删除意图
      {
        pattern: /删除|删掉|去掉|移除/i,
        preferredType: "action",
        preferredSubType: "delete",
      },
      // 明确的搜索意图
      {
        pattern: /搜索|找|查|有没有/i,
        preferredType: "query",
        preferredSubType: "search",
      },
      // 明确的整理意图
      { pattern: /整理|清理|分类|归类/i, preferredType: "organize" },
      // 明确的导出意图
      {
        pattern: /导出|export|下载/i,
        preferredType: "create",
        preferredSubType: "export",
      },
      // 明确的统计意图
      {
        pattern: /多少|几个|统计|数量/i,
        preferredType: "query",
        preferredSubType: "count",
      },
    ];

    for (const { pattern, preferredType, preferredSubType } of patterns) {
      if (pattern.test(input)) {
        const matched = candidates.find(
          (c) =>
            c.type === preferredType &&
            (!preferredSubType || c.subType === preferredSubType),
        );
        if (matched) {
          return matched;
        }
      }
    }

    return null;
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建意图消歧器实例
 */
export function createIntentDisambiguator(
  config?: IntentDisambiguatorConfig,
): IntentDisambiguator {
  return new IntentDisambiguator(config);
}
