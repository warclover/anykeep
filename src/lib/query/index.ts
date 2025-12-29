/**
 * TanStack Query 模块导出
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

// Client
export {
  createQueryClient,
  getQueryClient,
  QUERY_STALE_TIME,
  QUERY_GC_TIME,
} from "./client";

// Provider
export { QueryProvider } from "./provider";
