/**
 * Contracts Export
 *
 * DTO 与契约模块导出
 *
 * @module contracts
 */

// ============== Schemas ==============

// Bookmark Schemas
export {
  BookmarkIdSchema,
  CreateBookmarkSchema,
  UpdateBookmarkSchema,
  BookmarkQuerySchema,
  BatchBookmarkIdsSchema,
  BatchMoveSchema,
  BatchAddTagsSchema,
  BatchRemoveTagsSchema,
  type CreateBookmarkInput,
  type UpdateBookmarkInput,
  type BookmarkQueryInput,
  type BatchBookmarkIdsInput,
  type BatchMoveInput,
  type BatchAddTagsInput,
  type BatchRemoveTagsInput,
} from "./schemas/bookmark.schema";

// Folder Schemas
export {
  FolderIdSchema,
  CreateFolderSchema,
  UpdateFolderSchema,
  MoveFolderSchema,
  BatchSortFoldersSchema,
  type CreateFolderInput,
  type UpdateFolderInput,
  type MoveFolderInput,
  type BatchSortFoldersInput,
} from "./schemas/folder.schema";

// Ingestion Schemas
export {
  IngestionSourceSchema,
  IngestionRequestSchema,
  BatchIngestionRequestSchema,
  IngestionStatusSchema,
  type IngestionSource,
  type IngestionRequestInput,
  type BatchIngestionRequestInput,
  type IngestionStatus,
} from "./schemas/ingestion.schema";

// Search Schemas
export {
  SearchTypeSchema,
  SearchRequestSchema,
  type SearchType,
  type SearchRequestInput,
} from "./schemas/search.schema";

// ============== Responses ==============

// Bookmark Responses
export type {
  BookmarkListItemResponse,
  BookmarkDetailResponse,
  BookmarkListResponse,
  BookmarkStatsResponse,
  BatchOperationResponse,
  UserTagsResponse,
} from "./responses/bookmark.response";

// Folder Responses
export type {
  FolderResponse,
  FolderWithCountResponse,
  FolderTreeNodeResponse,
  FolderListResponse,
  FolderTreeResponse,
  FolderPathResponse,
} from "./responses/folder.response";
