/**
 * Snapshot Module Types
 *
 * 网页快照模块类型定义 - 独立模块，不依赖 classification 模块
 *
 * 设计原则：
 * - 类型完全独立于现有模块
 * - 与数据库 schema 保持一致 (snake_case)
 * - 业务层使用 camelCase 接口
 */

// ============================================================================
// 基础枚举类型
// ============================================================================

/**
 * 快照类型
 */
export type SnapshotType = "basic" | "standard" | "full";

/**
 * 快照状态
 */
export type SnapshotStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "expired";

/**
 * 快照任务类型 (job_queue.type 扩展)
 */
export type SnapshotJobType =
  | "create_snapshot_basic"
  | "create_snapshot_standard"
  | "create_snapshot_full"
  | "retry_failed_snapshot"
  | "cleanup_expired_snapshots";

// ============================================================================
// 数据库行类型 (snake_case, 与数据库一致)
// ============================================================================

/**
 * bookmark_snapshots 表行类型
 */
export interface BookmarkSnapshotRow {
  id: number;
  bookmark_id: number;
  user_id: string;

  // 快照类型与状态
  snapshot_type: SnapshotType;
  status: SnapshotStatus;
  error_message: string | null;
  retry_count: number;
  max_retries: number;

  // 存储信息
  storage_bucket: string;
  storage_path: string | null;
  file_size: number | null;
  content_hash: string | null;

  // Layer 1: 基础快照内容
  readable_title: string | null;
  readable_content: string | null;
  readable_text_content: string | null;
  readable_excerpt: string | null;
  readable_byline: string | null;
  readable_word_count: number | null;

  // Layer 2+: 高级快照路径
  html_storage_path: string | null;
  screenshot_storage_path: string | null;
  screenshot_width: number | null;
  screenshot_height: number | null;
  mhtml_storage_path: string | null;

  // 元数据
  original_url: string;
  final_url: string | null;
  captured_at: string | null;

  // 时间管理
  created_at: string;
  updated_at: string;
  expires_at: string | null;

  // 关联任务
  job_id: string | null;
}

/**
 * 快照触发来源 (P2-010)
 */
export type SnapshotTriggerSource =
  | "manual" // 手动创建
  | "auto-tag" // 标签自动触发
  | "batch" // 批量创建
  | "scheduled" // 定时任务
  | "api"; // API 调用

/**
 * bookmark_snapshots 插入类型
 */
export interface BookmarkSnapshotInsert {
  bookmark_id: number;
  user_id: string;
  snapshot_type?: SnapshotType;
  status?: SnapshotStatus;
  original_url: string;
  expires_at?: string;
  job_id?: string;
  // P2-010: 触发来源
  trigger_source?: SnapshotTriggerSource;
  trigger_tag?: string;
}

/**
 * bookmark_snapshots 更新类型
 */
export interface BookmarkSnapshotUpdate {
  status?: SnapshotStatus;
  error_message?: string | null;
  retry_count?: number;

  // 存储信息
  storage_path?: string;
  file_size?: number;
  content_hash?: string;

  // Layer 1 内容
  readable_title?: string;
  readable_content?: string;
  readable_text_content?: string;
  readable_excerpt?: string;
  readable_byline?: string;
  readable_word_count?: number;

  // Layer 2+ 路径
  html_storage_path?: string;
  screenshot_storage_path?: string;
  screenshot_width?: number;
  screenshot_height?: number;
  mhtml_storage_path?: string;

  // 元数据
  final_url?: string;
  captured_at?: string;
}

// ============================================================================
// 任务队列载荷类型
// ============================================================================

/**
 * 快照任务载荷
 */
export interface SnapshotJobPayload {
  bookmark_id: number;
  snapshot_id: number;
  url: string;
  snapshot_type: SnapshotType;
  user_id: string;
  retry_count?: number;
  priority?: "low" | "normal" | "high";
}

/**
 * 清理任务载荷
 */
export interface CleanupSnapshotJobPayload {
  days_old?: number;
  batch_size?: number;
}

// ============================================================================
// API 请求/响应类型 (camelCase, 前端使用)
// ============================================================================

/**
 * 创建快照请求
 */
export interface CreateSnapshotRequest {
  bookmarkId: number;
  snapshotType?: SnapshotType;
  priority?: "low" | "normal" | "high";
  // P2-010: 触发来源
  source?: SnapshotTriggerSource;
  triggerTag?: string;
}

/**
 * 创建快照响应
 */
export interface CreateSnapshotResponse {
  success: boolean;
  data?: {
    snapshotId: number;
    jobId: string;
    status: "pending";
    estimatedWaitTime: number;
  };
  error?: {
    code:
      | "QUOTA_EXCEEDED"
      | "ALREADY_EXISTS"
      | "BOOKMARK_NOT_FOUND"
      | "INVALID_TYPE"
      | "INTERNAL_ERROR";
    message: string;
  };
}

/**
 * 快照详情响应
 */
