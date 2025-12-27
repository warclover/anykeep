/**
 * MD 收藏功能 - 类型定义
 * P2-007: Markdown 内容收藏
 */

// 导出阅读器增强类型
export * from "./reader";

/**
 * MD 收藏记录（数据库实体）
 */
export interface MdCollection {
  id: number;
  user_id: string;
  title: string;
  raw_content: string;
  content_hash: string;
  word_count: number;
  code_block_count: number;
  reading_time_minutes: number;
  ai_summary: string | null;
  ai_tags: string[] | null;
  content_type: MdContentType | null;
  content_type_confidence: number | null;
  embedding: number[] | null;
  embedding_version: string | null;
  folder_id: number | null;
  user_tags: string[] | null;
  notes: string | null;
  processing_status: MdProcessingStatus;

  // 来源信息
  source_type: MdSourceType | null;
  source_filename: string | null;

  // AI 处理信息
  processed_at: string | null;
  processing_error: string | null;

  // 阅读状态
  is_read: boolean;
  is_starred: boolean;
  read_at: string | null;
  starred_at: string | null;

  // 时间戳
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * MD 收藏来源类型
 */
export type MdSourceType = "upload" | "paste" | "api";

/**
 * 创建 MD 收藏请求
 */
export interface MdCollectionCreateRequest {
  rawContent: string;
  title?: string;
  folderId?: number;
  userTags?: string[];
  notes?: string;
  contentType?: MdContentType;
}

/**
 * 创建 MD 收藏响应
 */
export interface MdCollectionCreateResponse {
  success: true;
  data: {
    id: number;
    title: string;
    wordCount: number;
    codeBlockCount: number;
    readingTimeMinutes: number;
    processingStatus: MdProcessingStatus;
    createdAt: string;
  };
}

/**
 * 更新 MD 收藏请求
 */
export interface MdCollectionUpdateRequest {
  title?: string;
  folderId?: number | null;
  userTags?: string[];
  notes?: string;
}

/**
 * MD 收藏列表查询参数
 */
export interface MdCollectionListParams {
  page?: number;
  limit?: number;
  folderId?: number;
  search?: string;
  keyword?: string;
  tags?: string[];
  sort?: MdCollectionSortType;
  contentType?: MdContentType;
  isRead?: boolean;
  isStarred?: boolean;
}

/**
 * MD 收藏列表响应
 */
export interface MdCollectionListResponse {
  success: true;
  data: MdCollection[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 上传 MD 文件请求
 */
export interface MdUploadRequest {
  file: File;
  title?: string;
  folderId?: number;
  userTags?: string[];
}

/**
 * 去重检测请求
 */
export interface MdCheckDuplicateRequest {
  content: string;
}

/**
 * 去重检测响应
 */
export interface MdCheckDuplicateResponse {
  success: true;
  isDuplicate: boolean;
  existingId?: number;
  existingTitle?: string;
}

/**
 * 语义搜索请求
 */
export interface MdSemanticSearchRequest {
  query: string;
  limit?: number;
  threshold?: number;
}

/**
 * 语义搜索响应
 */
export interface MdSemanticSearchResponse {
  success: true;
  data: Array<{
    id: number;
    title: string;
    snippet: string;
    similarity: number;
  }>;
}

/**
 * MD 内容处理状态
 */
export type MdProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

/**
 * MD 内容类型
 * 支持大写（AI 分类返回）和小写（用户选择）两种格式
 */
export type MdContentType =
  // AI 分类返回（大写）
  | "TUTORIAL"
  | "CODE_SNIPPET"
  | "ANALYSIS"
  | "SUMMARY"
  | "QA"
  | "DOCUMENTATION"
  | "OTHER"
  // 用户选择（小写）
  | "article"
  | "tutorial"
  | "code"
  | "note"
  | "documentation";

/**
 * MD 收藏排序类型
 */
export type MdCollectionSortType =
  | "created_desc"
  | "created_asc"
  | "title_asc"
  | "title_desc"
  | "updated_desc";

/**
 * MD 内容预处理结果
 */
export interface MdPreprocessResult {
  processedText: string;
  metadata: {
    wordCount: number;
    codeBlockCount: number;
    readingTimeMinutes: number;
    extractedTitle: string | null;
  };
}

/**
 * 视图模式
 */
export type MdViewMode = "list" | "card";

/**
 * 内容类型配置
 */
export interface ContentTypeConfig {
  label: string;
  color: string;
  icon?: string;
}

/**
 * 功能门控检查结果
 */
export interface FeatureGateResult {
  allowed: boolean;
  reason?: string;
}
