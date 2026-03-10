/**
 * 过渡类型桥接 — 内联定义（不再依赖旧 classification 模块）
 *
 * 目的：让前端组件/hooks 统一从 v2 导入类型，
 * 消除对旧 classification/ 的直接依赖。
 *
 * @version 3.0.0 (内联化：不再 re-export 旧模块)
 * @since 2026-03-10
 */

import type { Database, Json } from "@/types/supabase";
import type { ClusterProcessingStatus as ClusterProcessingStatusEnum } from "@/types/supabase";

// ============================================================================
// 书签扩展字段（原 classification/types/domain-types）
// ============================================================================

/** V4.2 书签扩展字段（聚类相关） */
export interface BookmarkV42Fields {
  pending_cluster: boolean | null;
  pending_since: string | null;
  cluster_id: string | null;
  cluster_confidence: number | null;
}

// ============================================================================
// 数据库行类型（从 supabase 类型派生）
// ============================================================================

type Tables = Database["public"]["Tables"];
type Functions = Database["public"]["Functions"];

// --- 文件夹画像 ---
export type FolderProfileRow = Tables["folder_profiles"]["Row"];
export type FolderProfileInsert = Tables["folder_profiles"]["Insert"];
export type FolderProfileUpdate = Tables["folder_profiles"]["Update"];

// --- 操作快照 ---
export type OperationSnapshotRow = Tables["operation_snapshots"]["Row"];
export type OperationSnapshotInsert = Tables["operation_snapshots"]["Insert"];

// --- 任务队列 ---
export type JobQueueRow = Tables["job_queue"]["Row"];
export type JobQueueInsert = Tables["job_queue"]["Insert"];

// --- 组织建议 ---
export type OrganizationSuggestionRow =
  Tables["organization_suggestions"]["Row"];
export type OrganizationSuggestionInsert =
  Tables["organization_suggestions"]["Insert"];

// --- 书签 ---
export type BookmarkRow = Tables["bookmarks"]["Row"];

// --- 文件夹 ---
export type FolderRow = Tables["folders"]["Row"];

// --- RPC ---
export type SearchFoldersUnifiedArgs =
  Functions["search_folders_unified"]["Args"];
export type SearchFoldersUnifiedReturns =
  Functions["search_folders_unified"]["Returns"];
export type ClaimNextJobArgs = Functions["claim_next_job"]["Args"];
export type ClaimNextJobReturns = Functions["claim_next_job"]["Returns"];
export type CompleteJobArgs = Functions["complete_job"]["Args"];
export type FailJobArgs = Functions["fail_job"]["Args"];
export type EnqueueJobArgs = Functions["enqueue_job"]["Args"];

// ============================================================================
// 业务枚举 & 类型别名
// ============================================================================

/** 操作快照动作类型（从权威源 supabase.ts 导入） */
export type { OperationSnapshotAction } from "@/types/supabase";

/** 任务队列类型 */
export type JobQueueType =
  | "compute_folder_profile"
  | "cluster_bookmarks"
  | "generate_suggestions"
  | "update_folder_heat"
  | "ai_rename_folder"
  | "batch_classify"
  | "generate_summary"
  | "batch_generate_summary"
  | "process_inbox_cache"
  | "check_rename_candidates"
  | "check_split_candidates"
  | "check_merge_candidates"
  | "generate_monthly_report"
  | "update_folder_profiles"
  | "cleanup_expired_data"
  | "generate_ai_content"
  | "generate_embedding"
  | "classify_bookmark"
  | "fetch_bookmark_content";

/** 任务状态 */
export type JobStatus =
  | "pending"
  | "claimed"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type OperationSnapshot = OperationSnapshotRow;
export type JobQueue = JobQueueRow;

// Re-export Json for convenience
export type { Json };

// ============================================================================
// 操作快照状态类型
// ============================================================================

/** 创建文件夹操作状态 */
export interface CreateOperationState {
  folder?: { id: number; name: string; parent_id?: number | null };
  folder_id?: number;
  folder_name?: string;
  bookmark_ids?: number[];
  bookmarks?: Array<{ id: number; title: string; folder_id: number | null }>;
  source?: string;
}

