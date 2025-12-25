/**
 * 搜索响应格式化器
 *
 * 将排序后的搜索结果格式化为前端展示和 AI 回复所需的格式
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import {
  type ParsedQuery,
  type RankedResult,
  type SearchResultMeta,
  type SearchResultItem,
  type FormattedSearchResponse,
  type FollowUpSuggestion,
} from "./types";

// ============================================
// 格式化输入类型
// ============================================

/**
 * 原始书签数据（用于格式化）
 */
export interface BookmarkData {
  /** 书签 ID */
  id: number;
  /** 标题 */
  title: string;
  /** URL */
  url: string;
  /** 摘要 */
  summary?: string;
  /** 平台 */
  platform: string;
  /** 创建时间 */
  createdAt: Date;
  /** 标签 */
  tags?: string[];
  /** 文件夹名称 */
  folderName?: string;
}

/**
 * 格式化配置
 */
export interface ResponseFormatterConfig {
  /** 最大返回结果数 */
  maxResults?: number;
  /** 摘要最大长度 */
  summaryMaxLength?: number;
  /** 是否包含调试信息 */
  includeDebugInfo?: boolean;
  /** AI 回复风格 */
  responseStyle?: "concise" | "detailed";
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<ResponseFormatterConfig> = {
  maxResults: 20,
  summaryMaxLength: 200,
  includeDebugInfo: false,
  responseStyle: "concise",
};

// ============================================
// 平台显示名称映射
// ============================================

const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  wechat: "微信公众号",
  bilibili: "B站",
  xiaohongshu: "小红书",
  zhihu: "知乎",
  juejin: "掘金",
  csdn: "CSDN",
  browser: "浏览器书签",
  chrome: "Chrome",
  edge: "Edge",
  firefox: "Firefox",
  safari: "Safari",
  unknown: "其他",
};

// ============================================
// ResponseFormatter 类
// ============================================

/**
 * 搜索响应格式化器
 */
export class ResponseFormatter {
  private config: Required<ResponseFormatterConfig>;

