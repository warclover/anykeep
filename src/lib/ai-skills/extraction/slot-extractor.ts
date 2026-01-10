/**
 * 统一槽位提取框架
 *
 * 提供标准化的槽位（Slot）提取能力：
 * - 常见槽位类型（数量、时间范围、布尔标志等）
 * - 基于规则的快速解析
 * - 可扩展的槽位定义
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import { logger } from "@/lib/logger";

// ============================================
// 槽位类型定义
// ============================================

/**
 * 槽位值类型
 */
export type SlotValueType =
  | "number"
  | "string"
  | "boolean"
  | "timeRange"
  | "dateRange"
  | "stringArray"
  | "enum";

/**
 * 时间范围枚举
 */
export type TimeRangeValue =
  | "today"
  | "week"
  | "month"
  | "quarter"
  | "year"
  | "all";

/**
 * 日期范围
 */
export interface DateRangeValue {
  start?: Date;
  end?: Date;
}

/**
 * 槽位定义
 */
export interface SlotDefinition<T = unknown> {
  /** 槽位名称 */
  name: string;
  /** 槽位类型 */
  type: SlotValueType;
  /** 提取规则（正则或关键词） */
  patterns: RegExp[];
  /** 默认值 */
  defaultValue?: T;
  /** 是否必需 */
  required?: boolean;
  /** 枚举值（当 type 为 enum 时） */
  enumValues?: readonly string[];
  /** 数值范围（当 type 为 number 时） */
  range?: { min?: number; max?: number };
  /** 值转换器 */
  transform?: (matched: string, fullInput: string) => T;
}

/**
 * 槽位提取结果
 */
export interface SlotExtractionResult<T = unknown> {
  /** 槽位名称 */
  name: string;
  /** 提取的值 */
  value: T;
  /** 是否使用了默认值 */
  isDefault: boolean;
  /** 匹配的原始文本 */
  matchedText?: string;
  /** 置信度 0-1 */
  confidence: number;
}

/**
 * 提取上下文
 */
export interface ExtractionContext {
  /** 用户 ID */
  userId?: string;
  /** 历史消息（用于指代消解） */
  messageHistory?: Array<{ role: string; content: string }>;
  /** 已选中的书签 ID */
  selectedBookmarkIds?: number[];
  /** 当前文件夹 ID */
  currentFolderId?: number;
}

// ============================================
// 预定义的常用槽位定义
// ============================================

/**
 * 数量槽位（1-N 条/个）
 */
export const COUNT_SLOT: SlotDefinition<number> = {
  name: "count",
  type: "number",
  patterns: [
    /(\d+)\s*[条个张篇]/,
    /最多\s*(\d+)/,
    /前\s*(\d+)/,
    /top\s*(\d+)/i,
  ],
  defaultValue: 10,
  range: { min: 1, max: 200 },
  transform: (matched) => {
    const num = parseInt(matched.replace(/\D/g, ""), 10);
    return Math.min(200, Math.max(1, num));
  },
};

/**
 * 时间范围槽位
 */
export const TIME_RANGE_SLOT: SlotDefinition<TimeRangeValue> = {
  name: "timeRange",
  type: "timeRange",
  patterns: [
    /今天|今日/,
    /本周|这周|一周/,
    /本月|这个月|一个月/,
    /本季度|这季度/,
    /今年|本年/,
    /全部|所有|全量/,
  ],
  defaultValue: "week",
  transform: (matched) => {
    if (/今天|今日/.test(matched)) return "today";
    if (/周/.test(matched)) return "week";
    if (/月/.test(matched)) return "month";
    if (/季度/.test(matched)) return "quarter";
    if (/年/.test(matched)) return "year";
    if (/全部|所有|全量/.test(matched)) return "all";
    return "week";
  },
};

/**
 * 自动执行槽位
 */
export const AUTO_EXECUTE_SLOT: SlotDefinition<boolean> = {
  name: "autoExecute",
  type: "boolean",
  patterns: [/自动|直接|立即|马上|一键/],
  defaultValue: false,
  transform: (matched) => !!matched,
};

/**
 * 详细程度槽位
 */
export const DETAIL_LEVEL_SLOT: SlotDefinition<
  "brief" | "normal" | "detailed"