/** 分拆文件夹操作状态 */
export interface SplitOperationState {
  original_folder?: { id: number; name: string; parent_id?: number | null };
  original_folder_id?: number;
  original_folder_name?: string;
  new_folders?: Array<{
    id: number;
    name: string;
    parent_id?: number | null;
    bookmark_ids?: number[];
  }>;
  bookmark_moves?: Array<{
    bookmark_id: number;
    from_folder_id: number;
    to_folder_id: number;
  }>;
  source?: string;
}

/** 合并文件夹操作状态 */
export interface MergeOperationState {
  source_folders?: Array<{
    id: number;
    name: string;
    parent_id?: number | null;
    bookmark_ids?: number[];
  }>;
  target_folder?: {
    id: number;
    name: string;
    parent_id?: number | null;
  };
  target_folder_id?: number;
  target_folder_name?: string;
  merged_bookmarks?: Array<{
    id: number;
    title: string;
    folder_id: number | null;
  }>;
  source?: string;
}

/** 重命名文件夹操作状态 */
export interface RenameOperationState {
  folder_id?: number;
  old_name?: string;
  new_name?: string;
  source?: string;
}

// ============================================================================
// 任务队列相关类型
// ============================================================================

/** 任务队列项（带业务语义） */
export interface JobQueueItem {
  id: string;
  user_id: string;
  type: JobQueueType;
  status: JobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  priority: number;
  attempts: number;
  max_attempts: number;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  claimed_by: string | null;
  lock_until: string | null;
  created_at: string;
}

/** 任务队列插入类型 */
export interface JobQueueCreateParams {
  user_id: string;
  type: JobQueueType;
  payload?: Json;
  priority?: number;
  scheduled_at?: string;
  max_attempts?: number;
}

// ============================================================================
// Inbox 组织建议（原 classification/types/suggestion）
// ============================================================================

/** 建议类型 */
export type SuggestionType =
  | "move_to_existing"
  | "create_new"
  | "merge"
  | "split";

/** 建议状态 */
export type SuggestionStatus = "pending" | "accepted" | "rejected" | "expired";

/** 数据库组织建议 */
export interface OrganizationSuggestion {
  id: number;
  userId: string;
  suggestionType: SuggestionType;
  bookmarkIds: number[];
  targetFolderId: number | null;
  suggestedFolderName: string | null;
  confidence: number;
  reason: string | null;
  sampleTitles: string[];
  status: SuggestionStatus;
  createdAt: Date;
  respondedAt: Date | null;
}

/** 建议创建输入 */
export interface SuggestionInput {
  suggestionType: SuggestionType;
  bookmarkIds: number[];
  targetFolderId?: number;
  suggestedFolderName?: string;
  confidence: number;
  reason?: string;
  sampleTitles?: string[];
}

/** 聚类处理状态信息 */
export interface ClusterProcessingStatus {
  pendingClusterCount: number;
  clusterCount: number;
  lastProcessedAt: Date | null;
  nextScheduledAt: Date | null;
  hasPendingSuggestions: boolean;
  status?: ClusterProcessingStatusEnum;
}

/** 组织分析结果 */
export interface OrganizationAnalysis {
  inboxCount: number;
  suggestions: OrganizationSuggestion[];
  lastAnalyzedAt: Date | null;
  nextSuggestedAnalyzeAt: Date | null;
  clusterStatus?: ClusterProcessingStatus;
}

// ============================================================================
// 分类行动类型（原 classification/types/classification）
// ============================================================================

/** 旧系统分类行动类型（兼容用） */
export type ClassificationAction =
  | "classify"
  | "inbox"
  | "suggest"
  | "suggest_new"
  | "suggest_create"
  | "auto_create";

// ============================================================================
// 批量分类（已迁出到独立模块 batch-classification）
// ============================================================================

export type {
  ClusterResult,
  UserDecision,
  ConfirmationMode,
  ConflictType,
  ClassificationConflict,
  ClassificationProgress,
  ClassificationPhase,
  StructureMode,
} from "@/lib/batch-classification";
