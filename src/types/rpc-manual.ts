/**
 * Manual definition for RPC function parameters and return types
 * because they are not yet available in the generated types or need manual override.
 */

export interface BatchTagsParams {
  p_bookmark_ids: number[];
  p_tags: string[];
}

export interface BatchTagsReturn {
  affected_ids: number[];
  affected_count: number;
}

export interface WechatStatsParams {
  p_user_id: string;
}

export interface WechatStatsReturn {
  total_articles: number;
  total_images: number;
  success_images: number;
  failed_images: number;
  storage_used: number;
}

// ============================================
// Health Check System RPC Types
// ============================================

export interface GetHealthOverviewParams {
  p_user_id: string;
}

export interface GetHealthOverviewReturn {
  broken_links_count: number;
  duplicates_count: number;
  stale_count: number;
  total_issues: number;
  last_checked_at: string | null;
}

export interface GetStaleBookmarksParams {
  p_user_id: string;
  p_days_threshold?: number;
  p_limit?: number;
}

export interface GetStaleBookmarksReturn {
  bookmark_id: string;
  title: string;
  url: string;
  folder_id: string | null;
  last_accessed_at: string | null;
  created_at: string;
  days_since_access: number;
  access_count: number;
}

export interface BatchUpsertHealthCacheParams {
  p_user_id: string;
  p_items: unknown; // JSONB
}

export interface RecordBookmarkAccessParams {
  p_bookmark_id: string;
}

export interface CleanupResolvedHealthIssuesParams {
  p_user_id: string;
}

// ============================================
// Folder RPC Types (Missing from generated types)
// ============================================

/**
 * get_folder_descendant_ids - 获取文件夹所有后代 ID
 * @see supabase/migrations/20251229100002_north_star_p0_fixes.sql
 */
export interface GetFolderDescendantIdsParams {
  p_folder_id: number;
  p_user_id: string;
}

export type GetFolderDescendantIdsReturn = number[];

/**
 * cascade_delete_folder - 级联删除文件夹
 * @see supabase/migrations/20251229100002_north_star_p0_fixes.sql
 */
export interface CascadeDeleteFolderParams {
  p_folder_id: number;
  p_user_id: string;
}

export interface CascadeDeleteFolderReturn {
  deleted_folder_count: number;
  moved_bookmark_count: number;
}

/**
 * get_folders_with_counts - 获取文件夹及书签计数
 * Note: This is in generated types but we define interface for consistency
 */
export interface GetFoldersWithCountsParams {
  p_user_id: string;
}

export interface FolderWithCountRow {
  id: number;
  user_id: string;
  name: string;
  parent_id: number | null;
  is_archived: boolean;
  is_system: boolean;
  system_type: string | null;
  folder_group: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  bookmarkCount: number;
}

// ============================================
// Bookmark RPC Types (Missing from generated types)
// ============================================

/**
 * toggle_bookmark_starred - 切换书签收藏状态
 * @see supabase/migrations/20251229100002_north_star_p0_fixes.sql
 */
export interface ToggleBookmarkStarredParams {
  p_bookmark_id: number;
  p_user_id: string;
}

// ============================================
// Summary Quality Log Types (Missing from generated types)
// ============================================

/**
 * summary_quality_logs 表行类型
 * 用于质量日志仓库的类型安全查询
 */
export interface SummaryQualityLogRow {
  id: number;
  bookmark_id: number;
  user_id: string;
  content_length: number | null;
  content_type: string | null;
  provider_used: string;
  model_used: string;
  prompt_version: string | null;
  summary_version: number | null;
  summary_length: number | null;
  tags_count: number | null;
  latency_ms: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  estimated_cost_cents: number | null;
  auto_quality_score: number | null;
  user_rating: number | null;
  user_feedback: string | null;
  error_code: string | null;
  error_message: string | null;
  fallback_used: boolean | null;
  retry_count: number | null;
  created_at: string;
}

