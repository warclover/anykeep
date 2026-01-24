/**
 * Supabase 类型定义入口文件
 *
 * 从自动生成的类型文件重新导出
 */

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