> = {
  name: "detailLevel",
  type: "enum",
  patterns: [/简要|简单|概括/, /详细|完整|全面|深度/],
  enumValues: ["brief", "normal", "detailed"] as const,
  defaultValue: "normal",
  transform: (matched) => {
    if (/简要|简单|概括/.test(matched)) return "brief";
    if (/详细|完整|全面|深度/.test(matched)) return "detailed";
    return "normal";
  },
};

/**
 * 难度级别槽位
 */
export const DIFFICULTY_SLOT: SlotDefinition<"easy" | "medium" | "hard"> = {
  name: "difficulty",
  type: "enum",
  patterns: [/简单|基础|入门/, /困难|高级|深度|进阶/],
  enumValues: ["easy", "medium", "hard"] as const,
  defaultValue: "medium",
  transform: (matched) => {
    if (/简单|基础|入门/.test(matched)) return "easy";
    if (/困难|高级|深度|进阶/.test(matched)) return "hard";
    return "medium";
  },
};

/**
 * 排序方式槽位
 */
export const SORT_BY_SLOT: SlotDefinition<"date" | "relevance" | "title"> = {
  name: "sortBy",
  type: "enum",
  patterns: [/按日期|按时间|时间顺序/, /按相关|相关度/, /按标题|字母顺序/],
  enumValues: ["date", "relevance", "title"] as const,
  defaultValue: "date",
  transform: (matched) => {
    if (/日期|时间/.test(matched)) return "date";
    if (/相关/.test(matched)) return "relevance";
    if (/标题|字母/.test(matched)) return "title";
    return "date";
  },
};

/**
 * 分组方式槽位
 */
export const GROUP_BY_SLOT: SlotDefinition<
  "topic" | "date" | "platform" | "none"
> = {
  name: "groupBy",
  type: "enum",
  patterns: [/按主题|主题分/, /按日期|日期分/, /按平台|平台分/],
  enumValues: ["topic", "date", "platform", "none"] as const,
  defaultValue: "topic",
  transform: (matched) => {
    if (/主题/.test(matched)) return "topic";
    if (/日期/.test(matched)) return "date";
    if (/平台/.test(matched)) return "platform";
    return "topic";
  },
};

/**
 * 导出格式槽位
 */
export const EXPORT_FORMAT_SLOT: SlotDefinition<
  "markdown" | "json" | "csv" | "html"
> = {
  name: "exportFormat",
  type: "enum",
  patterns: [/markdown|md/i, /json/i, /csv/i, /html/i],
  enumValues: ["markdown", "json", "csv", "html"] as const,
  defaultValue: "markdown",
  transform: (matched) => {
    const lower = matched.toLowerCase();
    if (lower === "md") return "markdown";
    if (["markdown", "json", "csv", "html"].includes(lower)) {
      return lower as "markdown" | "json" | "csv" | "html";
    }
    return "markdown";
  },
};

/**
 * 预定义槽位库
 */
export const PREDEFINED_SLOTS = {
  count: COUNT_SLOT,
  timeRange: TIME_RANGE_SLOT,
  autoExecute: AUTO_EXECUTE_SLOT,
  detailLevel: DETAIL_LEVEL_SLOT,
  difficulty: DIFFICULTY_SLOT,
  sortBy: SORT_BY_SLOT,
  groupBy: GROUP_BY_SLOT,
  exportFormat: EXPORT_FORMAT_SLOT,
} as const;

export type PredefinedSlotName = keyof typeof PREDEFINED_SLOTS;

// ============================================
// 槽位提取器
// ============================================

/**
 * 槽位提取器配置
 */
export interface SlotExtractorConfig {
  /** 是否启用调试日志 */
  debug?: boolean;
  /** 是否严格模式（必需槽位未提取时抛错） */
  strict?: boolean;
}

/**
 * 统一槽位提取器
 *
 * 使用示例：
 * ```typescript
 * const extractor = new SlotExtractor({
 *   slots: [PREDEFINED_SLOTS.count, PREDEFINED_SLOTS.timeRange],
 * });
 *
 * const result = extractor.extract("帮我整理最近一个月的50条收藏");
 * // result.count = 50
 * // result.timeRange = "month"
 * ```
 */
