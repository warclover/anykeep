/**
 * AI Actions 类型定义
 *
 * AI Actions 是 AI 与现有功能交互的统一接口层
 * 包括读取操作（查询数据）和写入操作（修改数据）
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

// ============================================
// Action 类型定义
// ============================================

/**
 * AI 可执行的读取操作
 */
export type AIReadActionType =
  | "bookmark:search" // 搜索书签
  | "bookmark:get" // 获取单个书签
  | "bookmark:list" // 获取书签列表
  | "bookmark:related" // 获取相关书签
  | "folder:list" // 获取文件夹列表
  | "folder:get" // 获取文件夹详情
  | "folder:bookmarks" // 获取文件夹下的书签
  | "tag:list" // 获取标签列表
  | "tag:bookmarks" // 获取标签下的书签
  | "user:preferences" // 获取用户偏好
  | "user:stats"; // 获取用户统计

/**
 * AI 可执行的写入操作
 */
export type AIWriteActionType =
  | "bookmark:create" // 创建书签
  | "bookmark:update" // 更新书签
  | "bookmark:move" // 移动书签到文件夹
  | "bookmark:delete" // 删除书签
  | "bookmark:restore" // 恢复书签
  | "bookmark:rate" // 评分书签
  | "folder:create" // 创建文件夹
  | "folder:update" // 更新文件夹
  | "folder:delete" // 删除文件夹
  | "tag:add" // 添加标签
  | "tag:remove" // 移除标签
  | "tag:batch_add" // 批量添加标签
  | "tag:batch_remove"; // 批量移除标签

/**
 * 所有 AI Action 类型
 */
export type AIActionType = AIReadActionType | AIWriteActionType;

// ============================================
// Action 参数定义
// ============================================

/**
 * 书签搜索参数
 */
export interface BookmarkSearchParams {
  query: string;
  limit?: number;
  offset?: number;
  folderId?: number;
  tags?: string[];
  platform?: string;
  sortBy?: "relevance" | "created_at" | "title";
  sortOrder?: "asc" | "desc";
}

/**
 * 书签列表参数
 */
export interface BookmarkListParams {
  folderId?: number;
  tags?: string[];
  platform?: string;
  limit?: number;
  offset?: number;
  sortBy?: "created_at" | "updated_at" | "title" | "rating";
  sortOrder?: "asc" | "desc";
}

/**
 * 书签更新参数
 */
export interface BookmarkUpdateParams {
  id: number;
  title?: string;
  description?: string;
  tags?: string[];
  folderId?: number;
  rating?: number;
  isStarred?: boolean;
}

/**
 * 书签移动参数
 */
export interface BookmarkMoveParams {
  bookmarkIds: number[];
  targetFolderId: number;
}

/**
 * 标签批量操作参数
 */
export interface TagBatchParams {
  bookmarkIds: number[];
  tags: string[];
}

/**
 * 文件夹创建参数
 */
export interface FolderCreateParams {
  name: string;
  parentId?: number;
  description?: string;
}

/**
 * Action 参数映射
 */
export interface AIActionParamsMap {
  "bookmark:search": BookmarkSearchParams;
  "bookmark:get": { id: number };
  "bookmark:list": BookmarkListParams;
  "bookmark:related": { bookmarkId: number; limit?: number };
  "bookmark:create": {
    url: string;
    title?: string;
    description?: string;
    folderId?: number;
    tags?: string[];
  };
  "bookmark:update": BookmarkUpdateParams;
  "bookmark:move": BookmarkMoveParams;
  "bookmark:delete": { bookmarkIds: number[] };
  "bookmark:restore": { bookmarkIds: number[] };
  "bookmark:rate": { bookmarkId: number; rating: number };
  "folder:list": { parentId?: number };
  "folder:get": { id: number };
  "folder:bookmarks": { folderId: number; limit?: number };
  "folder:create": FolderCreateParams;
  "folder:update": { id: number; name?: string; parentId?: number };
  "folder:delete": { id: number };
  "tag:list": { limit?: number };
  "tag:bookmarks": { tag: string; limit?: number };
  "tag:add": { bookmarkId: number; tags: string[] };
  "tag:remove": { bookmarkId: number; tags: string[] };
  "tag:batch_add": TagBatchParams;
  "tag:batch_remove": TagBatchParams;
  "user:preferences": Record<string, never>;
  "user:stats": { days?: number };
}

// ============================================
// Action 请求和结果
// ============================================

/**
 * AI 操作请求
 */
export interface AIActionRequest<T extends AIActionType = AIActionType> {
  /** 操作类型 */
  type: T;
  /** 操作参数 */
  params: T extends keyof AIActionParamsMap
    ? AIActionParamsMap[T]
    : Record<string, unknown>;
  /** 是否需要用户确认 */
  requiresConfirmation?: boolean;
  /** 操作说明（给用户看的） */
  description?: string;
  /** 追踪 ID */
  traceId?: string;
}

/**
 * 确认信息
 */
