/**
 * 查询解析器
 *
 * 将自然语言查询解析为结构化的 ParsedQuery 对象
 * 支持关键词提取、时间范围解析、平台过滤等
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import {
  type ParsedQuery,
  type TimeRange,
  type PlatformType,
  type FuzzyLevel,
  type SearchIntentType,
  type QueryParserConfig,
  DEFAULT_QUERY_PARSER_CONFIG,
} from "./types";

// ============================================
// 停用词列表
// ============================================

/**
 * 中文停用词（常见虚词、语气词）
 */
const CHINESE_STOP_WORDS = new Set([
  // 代词
  "我",
  "你",
  "他",
  "她",
  "它",
  "我们",
  "你们",
  "他们",
  "这",
  "那",
  "这个",
  "那个",
  "这些",
  "那些",
  // 介词
  "的",
  "地",
  "得",
  "了",
  "着",
  "过",
  "在",
  "从",
  "到",
  "和",
  "与",
  "或",
  "把",
  "被",
  "让",
  "给",
  "对",
  "向",
  "跟",
  "比",
  // 连词
  "而",
  "且",
  "但",
  "但是",
  "然而",
  "因为",
  "所以",
  "如果",
  "虽然",
  "虽",
  // 助词
  "吗",
  "呢",
  "吧",
  "啊",
  "呀",
  "哦",
  "嗯",
  "哈",
  "嘛",
  "啦",
  // 量词
  "个",
  "些",
  "点",
  // 动词（搜索场景常见）
  "找",
  "搜",
  "搜索",
  "查",
  "查找",
  "看",
  "看看",
  "想",
  "想要",
  "要",
  "有",
  "没有",
  "是",
  "不是",
  "可以",
  "帮",
  "帮我",
  "给我",
  // 副词
  "很",
  "非常",
  "特别",
  "比较",
  "更",
  "最",
  "都",
  "也",
  "还",
  "又",
  "再",
  "就",
  "才",
  "只",
  "仅",
  "一下",
  "一些",
]);

// ============================================
// 时间表达式模式
// ============================================

interface TimePattern {
  pattern: RegExp;
  calculate: (match: RegExpMatchArray) => { start: Date; end: Date };
  description: string;
}

const TIME_PATTERNS: TimePattern[] = [
  // 相对时间 - 天
  {
    pattern: /今天/,
    calculate: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { start: today, end };
    },
    description: "今天",
  },
  {
    pattern: /昨天/,
    calculate: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const end = new Date(yesterday);
      end.setHours(23, 59, 59, 999);
      return { start: yesterday, end };
    },
    description: "昨天",
  },
  {
    pattern: /前天/,
    calculate: () => {
      const day = new Date();
      day.setDate(day.getDate() - 2);
      day.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);
      return { start: day, end };
    },
    description: "前天",
  },
  // 相对时间 - N天
  {
    pattern: /最近(\d+)天/,
    calculate: (match) => {
      const days = parseInt(match[1], 10);
      const start = new Date();
      start.setDate(start.getDate() - days);
      start.setHours(0, 0, 0, 0);
      return { start, end: new Date() };
    },
    description: "最近N天",
  },
  {
    pattern: /(\d+)天前/,
    calculate: (match) => {
      const days = parseInt(match[1], 10);
      const day = new Date();
      day.setDate(day.getDate() - days);
      day.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);
      return { start: day, end };
    },
    description: "N天前",
  },
  // 相对时间 - 周
  {
    pattern: /这周|本周/,
    calculate: () => {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const start = new Date(today);
      start.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      start.setHours(0, 0, 0, 0);
      return { start, end: new Date() };
    },
    description: "本周",
  },
  {
    pattern: /上周/,
    calculate: () => {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const thisMonday = new Date(today);
      thisMonday.setDate(
        today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1),
      );
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      lastMonday.setHours(0, 0, 0, 0);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(thisMonday.getDate() - 1);
      lastSunday.setHours(23, 59, 59, 999);
      return { start: lastMonday, end: lastSunday };
    },
    description: "上周",
  },
  // 相对时间 - 月
  {
    pattern: /这个月|本月/,
    calculate: () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start, end: new Date() };
    },
    description: "本月",
  },
  {
    pattern: /上个月|上月/,
    calculate: () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(
        today.getFullYear(),
        today.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );
      return { start, end };
    },
    description: "上个月",
  },
  {
    pattern: /最近(\d+)个?月/,
    calculate: (match) => {
      const months = parseInt(match[1], 10);
      const start = new Date();
      start.setMonth(start.getMonth() - months);
      start.setHours(0, 0, 0, 0);
      return { start, end: new Date() };
    },
    description: "最近N个月",
  },
  // 相对时间 - 年
  {
    pattern: /今年/,
    calculate: () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), 0, 1);
      return { start, end: new Date() };
    },
    description: "今年",
  },
  {
    pattern: /去年/,
    calculate: () => {
      const today = new Date();
      const start = new Date(today.getFullYear() - 1, 0, 1);
      const end = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      return { start, end };
    },
    description: "去年",
  },
];

// ============================================
// 平台识别模式
// ============================================

