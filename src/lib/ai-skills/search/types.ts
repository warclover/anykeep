/**
 * 搜索模块类型定义
 *
 * 定义查询解析、排序因子等核心类型
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

// ============================================
// 查询解析类型
// ============================================

/**
 * 时间范围
 */
export interface TimeRange {
  /** 开始时间 */
  start: Date;
  /** 结束时间 */
  end: Date;
  /** 原始表达式 */
  original: string;
}

/**
 * 平台类型
 */
export type PlatformType =
  | "wechat" // 微信公众号
  | "bilibili" // B站
  | "xiaohongshu" // 小红书
  | "zhihu" // 知乎
  | "juejin" // 掘金
  | "csdn" // CSDN
  | "browser" // 浏览器书签
  | "all"; // 全部

/**
 * 模糊程度
 */
export type FuzzyLevel =
  | "exact" // 精确匹配
  | "phrase" // 短语匹配
  | "fuzzy"; // 模糊匹配

/**
 * 搜索意图类型
 */
export type SearchIntentType =
  | "find_specific" // 找特定内容（"那篇讲AI的"）
  | "browse" // 浏览类（"看看有什么"）
  | "filter" // 过滤类（"微信的文章"）
  | "recall"; // 回忆类（"之前收藏的"）

/**
 * 解析后的查询
 */
export interface ParsedQuery {
  /** 原始查询 */
  original: string;
  /** 提取的关键词 */
  keywords: string[];
  /** 时间范围（可选） */
  timeRange?: TimeRange;
  /** 平台过滤（可选） */
  platform?: PlatformType;
  /** 模糊程度 */
  fuzzyLevel: FuzzyLevel;
  /** 搜索意图 */
  searchIntent: SearchIntentType;
  /** 是否有指代词（需要上下文解析） */
  hasReference: boolean;
  /** 解析置信度 0-1 */
  confidence: number;
  /** 解析说明（调试用） */
  parseNotes?: string[];
}

// ============================================
// 排序因子类型
// ============================================

/**
 * 匹配类型
 */
export type MatchType =
  | "exact" // 精确匹配
  | "partial" // 部分匹配
  | "semantic"; // 语义匹配

/**
 * 单项匹配结果
 */
export interface MatchResult {
  /** 匹配类型 */
  type: MatchType;
  /** 匹配得分 0-1 */
  score: number;
  /** 匹配位置（如果适用） */
  positions?: number[];
}

/**
 * 排序因子
 */
export interface RankingFactors {
  /** 标题匹配 (权重 40%) */
  titleMatch: MatchResult;
  /** 内容匹配 (权重 25%) */
  contentMatch: MatchResult;
  /** 时间相关性 (权重 15%) */
  timeRelevance: number;
  /** 用户行为分数 (权重 10%) */
  userBehavior: number;
  /** 质量信号 (权重 10%) */
  qualitySignal: number;
}

/**
 * 相关度等级
 */
export type RelevanceLevel = "high" | "medium" | "low";

/**
 * 排序后的搜索结果
 */
export interface RankedResult {
  /** 书签 ID */
  bookmarkId: number;
  /** 综合得分 0-100 */
  score: number;
  /** 相关度等级 */
  relevance: RelevanceLevel;
  /** 排序因子（调试用） */
  factors?: RankingFactors;
}

// ============================================
// 响应格式化类型
// ============================================

/**
 * 搜索结果元数据
 */
export interface SearchResultMeta {
  /** 总结果数 */
  totalCount: number;
  /** 返回结果数 */
  returnedCount: number;
  /** 查询耗时 (ms) */
  queryTimeMs: number;
  /** 是否有更多结果 */
  hasMore: boolean;
  /** 解析后的查询（调试用） */
  parsedQuery?: ParsedQuery;
}

/**
 * 搜索结果项（用于前端展示）
 */
export interface SearchResultItem {
  /** 书签 ID */
  id: number;
  /** 标题 */
  title: string;
  /** URL */
  url: string;
  /** 摘要（高亮关键词） */
  summary?: string;
  /** 平台 */
  platform: string;
  /** 相关度等级 */
  relevance: RelevanceLevel;
  /** 创建时间 */
  createdAt: Date;
  /** 标签 */
  tags?: string[];
  /** 文件夹名称 */
  folderName?: string;
}

/**
 * 跟进建议类型
 */
export interface FollowUpSuggestion {
  /** 建议文本 */
  label: string;
  /** 建议类型 */
  type: "view_detail" | "continue_search" | "filter" | "organize" | "export";
  /** 触发动作的参数（可选） */
  payload?: Record<string, unknown>;
}

/**
 * 格式化的搜索响应
 */
export interface FormattedSearchResponse {
  /** 结果列表 */
  results: SearchResultItem[];
  /** 元数据 */
  meta: SearchResultMeta;
  /** 响应文本（用于 AI 回复） */
  responseText: string;
  /** 空结果建议（如果没有结果） */
  suggestions?: string[];
  /** 跟进建议（有结果时的下一步引导） */
  followUpSuggestions?: FollowUpSuggestion[];
}

// ============================================
// 配置类型
// ============================================

/**
 * QueryParser 配置
 */
export interface QueryParserConfig {
  /** 默认模糊级别 */
  defaultFuzzyLevel?: FuzzyLevel;
  /** 是否启用时间解析 */
  enableTimeParser?: boolean;
  /** 是否启用平台解析 */
  enablePlatformParser?: boolean;
  /** 自定义停用词 */
  customStopWords?: string[];
}

/**
 * ResultRanker 配置
 */
export interface ResultRankerConfig {
  /** 标题匹配权重 */
  titleWeight?: number;
  /** 内容匹配权重 */
  contentWeight?: number;
  /** 时间相关性权重 */
  timeWeight?: number;
  /** 用户行为权重 */
  behaviorWeight?: number;
  /** 质量信号权重 */
  qualityWeight?: number;
}

// ============================================
// 默认配置
// ============================================

/**
 * 默认 QueryParser 配置
 */
export const DEFAULT_QUERY_PARSER_CONFIG: Required<QueryParserConfig> = {
  defaultFuzzyLevel: "phrase",
  enableTimeParser: true,
  enablePlatformParser: true,
  customStopWords: [],
};

/**
 * 默认 ResultRanker 配置
 */
export const DEFAULT_RESULT_RANKER_CONFIG: Required<ResultRankerConfig> = {
  titleWeight: 0.4,
  contentWeight: 0.25,
  timeWeight: 0.15,
  behaviorWeight: 0.1,
  qualityWeight: 0.1,
};