export interface SummaryQualityLogInsert {
  bookmark_id: number;
  user_id: string;
  content_length?: number | null;
  content_type?: string | null;
  provider_used: string;
  model_used: string;
  prompt_version?: string | null;
  summary_version?: number | null;
  summary_length?: number | null;
  tags_count?: number | null;
  latency_ms?: number | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  estimated_cost_cents?: number | null;
  auto_quality_score?: number | null;
  user_rating?: number | null;
  user_feedback?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  fallback_used?: boolean | null;
  retry_count?: number | null;
}

export interface SummaryQualityLogUpdate {
  user_rating?: number | null;
  user_feedback?: string | null;
}

/**
 * get_summary_provider_stats RPC 类型
 */
export interface GetSummaryProviderStatsParams {
  p_user_id: string;
  p_days: number;
}

export interface SummaryProviderStatsRow {
  provider: string;
  total_calls: number;
  success_count: number;
  error_count: number;
  avg_latency_ms: number;
  total_tokens: number;
}

// ============================================
// User Notifications Table Types
// @see supabase/migrations/20260201172820_notification_system_v2.sql
// ============================================

export type NotificationPriority =
  | "silent"
  | "normal"
  | "important"
  | "critical";
export type NotificationStatus = "unread" | "read" | "archived";
export type NotificationChannel = "inbox" | "toast" | "modal" | "push";

