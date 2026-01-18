/**
 * 智能分类 v5.0 - VectorSearch Service 类型定义
 */

/**
 * 向量搜索配置
 */
export interface VectorSearchConfig {
  /** Supabase URL */
  supabaseUrl: string;
  /** Supabase Service Role Key */
  supabaseServiceKey: string;
  /** 默认返回结果数量 */
  defaultLimit: number;
  /** 最小相似度阈值 (0-1) */
  minSimilarity: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试延迟（毫秒） */
  retryDelays: number[];
}

/**
 * 搜索结果
 */
export interface SearchResult {
  /** 文件夹 Profile ID */
  profileId: string;
  /** 文件夹 ID */
  folderId: string;
  /** 文件夹名称 */
  folderName: string;
  /** 相似度分数 (0-1) */
  similarity: number;
  /** 匹配类型 */
  matchType: 'content' | 'behavior' | 'hybrid';
}

/**
 * 向量搜索请求
 */
export interface VectorSearchRequest {
  /** 用户 ID */
  userId: string;
  /** 内容向量 (1024 维) */
  contentEmbedding?: number[];
  /** 行为向量 (1024 维) */
  behaviorEmbedding?: number[];
  /** 混合搜索权重系数 (0-1)，0=纯内容，1=纯行为 */
  alpha?: number;
  /** 返回结果数量 */
  limit?: number;
  /** 最小相似度阈值 */
  minSimilarity?: number;
}

/**
 * 向量搜索错误类型
 */
export class VectorSearchError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'VectorSearchError';
  }
}
