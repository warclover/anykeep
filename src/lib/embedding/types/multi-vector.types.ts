/**
 * 多向量嵌入服务类型定义
 *
 * @module embedding/types/multi-vector.types
 * @version 1.0.0
 * @since 2025-12-25
 */

// ============================================
// 结果类型
// ============================================

/** 多向量嵌入结果 */
export interface MultiVectorResult {
  /** 标题向量 */
  titleEmbedding: number[] | null;
  /** 内容/摘要向量 */
  contentEmbedding: number[] | null;
  /** 标签向量 */
  tagEmbedding: number[] | null;
  /** 生成耗时 (ms) */
  durationMs: number;
}

/** 书签多向量数据 */
export interface BookmarkMultiVector {
  bookmarkId: number;
  title: string;
  summary?: string | null;
  aiTags?: string[] | null;
  userTags?: string[] | null;
}

/** 批量更新结果 */
export interface BatchUpdateResult {
  /** 成功更新数量 */
  successCount: number;
  /** 失败数量 */
  failedCount: number;
  /** 跳过数量（无变化） */
  skippedCount: number;
  /** 失败的书签 ID */
  failedIds: number[];
}

// ============================================
// 配置类型
// ============================================

/** 多向量配置 */
export interface MultiVectorConfig {
  /** 是否生成标题向量 */
  generateTitle: boolean;
  /** 是否生成内容向量 */
  generateContent: boolean;
  /** 是否生成标签向量 */
  generateTag: boolean;
  /** 标题最大长度 */
  titleMaxLength: number;
  /** 内容最大长度 */
  contentMaxLength: number;
  /** 标签组合分隔符 */
  tagSeparator: string;
  /** 最小标签数（低于此值不生成标签向量） */
  minTagsForEmbedding: number;
  /** 批处理大小 */
  batchSize: number;
  /** V4.2.5: 最大并发数（防止 API 过载） */
  maxConcurrency: number;
  /** V4.2.6: 每分钟最大请求数（速率限制） */
  maxRequestsPerMinute: number;
}

/** 默认配置 */
export const DEFAULT_MULTI_VECTOR_CONFIG: MultiVectorConfig = {
  generateTitle: true,
  generateContent: true,
  generateTag: true,
  titleMaxLength: 200,
  contentMaxLength: 2000,
  tagSeparator: " | ",
  minTagsForEmbedding: 1,
  batchSize: 10,
  maxConcurrency: 3, // V4.2.5: 限制并发，避免 API 速率限制
  maxRequestsPerMinute: 60, // V4.2.6: 阿里云默认 QPM 限制
};

// ============================================
// 搜索结果类型
// ============================================

/** 标题向量搜索结果 */
export interface TitleVectorSearchResult {
  bookmarkId: number;
  title: string;
  folderId: number | null;
  folderName: string | null;
  similarity: number;
}

/** 多向量搜索结果 */
export interface MultiVectorSearchResult {
  bookmarkId: number;
  title: string;
  folderId: number | null;
  folderName: string | null;
  titleSimilarity: number;
  contentSimilarity: number;
  tagSimilarity: number;
  weightedSimilarity: number;
}

/** 搜索权重配置 */
export interface SearchWeights {
  title?: number;
  content?: number;
  tag?: number;
}
