/**
 * Supabase 类型定义入口文件
 *
 * 从自动生成的类型文件重新导出
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export * from "./supabase.generated";
export type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./supabase.generated";

// ============================================
// 自定义用途标签相关常量
// ============================================

/**
 * 自定义用途标签数量上限
 */
export const CUSTOM_USAGE_TAG_LIMIT = 20;

/**
 * 自定义标签可用颜色类型
 */
export type CustomTagColor =
  | "blue"
  | "purple"
  | "pink"
  | "sky"
  | "lime"
  | "yellow"
  | "slate"
  | "zinc"
  | "green"
  | "red"
  | "orange"
  | "cyan"
  | "indigo"
  | "amber"
  | "rose"
  | "violet"
  | "teal"
  | "emerald"
  | "fuchsia";

/**
 * 自定义标签可用颜色列表
 */
export const CUSTOM_TAG_COLOR_LIST: CustomTagColor[] = [
  "blue",
  "purple",
  "pink",
  "sky",
  "lime",
  "yellow",
  "slate",
  "zinc",
];

/**
 * 自定义标签颜色映射（用于类型安全的颜色查找）
 */
export const CUSTOM_TAG_COLORS: Record<CustomTagColor, true> = {
  blue: true,
  purple: true,
  pink: true,
  sky: true,
  lime: true,
  yellow: true,
  slate: true,
  zinc: true,
  green: true,
  red: true,
  orange: true,
  cyan: true,
  indigo: true,
  amber: true,
  rose: true,
  violet: true,
  teal: true,
  emerald: true,
  fuchsia: true,
};

// ============================================
// 手动补充的表类型定义（supabase.generated.ts 中缺失）
// ============================================

/**
 * 页面监控配置行类型
 * @see supabase/migrations/20251228000201_add_page_monitors.sql
 */
