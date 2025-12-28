/**
 * 查询改写模块类型定义
 *
 * @module ai-agent/query
 * @version 1.0.0
 * @since 2025-12-28
 */

/**
 * 用户上下文信息，用于增强查询改写
 */
export interface UserContext {
  /** 用户 ID */
  userId: string;
  /** 总收藏数量 */
  totalBookmarks: number;
  /** 常用平台列表 */
  topPlatforms: string[];
  /** 常用标签列表 */
  topTags: string[];
  /** 最近搜索关键词 */
  recentSearches?: string[];
}

/**
 * 查询改写结果
 */
export interface QueryRewriteResult {
  /** 原始查询 */
  original: string;
  /** 改写后的查询 */
  rewritten: string;
  /** 同义词/相关术语扩展 */
  synonyms: string[];
  /** 识别的用户意图 */
  intent: string;
  /** 改写置信度 (0-1) */
  confidence: number;
  /** 是否使用了缓存 */
  cached?: boolean;
  /** 处理耗时 (ms) */
  latencyMs?: number;
}

/**
 * 查询改写配置
 */
export interface QueryRewriterConfig {
  /** LLM 模型 ID */
  model: string;
  /** 最大同义词数量 */
  maxSynonyms: number;
  /** 超时时间 (ms) */
  timeoutMs: number;
  /** 是否启用缓存 */
  enableCache: boolean;
  /** 缓存 TTL (ms) */
  cacheTtlMs: number;
  /** 最小查询长度（低于此长度不改写） */
  minQueryLength: number;
}

/**
 * 默认配置
 */
export const DEFAULT_QUERY_REWRITER_CONFIG: QueryRewriterConfig = {
  model: "deepseek-chat",
  maxSynonyms: 5,
  timeoutMs: 3000,
  enableCache: true,
  cacheTtlMs: 1000 * 60 * 60, // 1 小时
  minQueryLength: 2,
};