export interface SnapshotDetailResponse {
  success: boolean;
  data?: {
    id: number;
    bookmarkId: number;
    snapshotType: SnapshotType;
    status: SnapshotStatus;

    // 基础信息 (completed 状态)
    readableTitle?: string;
    readableExcerpt?: string;
    readableWordCount?: number;
    readableByline?: string;

    // 存储信息
    fileSize?: number;
    capturedAt?: string;

    // 高级快照 URL (signed URL)
    htmlUrl?: string;
    screenshotUrl?: string;

    // 错误信息 (failed 状态)
    errorMessage?: string;
    retryCount?: number;

    // 时间信息
    createdAt: string;
    updatedAt: string;
    expiresAt?: string;
  };
  error?: {
    code: "NOT_FOUND" | "EXPIRED" | "INTERNAL_ERROR";
    message: string;
  };
}

/**
 * 快照内容响应
 */
export interface SnapshotContentResponse {
  success: boolean;
  data?: {
    readableTitle: string;
    readableContent: string;
    readableTextContent: string;
    readableByline?: string;
    readableWordCount: number;
    /** 快照类型 (basic | standard | full) */
    snapshotType?: string;
    /** 截图 URL（Full 快照） */
    screenshotUrl?: string;
    /** 完整 HTML URL（Standard/Full 快照） */
    htmlUrl?: string;
    /** 快照时间 */
    capturedAt?: string;
    /** 最终 URL（重定向后） */
    finalUrl?: string;
  };
  error?: {
    code: "NOT_FOUND" | "NOT_COMPLETED" | "INTERNAL_ERROR";
    message: string;
  };
}

/**
 * 配额信息
 */
export interface SnapshotQuota {
  usedBytes: number;
  quotaBytes: number;
  usedCount: number;
  maxCount: number;
  membership: string;
  usedPercentage: number;
  canCreate: boolean;
  /** V4.2.1: 允许的快照类型（基于会员等级） */
  allowedTypes: SnapshotType[];
  /** V4.2.1: 过期天数（null 表示永久） */
  expirationDays: number | null;
}

/**
 * 配额响应
 */
export interface SnapshotQuotaResponse {
  success: boolean;
  data?: SnapshotQuota;
  error?: {
    code: "INTERNAL_ERROR";
    message: string;
  };
}

/**
 * 批量创建请求
 */
export interface BatchCreateSnapshotRequest {
  bookmarkIds: number[];
  snapshotType?: SnapshotType;
}

/**
 * 批量创建响应
 */
export interface BatchCreateSnapshotResponse {
  success: boolean;
  data?: {
    created: number;
    skipped: number;
    failed: number;
    details: Array<{
      bookmarkId: number;
      snapshotId?: number;
      jobId?: string;
      error?: string;
    }>;
  };
  error?: {
    code: "QUOTA_EXCEEDED" | "INTERNAL_ERROR";
    message: string;
  };
}

// ============================================================================
// 业务层类型 (camelCase)
// ============================================================================

/**
 * 快照摘要 (列表展示用)
 */
export interface SnapshotSummary {
  id: number;
  bookmarkId: number;
  snapshotType: SnapshotType;
  status: SnapshotStatus;
  readableTitle?: string;
  readableExcerpt?: string;
  capturedAt?: string;
  hasScreenshot: boolean;
}

/**
 * Readability 提取结果
 */
export interface ReadabilityResult {
  title: string;
  content: string;
  textContent: string;
  length: number;
  excerpt: string;
  byline: string | null;
  dir: string | null;
  siteName: string | null;
  lang: string | null;
}

/**
 * 快照处理结果
 */
export interface SnapshotProcessResult {
  success: boolean;
  snapshotId: number;
  readability?: ReadabilityResult;
  contentHash?: string;
  fileSize?: number;
  finalUrl?: string;
  htmlPath?: string;
  screenshotPath?: string;
  error?: string;
}

// ============================================================================
// 工具类型
// ============================================================================

/**
 * 优先级映射
 */
export const SNAPSHOT_PRIORITY_MAP: Record<"low" | "normal" | "high", number> =
  {
    low: -1,
    normal: 0,
    high: 1,
  };

/**
 * 任务类型到快照类型映射
 */
export const JOB_TYPE_TO_SNAPSHOT_TYPE: Record<
  Exclude<
    SnapshotJobType,
    "retry_failed_snapshot" | "cleanup_expired_snapshots"
  >,
  SnapshotType
> = {
  create_snapshot_basic: "basic",
  create_snapshot_standard: "standard",
  create_snapshot_full: "full",
};

/**
 * 快照类型到任务类型映射
 */
export const SNAPSHOT_TYPE_TO_JOB_TYPE: Record<SnapshotType, SnapshotJobType> =
  {
    basic: "create_snapshot_basic",
    standard: "create_snapshot_standard",
    full: "create_snapshot_full",
  };

/**
 * 配额常量
 */
export const SNAPSHOT_QUOTA = {
  FREE: {
    maxStorageBytes: 52428800, // 50MB
    maxCount: 100,
    expirationDays: 30,
  },
  PRO: {
    maxStorageBytes: 524288000, // 500MB
    maxCount: 1000,
    expirationDays: null, // 永久
  },
} as const;

/**
 * 会员等级类型
 */
export type MembershipType = keyof typeof SNAPSHOT_QUOTA;
