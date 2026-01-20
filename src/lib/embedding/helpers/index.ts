/**
 * Embedding 辅助模块导出
 *
 * @module embedding/helpers
 * @version 1.1.0 - 添加速率限制器
 * @since 2025-12-25
 */

export {
  classifyEmbeddingError,
  type EmbeddingErrorType,
  type ClassifiedError,
} from "./error-classification";

export { runWithConcurrency } from "./concurrency";
export { RateLimiter } from "./rate-limiter";
