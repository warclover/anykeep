/**
 * Infra 模块统一导出
 */

export { searchSimilarBookmarks } from "./vector-search";
export type { VectorSearchResult, VectorSearchOptions } from "./vector-search";
export { getCached, setCache, invalidateCache, clearCache } from "./cache";