export interface ConfirmationInfo {
  /** 确认消息 */
  message: string;
  /** 将要执行的操作描述 */
  actions: string[];
  /** 影响的资源数量 */
  affectedCount?: number;
  /** 是否可撤销 */
  reversible?: boolean;
}

/**
 * AI 操作成功结果
 */
export interface AIActionSuccessResult<T = unknown> {
  success: true;
  data: T;
  /** 影响的资源 ID 列表 */
  affectedIds?: number[];
  /** 操作摘要（供 AI 使用） */
  summary: string;
}

/**
 * AI 操作需要确认的结果
 */
export interface AIActionConfirmationResult {
  success: false;
  needsConfirmation: true;
  confirmation: ConfirmationInfo;
}

/**
 * AI 操作失败结果
 */
export interface AIActionErrorResult {
  success: false;
  needsConfirmation?: false;
  error: string;
  errorCode?: string;
}

/**
 * AI 操作结果（联合类型）
 */
export type AIActionResult<T = unknown> =
  | AIActionSuccessResult<T>
  | AIActionConfirmationResult
  | AIActionErrorResult;

// ============================================
// 数据类型定义（简化版）
// ============================================

/**
 * 书签简要信息（用于 AI 返回）
 */
export interface BookmarkBrief {
  id: number;
  title: string;
  url: string;
  description?: string;
  tags: string[];
  folderName?: string;
  platform: string;
  rating?: number;
  createdAt: string;
}

/**
 * 文件夹简要信息
 */
export interface FolderBrief {
  id: number;
  name: string;
  parentId?: number;
  bookmarkCount: number;
  path: string;
}

/**
 * 标签简要信息
 */
export interface TagBrief {
  name: string;
  count: number;
}

/**
 * 用户统计信息
 */
export interface UserStatsBrief {
  totalBookmarks: number;
  totalFolders: number;
  totalTags: number;
  recentActivity: {
    addedLast7Days: number;
    addedLast30Days: number;
  };
}

// ============================================
// UI 相关类型
// ============================================

/**
 * UI 操作
 */
export interface UIAction {
  /** 操作 ID */
  id: string;
  /** 操作标签 */
  label: string;
  /** 操作类型 */
  type: "primary" | "secondary" | "danger";
  /** 对应的 AI Action */
  action?: AIActionRequest;
}

/**
 * AI 操作输出（包含 UI 提示）
 */
export interface AIOperationOutput<T = unknown> {
  /** 操作类型 */
  operation: "search" | "classify" | "summarize" | "organize" | "info";
  /** 结果摘要（供 AI 生成文字描述） */
  summary: {
    action: string;
    details: string[];
  };
  /** 结构化数据（供 UI 渲染） */
  data: T;
  /** UI 提示 */
  ui: {
    showAs: "list" | "card" | "toast" | "modal" | "inline";
    actions?: UIAction[];
  };
}

// ============================================
// 辅助类型
// ============================================

/**
 * 判断是否为写入操作
 */
export function isWriteAction(type: AIActionType): type is AIWriteActionType {
  const writeActions: AIWriteActionType[] = [
    "bookmark:create",
    "bookmark:update",
    "bookmark:move",
    "bookmark:delete",
    "bookmark:restore",
    "bookmark:rate",
    "folder:create",
    "folder:update",
    "folder:delete",
    "tag:add",
    "tag:remove",
    "tag:batch_add",
    "tag:batch_remove",
  ];
  return writeActions.includes(type as AIWriteActionType);
}

/**
 * 获取操作的默认确认需求
 */
export function getDefaultConfirmationRequirement(type: AIActionType): boolean {
  // 删除操作需要确认
  if (type.includes("delete")) return true;
  // 批量操作需要确认
  if (type.includes("batch")) return true;
  // 其他写入操作不需要确认
  return false;
}

/**
 * 获取操作的中文描述
 */
export function getActionDescription(type: AIActionType): string {
  const descriptions: Record<AIActionType, string> = {
    "bookmark:search": "搜索书签",
    "bookmark:get": "获取书签详情",
    "bookmark:list": "获取书签列表",
    "bookmark:related": "获取相关书签",
    "bookmark:create": "创建书签",
    "bookmark:update": "更新书签",
    "bookmark:move": "移动书签",
    "bookmark:delete": "删除书签",
    "bookmark:restore": "恢复书签",
    "bookmark:rate": "评分书签",
    "folder:list": "获取文件夹列表",
    "folder:get": "获取文件夹详情",
    "folder:bookmarks": "获取文件夹下的书签",
    "folder:create": "创建文件夹",
    "folder:update": "更新文件夹",
    "folder:delete": "删除文件夹",
    "tag:list": "获取标签列表",
    "tag:bookmarks": "获取标签下的书签",
    "tag:add": "添加标签",
    "tag:remove": "移除标签",
    "tag:batch_add": "批量添加标签",
    "tag:batch_remove": "批量移除标签",
    "user:preferences": "获取用户偏好",
    "user:stats": "获取用户统计",
  };
  return descriptions[type] || type;
}
