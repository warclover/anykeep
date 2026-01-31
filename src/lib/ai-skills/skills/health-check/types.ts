/**
 * 健康检测系统类型定义
 *
 * 统一管理失效链接、重复内容、过期内容的健康检测
 *
 * @module health-check/types
 * @version 1.0.0
 * @since 2026-01-31
 */

// ============================================
// 配置常量
// ============================================

export const HEALTH_CHECK_CONFIG = {
  // 过期内容阈值（天）
  STALE_THRESHOLDS: {
    WARNING: 30,
    STALE: 60,
    EXPIRED: 90,
  },

  // 检测限制
  MAX_CHECK_LIMIT: 500,
  BATCH_SIZE: 50,

  // 链接检测配置
  LINK_CHECK_TIMEOUT_MS: 10000,
  LINK_CHECK_CONCURRENCY: 5,

  // 重复检测配置
  DUPLICATE_SIMILARITY_THRESHOLD: 0.85,

  // 缓存过期时间（小时）
  CACHE_TTL_HOURS: 24,
} as const;

// ============================================
// 检测类型枚举
// ============================================

export type HealthCheckType = "broken_link" | "duplicate" | "stale";

export type HealthIssueStatus = "issue" | "resolved" | "ignored";

export type HealthIssueSeverity = "low" | "medium" | "high";

// ============================================
// 失效链接相关类型
// ============================================

export type LinkErrorType =
  | "http_error"
  | "timeout"
  | "dns_error"
  | "ssl_error"
  | "connection_refused"
  | "unknown";

export interface BrokenLinkIssue {
  id: string;
  bookmarkId: number | null;
  title: string;
  url: string;
  httpStatus: number | null;
  errorType: LinkErrorType;
  errorMessage?: string;
  waybackUrl?: string;
  lastCheckedAt: string | null;
  detectedAt: string | null;
}

// ============================================
// 重复内容相关类型
// ============================================

export interface DuplicateItem {
  bookmarkId: number | null;
  title: string;
  url: string;
  createdAt: string;
  folderName?: string;
  isRecommendedKeep: boolean;
}

export interface DuplicateGroup {
  id: string;
  similarity: number;
  matchType: "exact_url" | "normalized_url" | "semantic";
  items: DuplicateItem[];
  recommendedKeepId: number | null;
  reason: string;
}

// ============================================
// 过期内容相关类型
// ============================================

export interface StaleContentItem {
  bookmarkId: number | null;
  title: string;
  url: string;
  folderId?: number | null;
  folderName?: string;
  lastAccessedAt: string | null;
  createdAt: string;
  daysSinceAccess: number;
  accessCount: number;
  severity: HealthIssueSeverity;
}

// ============================================
// 健康概览类型
// ============================================

export interface HealthOverview {
  brokenLinks: number;
  duplicates: number;
  staleContent: number;
  totalIssues: number;
  healthScore: number; // 0-100
  lastCheckedAt: string | null;
  trend?: {
    lastWeek: number;
    change: number;
  };
}

// ============================================
// 健康检测输入/输出类型
// ============================================

export interface HealthCheckInput {
  checkTypes?: HealthCheckType[];
  scope?: "all" | "folder" | "selected";
  folderId?: number | string;
  bookmarkIds?: string[];
  forceRefresh?: boolean;
  staleThresholdDays?: number;
}

export interface HealthCheckOutput {
  runId: string;
  overview: HealthOverview;
  brokenLinks: BrokenLinkIssue[];
  duplicateGroups: DuplicateGroup[];
  staleContent: StaleContentItem[];
  summary: string;
  suggestions: string[];
  generatedAt: string;
}

// ============================================
// 一键修复相关类型
// ============================================

export type FixAction =
  | "delete"
  | "archive"
  | "ignore"
  | "update_link"
  | "merge"
  | "keep"
  | "skip";

export interface QuickFixStrategy {
  brokenLinks: FixAction;
  duplicates: "keep_oldest" | "keep_newest" | "keep_most_complete" | "skip";
  staleContent: FixAction;
}

export interface QuickFixRequest {
  strategy: QuickFixStrategy;
  dryRun?: boolean;
  issueIds?: string[];
}

export interface QuickFixResult {
  success: boolean;
  deleted: number;
  archived: number;
  merged: number;
  ignored: number;
  errors: Array<{ id: string; error: string }>;
}

// ============================================
// 数据库行类型
// ============================================

export interface HealthCheckCacheRow {
  id: string;
  user_id: string;
  check_type: HealthCheckType;
  bookmark_id: number | null;
  related_bookmark_ids: number[] | null;
  status: HealthIssueStatus;
  severity: HealthIssueSeverity;
  details: Record<string, unknown>;
  ignored_at: string | null;
  resolved_at: string | null;
  resolution_action: string | null;
  detected_at: string;
  last_checked_at: string;
}

export interface HealthCheckRunRow {
  id: string;
  user_id: string;
  check_types: HealthCheckType[];
  scope: string;
  folder_id: string | null;
  total_checked: number;
  broken_links_count: number;
  duplicates_count: number;
  stale_count: number;
  status: "running" | "completed" | "failed" | "cancelled";
  progress: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

// ============================================
// API 响应类型
// ============================================

export interface HealthOverviewResponse {
  success: boolean;
  data: HealthOverview;
}

export interface BrokenLinksResponse {
  success: boolean;
  data: {
    items: BrokenLinkIssue[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface DuplicatesResponse {
  success: boolean;
  data: {
    groups: DuplicateGroup[];
    totalGroups: number;
    totalDuplicates: number;
  };
}

export interface StaleContentResponse {
  success: boolean;
  data: {
    items: StaleContentItem[];
    total: number;
    thresholds: {
      warning: number;
      stale: number;
      expired: number;
    };
  };
}

export interface QuickFixResponse {
  success: boolean;
  data: QuickFixResult;
}