export interface UserNotificationRow {
  id: string;
  user_id: string;
  type_code: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  action_label: string | null;
  metadata: Record<string, unknown>;
  status: NotificationStatus;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface UserNotificationInsert {
  id?: string;
  user_id: string;
  type_code: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  title: string;
  body?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action_url?: string | null;
  action_label?: string | null;
  metadata?: Record<string, unknown>;
  status?: NotificationStatus;
  read_at?: string | null;
  created_at?: string;
  expires_at?: string | null;
}

export interface UserNotificationUpdate {
  type_code?: string;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  title?: string;
  body?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action_url?: string | null;
  action_label?: string | null;
  metadata?: Record<string, unknown>;
  status?: NotificationStatus;
  read_at?: string | null;
  expires_at?: string | null;
}

// RPC Functions for notifications
export interface MarkNotificationsReadParams {
  p_user_id: string;
  p_ids: string[];
}

export interface MarkAllNotificationsReadParams {
  p_user_id: string;
}

export interface GetNotificationCountsParams {
  p_user_id: string;
}

export interface NotificationCountRow {
  priority: string;
  count: number;
}

// ============================================
// Batch Classification System Table Types
// @see supabase/migrations/20260201190000_batch_classification_schema.sql
// ============================================

export type ClusterStatus = "pending" | "confirmed" | "rejected" | "modified";
export type ClusterMatchType = "exact" | "fuzzy" | "create_new";
export type ClusterConflictType =
  | "none"
  | "path_mismatch"
  | "folder_rename"
  | "ambiguous";
export type BatchTransactionStatus =
  | "pending"
  | "processing"
  | "ready"
  | "confirmed"
  | "undone"
  | "expired";
export type StructureMode = "preserve" | "hybrid" | "rebuild" | "auto";
export type ClassificationPhase =
  | "sedimentation"
  | "clustering"
  | "mapping"
  | "completed"
  | "failed";

/**
 * import_clusters 表行类型
 */
export interface ImportClusterRow {
  id: string;
  import_batch_id: string | null;
  user_id: string;
  cluster_index: number;
  centroid: string | null; // vector as string
  cohesion: number | null;
  member_count: number;
  suggested_name: string | null;
  suggested_name_confidence: number | null;
  suggested_folder_id: number | null;
  match_confidence: number | null;
  match_type: ClusterMatchType | null;
  conflict_type: ClusterConflictType;
  conflict_details: Record<string, unknown> | null;
  status: ClusterStatus;
  created_at: string;
  updated_at: string;
}

export interface ImportClusterInsert {
  id?: string;
  import_batch_id?: string | null;
  user_id: string;
  cluster_index: number;
  centroid?: string | null;
  cohesion?: number | null;
  member_count?: number;
  suggested_name?: string | null;
  suggested_name_confidence?: number | null;
  suggested_folder_id?: number | null;
  match_confidence?: number | null;
  match_type?: ClusterMatchType | null;
  conflict_type?: ClusterConflictType;
  conflict_details?: Record<string, unknown> | null;
  status?: ClusterStatus;
  created_at?: string;
  updated_at?: string;
}

export interface ImportClusterUpdate {
  import_batch_id?: string | null;
  cluster_index?: number;
  centroid?: string | null;
  cohesion?: number | null;
  member_count?: number;
  suggested_name?: string | null;
  suggested_name_confidence?: number | null;
  suggested_folder_id?: number | null;
  match_confidence?: number | null;
  match_type?: ClusterMatchType | null;
  conflict_type?: ClusterConflictType;
  conflict_details?: Record<string, unknown> | null;
  status?: ClusterStatus;
  updated_at?: string;
}

/**
 * import_cluster_members 表行类型
 */
export interface ImportClusterMemberRow {
  cluster_id: string;
  bookmark_id: number;
  distance_to_centroid: number | null;
  is_representative: boolean;
  representative_type: "core" | "edge" | null;
  created_at: string;
}

export interface ImportClusterMemberInsert {
  cluster_id: string;
  bookmark_id: number;
  distance_to_centroid?: number | null;
  is_representative?: boolean;
  representative_type?: "core" | "edge" | null;
  created_at?: string;
}

/**
 * batch_import_transactions 表行类型
 */
export interface BatchImportTransactionRow {
  id: string;
  batch_id: string | null;
  user_id: string;
  imported_at: string;
  confirmed_at: string | null;
  undo_deadline: string | null;
  undo_available: boolean;
  pre_confirm_snapshot: Record<string, unknown> | null;
  total_bookmarks: number;
  total_clusters: number;
  auto_confirmed_count: number;
  manual_confirmed_count: number;
  rejected_count: number;
  status: BatchTransactionStatus;
  structure_mode: StructureMode;
  structure_analysis: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface BatchImportTransactionInsert {
  id?: string;
  batch_id?: string | null;
  user_id: string;
  imported_at?: string;
  confirmed_at?: string | null;
  undo_deadline?: string | null;
  undo_available?: boolean;
  pre_confirm_snapshot?: Record<string, unknown> | null;
  total_bookmarks?: number;
  total_clusters?: number;
  auto_confirmed_count?: number;
  manual_confirmed_count?: number;
  rejected_count?: number;
  status?: BatchTransactionStatus;
  structure_mode?: StructureMode;
  structure_analysis?: Record<string, unknown> | null;
}

export interface BatchImportTransactionUpdate {
  batch_id?: string | null;
  confirmed_at?: string | null;
  undo_deadline?: string | null;
  undo_available?: boolean;
  pre_confirm_snapshot?: Record<string, unknown> | null;
  total_bookmarks?: number;
  total_clusters?: number;
  auto_confirmed_count?: number;
  manual_confirmed_count?: number;
  rejected_count?: number;
  status?: BatchTransactionStatus;
  structure_mode?: StructureMode;
  structure_analysis?: Record<string, unknown> | null;
  updated_at?: string;
}

/**
 * batch_classification_progress 表行类型
 */
export interface BatchClassificationProgressRow {
  id: string;
  transaction_id: string;
  user_id: string;
  current_phase: ClassificationPhase;
  progress: number;
  phase_details: {
    sedimentation: { status: string; processed: number; total: number };
    clustering: { status: string; clusters_found: number };
    mapping: { status: string; mapped: number; created: number };
  };
  estimated_remaining_seconds: number | null;
  error_message: string | null;
  error_details: Record<string, unknown> | null;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
}

export interface BatchClassificationProgressInsert {
  id?: string;
  transaction_id: string;
  user_id: string;
  current_phase?: ClassificationPhase;
  progress?: number;
  phase_details?: Record<string, unknown>;
  estimated_remaining_seconds?: number | null;
  error_message?: string | null;
  error_details?: Record<string, unknown> | null;
  started_at?: string;
  completed_at?: string | null;
}

export interface BatchClassificationProgressUpdate {
  current_phase?: ClassificationPhase;
  progress?: number;
  phase_details?: Record<string, unknown>;
  estimated_remaining_seconds?: number | null;
  error_message?: string | null;
  error_details?: Record<string, unknown> | null;
  completed_at?: string | null;
  updated_at?: string;
}
