/**
 * MD 收藏功能 - 模块入口
 * P2-007: Markdown 内容收藏
 *
 * 该模块完全独立于 bookmarks 模块，实现完全解耦
 */

// ============================================
// 类型导出
// ============================================
export type {
  MdCollection,
  MdCollectionCreateRequest,
  MdCollectionCreateResponse,
  MdCollectionUpdateRequest,
  MdCollectionListParams,
  MdCollectionListResponse,
  MdUploadRequest,
  MdCheckDuplicateRequest,
  MdCheckDuplicateResponse,
  MdSemanticSearchRequest,
  MdSemanticSearchResponse,
  MdProcessingStatus,
  MdContentType,
  MdSourceType,
  MdCollectionSortType,
  MdPreprocessResult,
  MdViewMode,
  ContentTypeConfig,
  FeatureGateResult,
} from "./types";

// ============================================
// 常量导出
// ============================================
export {
  MD_COLLECTION_LIMITS,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  READER_CONFIG,
  CONTENT_TYPE_CONFIG,
  DEFAULT_CONTENT_TYPE_CONFIG,
  PROCESSING_STATUS_CONFIG,
  PAGINATION_DEFAULTS,
  STORAGE_KEYS,
} from "./constants";

// ============================================
// 功能门控导出
// ============================================
export {
  isMdFeatureEnabled,
  getMdFeatureLimit,
  canCreateMdCollection,
  getFeatureUnavailableMessage,
  shouldShowUpgradePrompt,
} from "./lib";

// ============================================
// Hooks 导出
// ============================================
export {
  useMdCollections,
  useMdCollection,
  useMdCollectionsSWR,
  useCreateMdCollection,
  useUpdateMdCollection,
  useDeleteMdCollection,
  useUploadMdFile,
  useCheckDuplicate,
  useTriggerAIProcess,
  useMdViewPreference,
  useMdProcessingPoller,
} from "./hooks";
export type { MdCacheSnapshot } from "./hooks";

// ============================================
// 组件导出
// 注意：MdRenderer 和 MdReaderView 需要直接从 ./components 导入
// 以避免在列表页引起 SSR 问题（react-syntax-highlighter）
// ============================================
export { MdCardItem, MdListItem, MdViewToggle } from "./components";
export type { MdListItemProps } from "./components";
