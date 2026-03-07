/**
 * API 工具统一导出
 * @description 客户端和服务端 API 工具
 * @version 2.0.0 - Phase 2 架构优化
 */

// ============================================================================
// API Client (Phase 2)
// ============================================================================
export { apiClient } from "./client";
export type {
  ApiResponse,
  PaginationParams,
  SortParams,
  BookmarkListParams,
  CreateBookmarkParams,
  UpdateBookmarkParams,
  BatchMoveParams,
  BatchDeleteParams,
  CreateFolderParams,
  UpdateFolderParams,
  ReorderFoldersParams,
  InitDataParams,
  UnreadCounts,
  InitData,
  ApiClient,
} from "./client";

// ============================================================================
// 客户端工具（底层）
// ============================================================================
export {
  fetchWithAuth,
  fetchJsonWithAuth,
  authFetcher,
  clearAuthCache,
} from "./fetch-with-auth";

// ============================================================================
// 服务端工具
// ============================================================================
export {
  withAuth,
  getUserId,
  unauthorizedResponse,
  type AuthResult,
} from "./auth-middleware";
