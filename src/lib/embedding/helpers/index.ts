/**
 * Embedding 辅助模块导出
 *
 * @module embedding/helpers
 * @version 1.0.0
 * @since 2025-12-25
 */

export {
  classifyEmbeddingError,
  type EmbeddingErrorType,
  type ClassifiedError,
} from "./error-classification";

export { runWithConcurrency } from "./concurrency";