interface PlatformPattern {
  pattern: RegExp;
  platform: PlatformType;
}

const PLATFORM_PATTERNS: PlatformPattern[] = [
  { pattern: /微信|公众号|微信公众号|wx/, platform: "wechat" },
  { pattern: /b站|bilibili|哔哩哔哩|B站/, platform: "bilibili" },
  { pattern: /小红书|红书|xhs/, platform: "xiaohongshu" },
  { pattern: /知乎|zhihu/, platform: "zhihu" },
  { pattern: /掘金|juejin/, platform: "juejin" },
  { pattern: /csdn|CSDN/, platform: "csdn" },
  { pattern: /浏览器|书签|browser/, platform: "browser" },
];

// ============================================
// 搜索意图模式
// ============================================

interface IntentPattern {
  pattern: RegExp;
  intent: SearchIntentType;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // 回忆类（优先级最高，因为回忆通常包含其他关键词）
  { pattern: /之前|以前|上次|记得|好像/, intent: "recall" },
  // 找特定内容（那篇、那个 等指示词）
  { pattern: /那篇|那个|找.*讲/, intent: "find_specific" },
  // 浏览类
  { pattern: /看看|有什么|有哪些|列出|显示/, intent: "browse" },
  // 过滤类（最后匹配，因为它是最宽泛的）
  { pattern: /.*的(文章|内容|收藏)$/, intent: "filter" },
];

// ============================================
// 指代词模式
// ============================================

const REFERENCE_PATTERNS = [
  /这个/,
  /那个/,
  /这些/,
  /那些/,
  /刚才/,
  /刚刚/,
  /上面/,
  /前面/,
  /它/,
  /它们/,
];

// ============================================
// QueryParser 类
// ============================================

/**
 * 查询解析器
 *
 * 将自然语言查询解析为结构化格式，提取：
 * - 关键词（过滤停用词）
 * - 时间范围
 * - 平台过滤
 * - 模糊程度
 * - 搜索意图
 */
export class QueryParser {
  private config: Required<QueryParserConfig>;
  private stopWords: Set<string>;

  constructor(config: QueryParserConfig = {}) {
    this.config = { ...DEFAULT_QUERY_PARSER_CONFIG, ...config };
    this.stopWords = new Set([
      ...CHINESE_STOP_WORDS,
      ...this.config.customStopWords,
    ]);
  }

  /**
   * 解析查询
   */
  parse(query: string): ParsedQuery {
    const parseNotes: string[] = [];
    const original = query.trim();

    if (!original) {
      return this.createEmptyResult(original, parseNotes);
    }

    // 1. 提取时间范围
    let timeRange: TimeRange | undefined;
    let processedQuery = original;

    if (this.config.enableTimeParser) {
      const timeResult = this.parseTimeRange(original);
      if (timeResult) {
        timeRange = timeResult.timeRange;
        processedQuery = timeResult.remainingQuery;
        parseNotes.push(`时间范围: ${timeResult.timeRange.original}`);
      }
    }

    // 2. 提取平台
    let platform: PlatformType | undefined;

    if (this.config.enablePlatformParser) {
      const platformResult = this.parsePlatform(processedQuery);
      if (platformResult) {
        platform = platformResult.platform;
        processedQuery = platformResult.remainingQuery;
        parseNotes.push(`平台: ${platform}`);
      }
    }

    // 3. 提取关键词
    const keywords = this.extractKeywords(processedQuery);
    if (keywords.length > 0) {
      parseNotes.push(`关键词: ${keywords.join(", ")}`);
    }

    // 4. 判断模糊程度
    const fuzzyLevel = this.determineFuzzyLevel(original, keywords);
    parseNotes.push(`模糊程度: ${fuzzyLevel}`);

    // 5. 识别搜索意图
    const searchIntent = this.determineIntent(original);
    parseNotes.push(`搜索意图: ${searchIntent}`);

    // 6. 检查是否有指代词
    const hasReference = this.hasReferenceWords(original);
    if (hasReference) {
      parseNotes.push("包含指代词，需要上下文解析");
    }

    // 7. 计算置信度
    const confidence = this.calculateConfidence(keywords, timeRange, platform);
    parseNotes.push(`置信度: ${(confidence * 100).toFixed(0)}%`);

    return {
      original,
      keywords,
      timeRange,
      platform,
      fuzzyLevel,
      searchIntent,
      hasReference,
      confidence,
      parseNotes,
    };
  }

  /**
   * 解析时间范围
   */
  private parseTimeRange(
    query: string,
  ): { timeRange: TimeRange; remainingQuery: string } | null {
    for (const {
      pattern,
      calculate,
      description: _description,
    } of TIME_PATTERNS) {
      const match = query.match(pattern);
      if (match) {
        const { start, end } = calculate(match);
        return {
          timeRange: {
            start,
            end,
            original: match[0],
          },
          remainingQuery: query.replace(pattern, "").trim(),
        };
      }
    }
    return null;
  }

