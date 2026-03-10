/**
 * Infra 模块统一导出
 */

export { searchSimilarBookmarks } from "./vector-search";
export type { VectorSearchResult, VectorSearchOptions } from "./vector-search";
export { getCached, setCache, invalidateCache, clearCache } from "./cache";
export { callLlm, sanitizeInput } from "./llm";
export type { LlmRequest, LlmResponse } from "./llm";
export { getCorrectionCache, CorrectionCacheService } from "./correction-cache";
export type { CorrectionCacheConfig } from "./correction-cache";
