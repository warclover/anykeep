/**
 * 智能分类 v5.0 - Embedding Service 类型定义
 */

/**
 * Embedding 配置
 */
export interface EmbeddingConfig {
  /** OpenAI API Key */
  apiKey: string;
  /** 模型名称 */
  model: string;
  /** 向量维度 */
  dimensions: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试延迟（毫秒） */
  retryDelays: number[];
}

/**
 * Embedding 结果
 */
export interface EmbeddingResult {
  /** 向量数据 */
  embedding: number[];
  /** Token 使用量 */
  tokens: number;
  /** 模型名称 */
  model: string;
}

/**
 * Embedding 服务接口
 *
 * 定义 EmbeddingService 和 DashScopeEmbeddingAdapter 的公共接口
 * 用于依赖注入和类型兼容
 */
export interface IEmbeddingService {
  /**
   * 生成单个文本的 Embedding 向量
   */
  generateEmbedding(text: string): Promise<EmbeddingResult>;

  /**
   * 批量生成 Embedding（可选）
   */
  generateBatchEmbeddings?(texts: string[]): Promise<EmbeddingResult[]>;
}

/**
 * Embedding 错误类型
 */
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}
