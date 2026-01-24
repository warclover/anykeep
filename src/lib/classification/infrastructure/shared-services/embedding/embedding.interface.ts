/**
 * 统一的 Embedding 服务接口
 * V5.0 类型安全改进
 *
 * @module classification/v5/shared/embedding
 * @version 1.1.0 - 支持 EmbeddingResult 返回类型
 * @since 2026-01-20
 */

/**
 * Embedding 结果类型
 */
export interface IEmbeddingResult {
  embedding: number[];
  tokens?: number;
  model?: string;
}

/**
 * Embedding 服务统一接口
 * 所有 Embedding 适配器都必须实现此接口
 */
export interface IEmbeddingService {
  /**
   * 生成单个文本的向量嵌入
   * @param text 输入文本
   * @returns Embedding 结果（包含向量、tokens、模型信息）
   */
  generateEmbedding(text: string): Promise<IEmbeddingResult>;

  /**
   * 批量生成向量嵌入
   * @param texts 文本数组
   * @returns Embedding 结果数组
   */
  generateBatchEmbeddings(texts: string[]): Promise<IEmbeddingResult[]>;
}

/**
 * Embedding 服务配置接口
 */
export interface IEmbeddingServiceConfig {
  /**
   * API Key（可选，某些服务可能从环境变量读取）
   */
  apiKey?: string;

  /**
   * 模型名称（可选，使用默认模型）
   */
  model?: string;

  /**
   * 最大重试次数
   */
  maxRetries?: number;

  /**
   * 请求超时时间（毫秒）
   */
  timeout?: number;
}
