/**
 * Embedding Module
 * V4.2 多向量表征系统
 *
 * @description
 * 提供多维度向量生成和搜索能力：
 * - 标题向量（快速路径）
 * - 内容向量（深度语义）
 * - 标签向量（标签语义）
 */

export {
  MultiVectorEmbeddingService,
  createMultiVectorEmbeddingService,
} from "./multi-vector-embedding.service";

export type {
  MultiVectorResult,
  BookmarkMultiVector,
  BatchUpdateResult,
  MultiVectorConfig,
} from "./multi-vector-embedding.service";

// Re-export existing embedding utilities
export {
  generateEmbedding,
  generateEmbeddingForUser,
  generateEmbeddingsBatch,
  generateEmbeddingsBatchForUser,
  buildEmbeddingText,
  isValidEmbedding,
  getEmbeddingDimensions,
} from "@/lib/utils/embedding-generator";

export type {
  EmbeddingConfig,
  EmbeddingOptionsExtended,
  EmbeddingModelId,
  EmbeddingModelConfig,
} from "@/lib/utils/embedding-generator";

// Re-export dimension constant for database migrations
export { EMBEDDING_DIMENSION } from "@/lib/classification/config/embedding-config";