export interface PageMonitorRow {
  id: number;
  user_id: string;
  bookmark_id: number;
  check_interval: "every_6h" | "twice_daily" | "daily" | "weekly" | "custom";
  custom_interval_hours: number | null;
  last_checked_at: string | null;
  next_check_at: string | null;
  baseline_snapshot_id: number | null;
  baseline_content_hash: string | null;
  baseline_captured_at: string | null;
  status: "active" | "paused" | "failed" | "deleted";
  consecutive_failures: number;
  last_error_message: string | null;
  change_count: number;
  last_change_at: string | null;
  notification_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 页面监控配置插入类型
 */
export interface PageMonitorInsert {
  user_id: string;
  bookmark_id: number;
  check_interval?: "every_6h" | "twice_daily" | "daily" | "weekly" | "custom";
  custom_interval_hours?: number | null;
  notification_enabled?: boolean;
}

/**
 * 页面监控配置更新类型
 */
export interface PageMonitorUpdate {
  check_interval?: "every_6h" | "twice_daily" | "daily" | "weekly" | "custom";
  custom_interval_hours?: number | null;
  status?: "active" | "paused" | "failed" | "deleted";
  notification_enabled?: boolean;
  last_checked_at?: string | null;
  next_check_at?: string | null;
  baseline_snapshot_id?: number | null;
  baseline_content_hash?: string | null;
  baseline_captured_at?: string | null;
  consecutive_failures?: number;
  last_error_message?: string | null;
  change_count?: number;
  last_change_at?: string | null;
}

/**
 * 监控检查日志行类型
 * @see supabase/migrations/20251228000003_add_monitor_check_logs.sql
 */
export interface MonitorCheckLogRow {
  id: number;
  monitor_id: number;
  user_id: string;
  check_result: "no_change" | "changed" | "failed" | "skipped";
  previous_hash: string | null;
  current_hash: string | null;
  similarity_score: number | null;
  change_summary: string | null;
  error_message: string | null;
  checked_at: string;
  duration_ms: number | null;
  new_snapshot_id: number | null;
  archived_version_id: number | null;
}

/**
 * 监控检查日志插入类型
 */
export interface MonitorCheckLogInsert {
  monitor_id: number;
  user_id: string;
  check_result: "no_change" | "changed" | "failed" | "skipped";
  previous_hash?: string | null;
  current_hash?: string | null;
  similarity_score?: number | null;
  change_summary?: string | null;
  error_message?: string | null;
  checked_at?: string;
  duration_ms?: number | null;
  new_snapshot_id?: number | null;
  archived_version_id?: number | null;
}

/**
 * 分发目标行类型
 * @see supabase/migrations/20260101000001_create_distribution_tables.sql
 */
export interface DistributionTargetRow {
  id: string;
  user_id: string;
  target_type: "obsidian" | "notion" | "webhook" | "rss" | "manual_export";
  name: string;
  enabled: boolean;
  trigger_mode: "realtime" | "scheduled" | "manual";
  schedule_interval_minutes: number | null;
  filter_platforms: string[] | null;
  filter_folders: string[] | null;
  filter_tags: string[] | null;
  include_ai_summary: boolean;
  target_config: Record<string, unknown>;
  status: "idle" | "syncing" | "error";
  last_sync_at: string | null;
  last_error: string | null;
  synced_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * 分发记录行类型
 */
export interface DistributionRecordRow {
  id: string;
  target_id: string;
  bookmark_id: string;
  status: "pending" | "success" | "failed";
  distributed_at: string | null;
  external_id: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

/**
 * 分发记录插入/更新类型
 */
export interface DistributionRecordUpsert {
  id?: string;
  target_id: string;
  bookmark_id: string;
  status?: "pending" | "success" | "failed";
  distributed_at?: string | null;
  external_id?: string | null;
  error_message?: string | null;
  retry_count?: number;
  created_at?: string;
}

/**
 * 自定义用途标签类型
 */
export interface CustomUsageTag {
  /** 唯一标识符 */
  id: string;
  /** 标签值（用于存储） */
  value: string;
  /** 显示标签（可选，默认等于 value） */
  label?: string;
  /** 标签颜色 */
  color: CustomTagColor;
  /** 创建时间 */
  createdAt: string;
  /** 最后使用时间 */
  lastUsedAt?: string;
}

// ============================================
// 表类型别名（从 Database 派生）
// ============================================

import type { Database } from "./supabase.generated";

/** Bookmark 行类型 */
export type Bookmark = Database["public"]["Tables"]["bookmarks"]["Row"];
/** Bookmark 插入类型 */
export type BookmarkInsert =
  Database["public"]["Tables"]["bookmarks"]["Insert"];
/** Bookmark 更新类型 */
export type BookmarkUpdate =
  Database["public"]["Tables"]["bookmarks"]["Update"];
/** Bookmark 带快照类型 */
export type BookmarkWithSnapshot = Bookmark & {
  has_snapshot: boolean;
  last_snapshot_at?: string | null;
};

/** Folder 行类型 */
export type Folder = Database["public"]["Tables"]["folders"]["Row"];
/** Folder 插入类型 */
export type FolderInsert = Database["public"]["Tables"]["folders"]["Insert"];
/** Folder 更新类型 */
export type FolderUpdate = Database["public"]["Tables"]["folders"]["Update"];
/** Folder 树节点类型 */
export type FolderTreeNode = Folder & {
  children?: FolderTreeNode[];
  bookmark_count?: number;
  // Explicitly include common fields to satisfy type requirements
  id: number;
  name: string;
  is_system: boolean;
  is_archived: boolean;
};

/** Profile 行类型 */
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
/** Profile 设置类型 */
export type ProfileSettings = Profile["settings"];

/** 文件夹画像类型 */
export type FolderProfile =
  Database["public"]["Tables"]["folder_profiles"]["Row"];

/** 导入历史类型 */
export type ImportHistory =
  Database["public"]["Tables"]["import_history"]["Row"];

/** 平台类型 */
export type Platform =
  | "wechat"
  | "WECHAT_OFFICIAL_ACCOUNT"
  | "bilibili"
  | "BILIBILI"
  | "xiaohongshu"
  | "XIAOHONGSHU"
  | "zhihu"
  | "weibo"
  | "douyin"
  | "twitter"
  | "youtube"
  | "github"
  | "medium"
  | "juejin"
  | "csdn"
  | "jianshu"
  | "chrome"
  | "edge"
  | "firefox"
  | "safari"
  | "BROWSER_CHROME"
  | "BROWSER_EDGE"
  | "BROWSER_FIREFOX"
  | "BROWSER_SAFARI"
  | "UNKNOWN"
  | "other";

/** 导入源类型 */
export type ImportSource =
  | "chrome"
  | "edge"
  | "firefox"
  | "safari"
  | "browser_chrome"
  | "browser_edge"
  | "browser_firefox"
  | "browser_safari"
  | "api"
  | "share_sheet"
  | "manual"
  | "other";

/** 导入错误详情类型 */
export type ImportErrorDetail = {
  url: string;
  title?: string;
  error: string;
  code?: string;
};

/** 文件夹分组类型 */
export type FolderGroup =
  | "default"
  | "smart"
  | "archive"
  | "system"
  | "work"
  | "study"
  | "life"
  | "entertainment"
  | "other";

/** 操作快照动作类型 */
export type OperationSnapshotAction =
  | "create"
  | "update"
  | "delete"
  | "move"
  | "merge"
  | "split"
  | "rename"
  | "archive"
  | "batch_move"
  | "batch_tag"
  | "batch_delete"
  | "merge_folder"
  | "create_folder"
  | "rename_folder"
  | "delete_folder"
  | "undo";

/** 操作详情类型 */
export type OperationDetail = {
  id: string;
  operation_type: string;
  summary: string | null;
  created_at: string;
  expires_at: string;
  bookmark_ids: number[] | null;
  folder_snapshots?: unknown;
  metadata?: unknown;
  action?: OperationSnapshotAction;
  before_state?: unknown;
  after_state?: unknown;
  can_undo?: boolean;
  reason?: string;
};

/** 分类建议类型 */
export type ClassificationSuggestion =
  Database["public"]["Tables"]["classification_suggestions"]["Row"];
/** 分类建议插入类型 */
export type ClassificationSuggestionInsert =
  Database["public"]["Tables"]["classification_suggestions"]["Insert"];

/** 建议状态类型 */
export type SuggestionStatus = "pending" | "accepted" | "rejected" | "expired";

/** 分类状态类型 */
export type ClassificationStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

/** 分类结果数据���型 */
export type ClassificationResultData = {
  folder_id: number | null;
  folder_name: string | null;
  confidence: number;
  method: string;
  /** 分类动作：select_existing（选择现有）, suggest_new（建议新建）, inbox（放入待整理） */
  action?: "select_existing" | "suggest_new" | "inbox";
  /** 文件夹名称（驼峰命名别名，兼容前端代码） */
  folderName?: string | null;
  /** 分类原因 */
  reason?: string | null;
  suggestions?: Array<{
    folder_id: number;
    folder_name: string;
    confidence: number;
  }>;
};

/** 分类候选类型 */
export type ClassificationCandidate = {
  folder_id: number;
  folder_name: string;
  confidence: number;
  reason?: string;
};

/** 报告建议类型 */
export type ReportSuggestion = {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  action_type?: string;
  action_params?: unknown;
};

/** 会员类型 */
export type MembershipType = "free" | "pro" | "premium";

/** 重分类设置类型 */
export type ReclassifySettings = {
  enabled: boolean;
  threshold: number;
  auto_apply: boolean;
  /** 待整理文件夹阈值 */
  inbox_threshold?: number;
  /** 上次运行时间 */
  last_run_at?: string | null;
  /** 是否每周自动运行 */
  auto_run_weekly?: boolean;
};

/** AI 文件夹设置类型 */
export type AIFolderSettings = {
  auto_create_enabled: boolean;
  max_folders: number;
  naming_style: "concise" | "descriptive";
};

/** 聚类处理状态类型 */
export type ClusterProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

/** 导入历史选项类型 */
export type ImportHistoryOptions = {
  limit?: number;
  offset?: number;
  source?: ImportSource;
};
