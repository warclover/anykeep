/**
 * 查询改写模块
 *
 * @module ai-agent/query
 * @version 1.0.0
 * @since 2025-12-28
 */

export { QueryRewriter, getQueryRewriter } from "./query-rewriter";
export type {
  QueryRewriteResult,
  QueryRewriterConfig,
  UserContext,
} from "./types";
export { DEFAULT_QUERY_REWRITER_CONFIG } from "./types";
