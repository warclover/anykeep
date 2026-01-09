/**
 * 搜索模块
 *
 * 提供查询解析、结果排序、响应格式化等搜索增强功能
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

// 类型导出
export type {
  // 查询解析类型
  TimeRange,
  PlatformType,
  FuzzyLevel,
  SearchIntentType,
  ParsedQuery,
  // 排序因子类型
  MatchType,
  MatchResult,
  RankingFactors,
  RelevanceLevel,
  RankedResult,
  // 响应格式化类型
  SearchResultMeta,
  SearchResultItem,
  FormattedSearchResponse,
  FollowUpSuggestion,
  // 配置类型
  QueryParserConfig,
  ResultRankerConfig,
} from "./types";

// 常量导出
export {
  DEFAULT_QUERY_PARSER_CONFIG,
  DEFAULT_RESULT_RANKER_CONFIG,
} from "./types";

// QueryParser 导出
export { QueryParser, createQueryParser, parseQuery } from "./query-parser";

// ResultRanker 导出
export {
  ResultRanker,
  createResultRanker,
  rankResults,
  type BookmarkForRanking,
} from "./result-ranker";

// ResponseFormatter 导出
export {
  ResponseFormatter,
  createResponseFormatter,
  formatSearchResponse,
  type BookmarkData,
  type ResponseFormatterConfig,
} from "./response-formatter";

// EnhancedSearchService 导出
export {
  EnhancedSearchService,
  createEnhancedSearchService,
  enhancedSearchService,
  type EnhancedSearchInput,
  type EnhancedSearchOutput,
} from "./enhanced-search.service";

// ChineseNumberParser 导出 (v2.9.0 新增)
export {
  parseChineseNumber,
  extractQuantity,
  hasQuantityExpression,
  removeQuantityExpression,
  CHINESE_NUMBER_UTILS,
  CHINESE_NUMBER_CHARS,
  CHINESE_FUZZY_WORDS,
  type QuantityExtractionResult,
} from "./chinese-number-parser";