  constructor(config: ResponseFormatterConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 格式化搜索响应
   *
   * @param rankedResults - 排序后的结果
   * @param bookmarks - 原始书签数据（按 ID 索引）
   * @param query - 解析后的查询
   * @param queryTimeMs - 查询耗时
   * @returns 格式化的搜索响应
   */
  format(
    rankedResults: RankedResult[],
    bookmarks: Map<number, BookmarkData>,
    query: ParsedQuery,
    queryTimeMs: number,
  ): FormattedSearchResponse {
    // 限制结果数量
    const limitedResults = rankedResults.slice(0, this.config.maxResults);

    // 格式化每个结果
    const results: SearchResultItem[] = [];
    for (const ranked of limitedResults) {
      const bookmark = bookmarks.get(ranked.bookmarkId);
      if (bookmark) {
        results.push(this.formatResultItem(bookmark, ranked, query));
      }
    }

    // 生成元数据
    const meta: SearchResultMeta = {
      totalCount: rankedResults.length,
      returnedCount: results.length,
      queryTimeMs,
      hasMore: rankedResults.length > this.config.maxResults,
    };

    // 包含调试信息
    if (this.config.includeDebugInfo) {
      meta.parsedQuery = query;
    }

    // 生成响应文本
    const responseText = this.generateResponseText(results, query, meta);

    // 生成空结果建议或跟进建议
    const suggestions =
      results.length === 0 ? this.generateSuggestions(query) : undefined;
    const followUpSuggestions =
      results.length > 0
        ? this.generateFollowUpSuggestions(results, query)
        : undefined;

    return {
      results,
      meta,
      responseText,
      suggestions,
      followUpSuggestions,
    };
  }

  /**
   * 格式化单个结果项
   */
  private formatResultItem(
    bookmark: BookmarkData,
    ranked: RankedResult,
    query: ParsedQuery,
  ): SearchResultItem {
    return {
      id: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      summary: this.formatSummary(bookmark.summary, query),
      platform: this.formatPlatform(bookmark.platform),
      relevance: ranked.relevance,
      createdAt: bookmark.createdAt,
      tags: bookmark.tags,
      folderName: bookmark.folderName,
    };
  }

  /**
   * 格式化摘要（高亮关键词）
   */
  private formatSummary(
    summary: string | undefined,
    query: ParsedQuery,
  ): string | undefined {
    if (!summary) return undefined;

    let formatted = summary;

    // 截断过长的摘要
    if (formatted.length > this.config.summaryMaxLength) {
      // 尝试在关键词附近截断
      const keywordIndex = this.findFirstKeywordIndex(
        formatted,
        query.keywords,
      );
      if (keywordIndex !== -1 && keywordIndex > 50) {
        // 从关键词前 50 字符开始
        const start = Math.max(0, keywordIndex - 50);
        formatted =
          "..." +
          formatted.slice(start, start + this.config.summaryMaxLength - 3);
      } else {
        formatted =
          formatted.slice(0, this.config.summaryMaxLength - 3) + "...";
      }
    }

    // 高亮关键词（使用 **keyword** 格式）
    for (const keyword of query.keywords) {
      const regex = new RegExp(`(${this.escapeRegex(keyword)})`, "gi");
      formatted = formatted.replace(regex, "**$1**");
    }

    return formatted;
  }

  /**
   * 查找第一个关键词的位置
   */
  private findFirstKeywordIndex(text: string, keywords: string[]): number {
    const textLower = text.toLowerCase();
    let minIndex = -1;

    for (const keyword of keywords) {
      const index = textLower.indexOf(keyword.toLowerCase());
      if (index !== -1 && (minIndex === -1 || index < minIndex)) {
        minIndex = index;
      }
    }

    return minIndex;
  }

  /**
   * 转义正则特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * 格式化平台名称
   */
  private formatPlatform(platform: string): string {
    return PLATFORM_DISPLAY_NAMES[platform.toLowerCase()] || platform;
  }

  /**
   * 生成 AI 响应文本（自然化风格）
   */
  private generateResponseText(
    results: SearchResultItem[],
    query: ParsedQuery,
    meta: SearchResultMeta,
  ): string {
    if (results.length === 0) {
      return this.generateEmptyResponseText(query);
    }

    const lines: string[] = [];

    // 开头总结（直接给结果，不说废话）
    if (this.config.responseStyle === "detailed") {
      lines.push(this.generateDetailedIntro(results, query, meta));
    } else {
      lines.push(this.generateConciseIntro(results, query));
    }

    // 高相关度结果
    const highRelevance = results.filter((r) => r.relevance === "high");
    if (highRelevance.length > 0) {
      lines.push("");
      lines.push("📌 **最相关：**");
      for (const item of highRelevance.slice(0, 3)) {
        lines.push(this.formatResultLine(item));
      }
    }

    // 中等相关度结果
    const mediumRelevance = results.filter((r) => r.relevance === "medium");
    if (mediumRelevance.length > 0 && highRelevance.length < 3) {
      lines.push("");
      lines.push("📋 **其他相关：**");
      for (const item of mediumRelevance.slice(0, 5 - highRelevance.length)) {
        lines.push(this.formatResultLine(item));
      }
    }

    // 如果有更多结果
    if (meta.hasMore) {
      lines.push("");
      lines.push(
        `还有 ${meta.totalCount - meta.returnedCount} 条，可以筛选查看`,
      );
    }

    // 跟进引导（简洁的下一步提示）
    lines.push("");
    lines.push(this.generateFollowUpPrompt(results, query));

    return lines.join("\n");
  }

  /**
   * 生成详细的开头介绍
   */
  private generateDetailedIntro(
    results: SearchResultItem[],
    query: ParsedQuery,
    meta: SearchResultMeta,
  ): string {
    const parts: string[] = [];

    parts.push(`找到 ${meta.totalCount} 条相关结果`);

    if (query.timeRange) {
      parts.push(`（${query.timeRange.original}）`);
    }

    if (query.platform) {
      parts.push(`来自${this.formatPlatform(query.platform)}`);
    }

    parts.push(`，耗时 ${meta.queryTimeMs}ms。`);

    return parts.join("");
  }

  /**
   * 生成简洁的开头介绍
   */
  private generateConciseIntro(
    results: SearchResultItem[],
    _query: ParsedQuery,
  ): string {
    if (results.length === 1) {
      return "找到 1 条相关结果：";
    }

    const highCount = results.filter((r) => r.relevance === "high").length;

    if (highCount > 0) {
      return `找到 ${results.length} 条结果，其中 ${highCount} 条高度相关：`;
    }

    return `找到 ${results.length} 条相关结果：`;
  }

  /**
   * 格式化单条结果行
   */
  private formatResultLine(item: SearchResultItem): string {
    const parts: string[] = [];

    parts.push(`- **${item.title}**`);

    if (item.platform) {
      parts.push(` [${item.platform}]`);
    }

    if (item.summary) {
      // 简化摘要，移除高亮标记用于行内显示
      const plainSummary = item.summary.replace(/\*\*/g, "").slice(0, 80);
      if (plainSummary.length < item.summary.replace(/\*\*/g, "").length) {
        parts.push(`\n  ${plainSummary}...`);
      } else {
        parts.push(`\n  ${plainSummary}`);
      }
    }

    return parts.join("");
  }

  /**
   * 生成跟进引导提示（自然化风格）
   */
  private generateFollowUpPrompt(
    results: SearchResultItem[],
    query: ParsedQuery,
  ): string {
    // 根据结果数量和筛选条件，生成自然的下一步提示
    if (results.length === 1) {
      return "要看详情吗？";
    }

    if (results.length >= 5 && !query.timeRange && !query.platform) {
      return "要看详情、筛选还是继续找？";
    }

    if (results.length >= 5) {
      return "要看详情还是筛选？";
    }

    return "要看详情还是继续找？";
  }

  /**
   * 生成空结果响应文本（自然化风格）
   */
  private generateEmptyResponseText(query: ParsedQuery): string {
    const lines: string[] = [];

    // 直接展示未找到的查询词，避免程序化措辞
    const searchTerms = query.keywords.join("、") || query.original;
    lines.push(`没找到「${searchTerms}」相关的收藏`);

    // 添加筛选条件说明（如果有）
    const filters: string[] = [];
    if (query.timeRange) {
      filters.push(query.timeRange.original);
    }
    if (query.platform && query.platform !== "all") {
      filters.push(this.formatPlatform(query.platform));
    }

    if (filters.length > 0) {
      lines.push(`（已筛选：${filters.join("、")}）`);
    }

    return lines.join("");
  }

  /**
   * 生成空结果建议
   */
  private generateSuggestions(query: ParsedQuery): string[] {
    const suggestions: string[] = [];

    // 建议放宽时间范围
    if (query.timeRange) {
      suggestions.push("尝试放宽时间范围，查看更多历史内容");
    }

    // 建议减少关键词
    if (query.keywords.length > 2) {
      suggestions.push("尝试减少搜索关键词，使用更通用的词汇");
    }

    // 建议取消平台过滤
    if (query.platform && query.platform !== "all") {
      suggestions.push("尝试搜索所有平台的内容");
    }

    // 建议使用更短的关键词
    if (query.keywords.some((k) => k.length > 6)) {
      suggestions.push("尝试使用更短的关键词");
    }

    // 通用建议
    if (suggestions.length === 0) {
      suggestions.push("换几个关键词试试");
      suggestions.push("看看全部收藏");
    }

    return suggestions;
  }

  /**
   * 生成跟进建议（有结果时的下一步引导）
   */
  private generateFollowUpSuggestions(
    results: SearchResultItem[],
    query: ParsedQuery,
  ): FollowUpSuggestion[] {
    const suggestions: FollowUpSuggestion[] = [];

    // 基础建议：查看详情
    if (results.length > 0) {
      suggestions.push({
        label: "看详情",
        type: "view_detail",
        payload: { bookmarkId: results[0].id },
      });
    }

    // 如果结果较多，建议筛选
    if (results.length >= 5) {
      suggestions.push({
        label: "筛选",
        type: "filter",
      });
    }

    // 如果没有时间筛选，建议添加
    if (!query.timeRange) {
      suggestions.push({
        label: "继续找",
        type: "continue_search",
      });
    }

    // 如果结果较多，建议整理
    if (results.length >= 10) {
      suggestions.push({
        label: "整理",
        type: "organize",
        payload: { bookmarkIds: results.map((r) => r.id) },
      });
    }

    return suggestions.slice(0, 3); // 最多返回 3 个建议
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建 ResponseFormatter 实例
 */
export function createResponseFormatter(
  config?: ResponseFormatterConfig,
): ResponseFormatter {
  return new ResponseFormatter(config);
}

// ============================================
// 便捷方法
// ============================================

/**
 * 快速格式化搜索响应（使用默认配置）
 */
export function formatSearchResponse(
  rankedResults: RankedResult[],
  bookmarks: Map<number, BookmarkData>,
  query: ParsedQuery,
  queryTimeMs: number,
): FormattedSearchResponse {
  const formatter = new ResponseFormatter();
  return formatter.format(rankedResults, bookmarks, query, queryTimeMs);
}