export class SlotExtractor<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  private slots: SlotDefinition[];
  private config: SlotExtractorConfig;

  constructor(slots: SlotDefinition[], config: SlotExtractorConfig = {}) {
    this.slots = slots;
    this.config = config;
  }

  /**
   * 从输入文本中提取所有槽位
   *
   * @param input 用户输入文本
   * @param context 提取上下文
   * @returns 提取的槽位值对象
   */
  extract(input: string, context?: ExtractionContext): T {
    const results: Record<string, unknown> = {};
    const extractionDetails: SlotExtractionResult[] = [];

    for (const slot of this.slots) {
      const result = this.extractSlot(slot, input, context);
      results[slot.name] = result.value;
      extractionDetails.push(result);
    }

    // 检查必需槽位
    if (this.config.strict) {
      const missing = this.slots
        .filter((s) => s.required)
        .filter((s) => {
          const detail = extractionDetails.find((d) => d.name === s.name);
          return detail?.isDefault;
        })
        .map((s) => s.name);

      if (missing.length > 0) {
        throw new Error(`Missing required slots: ${missing.join(", ")}`);
      }
    }

    // 调试日志
    if (this.config.debug) {
      logger.debug(
        {
          input: input.slice(0, 50),
          extractedSlots: extractionDetails.map((d) => ({
            name: d.name,
            value: d.value,
            isDefault: d.isDefault,
            confidence: d.confidence,
          })),
        },
        "SlotExtractor: Extraction completed",
      );
    }

    return results as T;
  }

  /**
   * 提取单个槽位
   */
  private extractSlot(
    slot: SlotDefinition,
    input: string,
    _context?: ExtractionContext,
  ): SlotExtractionResult {
    // 尝试每个模式
    for (const pattern of slot.patterns) {
      const match = input.match(pattern);
      if (match) {
        const matchedText = match[0];
        const extractedGroup = match[1] ?? matchedText;

        // 应用转换器
        const value = slot.transform
          ? slot.transform(extractedGroup, input)
          : extractedGroup;

        // 应用范围限制（number 类型）
        let finalValue = value;
        if (slot.type === "number" && typeof value === "number" && slot.range) {
          const { min = -Infinity, max = Infinity } = slot.range;
          finalValue = Math.min(max, Math.max(min, value));
        }

        return {
          name: slot.name,
          value: finalValue,
          isDefault: false,
          matchedText,
          confidence: 0.9,
        };
      }
    }

    // 未匹配，返回默认值
    return {
      name: slot.name,
      value: slot.defaultValue,
      isDefault: true,
      confidence: slot.defaultValue !== undefined ? 0.5 : 0,
    };
  }

  /**
   * 获取槽位定义
   */
  getSlotDefinitions(): SlotDefinition[] {
    return [...this.slots];
  }

  /**
   * 添加槽位定义
   */
  addSlot(slot: SlotDefinition): void {
    this.slots.push(slot);
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建槽位提取器
 *
 * @param slotNames 预定义槽位名称列表
 * @param customSlots 自定义槽位定义
 * @param config 配置
 */
export function createSlotExtractor<T extends Record<string, unknown>>(
  slotNames: PredefinedSlotName[],
  customSlots: SlotDefinition[] = [],
  config: SlotExtractorConfig = {},
): SlotExtractor<T> {
  const slots: SlotDefinition[] = [
    ...slotNames.map((name) => PREDEFINED_SLOTS[name]),
    ...customSlots,
  ];

  return new SlotExtractor<T>(slots, config);
}

/**
 * 快速提取常用槽位
 *
 * 便捷方法，用于提取单个预定义槽位
 */
export function extractSlot<T>(
  input: string,
  slotName: PredefinedSlotName,
): T | undefined {
  const slot = PREDEFINED_SLOTS[slotName];
  const extractor = new SlotExtractor([slot]);
  const result = extractor.extract(input);
  return result[slotName] as T | undefined;
}

// ============================================
// 工具函数
// ============================================

/**
 * 合并槽位提取结果和默认值
 */
export function mergeWithDefaults<T extends Record<string, unknown>>(
  extracted: Partial<T>,
  defaults: T,
): T {
  return { ...defaults, ...extracted };
}

/**
 * 创建自定义槽位定义
 */
export function defineSlot<T>(
  name: string,
  type: SlotValueType,
  patterns: RegExp[],
  options: Partial<Omit<SlotDefinition<T>, "name" | "type" | "patterns">> = {},
): SlotDefinition<T> {
  return {
    name,
    type,
    patterns,
    ...options,
  };
}