  /**
   * 解析平台
   */
  private parsePlatform(
    query: string,
  ): { platform: PlatformType; remainingQuery: string } | null {
    for (const { pattern, platform } of PLATFORM_PATTERNS) {
      const match = query.match(pattern);
      if (match) {
        // 移除平台关键词和可能的"的"字
        const remainingQuery = query
          .replace(pattern, "")
          .replace(/的$/, "")
          .trim();
        return { platform, remainingQuery };
      }
    }
    return null;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(query: string): string[] {
    // 第一步：按空格和标点分割
    const segments = query
      .split(/[\s,，.。!！?？;；:：、\-_/\\|]+/)
      .filter((t) => t.length > 0);

    // 第二步：进一步细分每个片段
    const allTokens: string[] = [];
    for (const segment of segments) {
      // 分离英文/数字和中文
      const parts = segment.split(/([a-zA-Z0-9]+)/).filter((p) => p.length > 0);

      for (const part of parts) {
        // 纯英文/数字直接添加
        if (/^[a-zA-Z0-9]+$/.test(part)) {
          allTokens.push(part);
        } else if (/^[\u4e00-\u9fa5]+$/.test(part)) {
          // 纯中文：尝试按停用词拆分
          const chineseTokens = this.splitChineseText(part);
          allTokens.push(...chineseTokens);
        } else {
          // 混合内容直接添加
          allTokens.push(part);
        }
      }
    }

    // 过滤停用词和短词
    const keywords = allTokens.filter((token) => {
      // 移除停用词
      if (this.stopWords.has(token)) {
        return false;
      }
      // 保留2个字符以上的词
      if (/^[\u4e00-\u9fa5]+$/.test(token)) {
        return token.length >= 2;
      }
      if (/^[a-zA-Z0-9]+$/.test(token)) {
        return token.length >= 2;
      }
      return token.length >= 2;
    });

    // 去重
    return [...new Set(keywords)];
  }

  /**
   * 拆分中文文本（按停用词边界）
   */
  private splitChineseText(text: string): string[] {
    const result: string[] = [];
    let current = "";

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // 检查当前字符是否是停用词
      if (this.stopWords.has(char)) {
        // 保存之前积累的词
        if (current.length > 0) {
          result.push(current);
          current = "";
        }
        continue;
      }

      // 检查是否形成双字停用词
      if (i + 1 < text.length) {
        const twoChars = char + text[i + 1];
        if (this.stopWords.has(twoChars)) {
          if (current.length > 0) {
            result.push(current);
            current = "";
          }
          i++; // 跳过下一个字符
          continue;
        }
      }

      current += char;
    }

    // 添加最后一个词
    if (current.length > 0) {
      result.push(current);
    }

    return result;
  }

  /**
   * 判断模糊程度
   */
  private determineFuzzyLevel(
    original: string,
    keywords: string[],
  ): FuzzyLevel {
    // 精确匹配：有引号包围的短语（最高优先级）
    if (/["「『"].*["」』"]/.test(original)) {
      return "exact";
    }

    // 模糊匹配：模糊表达（好像、大概、类似）（高优先级）
    if (/好像|大概|类似|可能|差不多|相关/.test(original)) {
      return "fuzzy";
    }

    // 短语匹配：非常具体的查询（长关键词或多个关键词）
    if (keywords.some((k) => k.length >= 4) || keywords.length >= 3) {
      return "phrase";
    }

    // 默认
    return this.config.defaultFuzzyLevel;
  }

  /**
   * 判断搜索意图
   */
  private determineIntent(query: string): SearchIntentType {
    for (const { pattern, intent } of INTENT_PATTERNS) {
      if (pattern.test(query)) {
        return intent;
      }
    }
    // 默认为找特定内容
    return "find_specific";
  }

  /**
   * 检查是否包含指代词
   */
  private hasReferenceWords(query: string): boolean {
    return REFERENCE_PATTERNS.some((pattern) => pattern.test(query));
  }

  /**
   * 计算解析置信度
   */
  private calculateConfidence(
    keywords: string[],
    timeRange?: TimeRange,
    platform?: PlatformType,
  ): number {
    let confidence = 0.5; // 基础分

    // 有关键词增加置信度
    if (keywords.length > 0) {
      confidence += 0.2;
    }
    if (keywords.length >= 2) {
      confidence += 0.1;
    }

    // 有时间范围增加置信度
    if (timeRange) {
      confidence += 0.1;
    }

    // 有平台增加置信度
    if (platform) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1);
  }

  /**
   * 创建空结果
   */
  private createEmptyResult(
    original: string,
    parseNotes: string[],
  ): ParsedQuery {
    parseNotes.push("空查询");
    return {
      original,
      keywords: [],
      fuzzyLevel: "fuzzy",
      searchIntent: "browse",
      hasReference: false,
      confidence: 0,
      parseNotes,
    };
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建 QueryParser 实例
 */
export function createQueryParser(config?: QueryParserConfig): QueryParser {
  return new QueryParser(config);
}

// ============================================
// 便捷方法
// ============================================

/**
 * 快速解析查询（使用默认配置）
 */
export function parseQuery(query: string): ParsedQuery {
  const parser = new QueryParser();
  return parser.parse(query);
}
