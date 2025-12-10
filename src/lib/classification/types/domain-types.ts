/**
 * Classification Domain Types
 *
 * 业务领域类型定义 - 从 supabase.ts 派生，添加业务语义
 * 这是分类模块的类型单一来源（Single Source of Truth）
 *
 * 架构原则：
 * - 第一层：supabase.ts（自动生成，禁止修改）
 * - 第二层：domain-types.ts（本文件，业务语义封装）
 * - 第三层：业务代码（只从本文件导入类型）
 */

import type { Database, Json } from "@/types/supabase";

// ============================================================================
// 表类型别名（从 supabase.ts 派生）
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

// --- 分类决策 ---
export type ClassificationDecisionRow =
  Tables["classification_decisions"]["Row"];
export type ClassificationDecisionInsert =
  Tables["classification_decisions"]["Insert"];

// --- 分类指标 ---
export type ClassificationMetricsRow = Tables["classification_metrics"]["Row"];
export type ClassificationMetricsInsert =
  Tables["classification_metrics"]["Insert"];

// --- 分类建议 ---
export type ClassificationSuggestionRow =
  Tables["classification_suggestions"]["Row"];

// --- 组织建议 ---
export type OrganizationSuggestionRow =
  Tables["organization_suggestions"]["Row"];
export type OrganizationSuggestionInsert =
  Tables["organization_suggestions"]["Insert"];

// --- 分类反馈 ---
export type ClassificationFeedbackRow =
  Tables["classification_feedback"]["Row"];
export type ClassificationFeedbackInsert =
  Tables["classification_feedback"]["Insert"];

// --- 书签 ---
export type BookmarkRow = Tables["bookmarks"]["Row"];

// --- 文件夹 ---
export type FolderRow = Tables["folders"]["Row"];

// ============================================================================
// RPC 函数类型
// ============================================================================

// 统一向量搜索
export type SearchFoldersUnifiedArgs =
  Functions["search_folders_unified"]["Args"];
export type SearchFoldersUnifiedReturns =
  Functions["search_folders_unified"]["Returns"];

// 相似文件夹搜索
export type SearchSimilarFoldersArgs =
  Functions["search_similar_folders"]["Args"];
export type SearchSimilarFoldersReturns =
  Functions["search_similar_folders"]["Returns"];

// 任务队列相关
export type ClaimNextJobArgs = Functions["claim_next_job"]["Args"];
export type ClaimNextJobReturns = Functions["claim_next_job"]["Returns"];
export type CompleteJobArgs = Functions["complete_job"]["Args"];
export type FailJobArgs = Functions["fail_job"]["Args"];
export type EnqueueJobArgs = Functions["enqueue_job"]["Args"];

// 获取活跃操作
export type GetActiveOperationsArgs =
  Functions["get_active_operations"]["Args"];
export type GetActiveOperationsReturns =
  Functions["get_active_operations"]["Returns"];

// 标记操作已撤销
export type MarkOperationUndoneArgs =
  Functions["mark_operation_undone"]["Args"];

// ============================================================================
// 业务枚举类型
// ============================================================================

/**
 * 操作快照动作类型
 */
export type OperationSnapshotAction =
  | "create"
  | "split"
  | "merge"
  | "rename"
  | "move"
  | "delete";

/**
 * 任务队列类型
 */
export type JobQueueType =
  | "compute_folder_profile"
  | "cluster_bookmarks"
  | "generate_suggestions"
  | "update_folder_heat"
  | "ai_rename_folder"
  | "batch_classify";

/**
 * 任务状态
 */
export type JobStatus =
  | "pending"
  | "claimed"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * 分类决策类型
 */
export type ClassificationDecisionType =
  | "tier1_direct" // T1: 高置信度直接分类
  | "tier2_ai_confirmed" // T2: AI 确认分类
  | "tier3_auto_create" // T3: 自动创建文件夹
  | "to_inbox" // 送入待整理
  | "exact_match" // 精确匹配（规则/历史）
  | "high_confidence" // 高置信度
  | "ai_assisted" // AI 辅助
  | "user_manual"; // 用户手动

// ============================================================================
// 操作快照状态类型
// ============================================================================

/**
 * 创建文件夹操作状态 (snake_case 匹配数据库字段)
 */
export interface CreateOperationState {
  folder?: { id: number; name: string; parent_id?: number | null };
  folder_id?: number;
  folder_name?: string;
  bookmark_ids?: number[];
  bookmarks?: Array<{ id: number; title: string; folder_id: number | null }>;
  source?: string;
}

/**
 * 分拆文件夹操作状态
 */
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

/**
 * 合并文件夹操作状态
 */
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

/**
 * 重命名文件夹操作状态
 */
export interface RenameOperationState {
  folder_id?: number;
  old_name?: string;
  new_name?: string;
  source?: string;
}

// ============================================================================
// 任务队列相关类型
// ============================================================================

/**
 * 任务队列项（带业务语义）
 */
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

/**
 * 任务队列插入类型
 */
export interface JobQueueCreateParams {
  user_id: string;
  type: JobQueueType;
  payload?: Json;
  priority?: number;
  scheduled_at?: string;
  max_attempts?: number;
}

// ============================================================================
// 向量搜索结果类型
// ============================================================================

/**
 * 统一向量搜索结果（与 RPC 返回匹配）
 */
export interface SearchFoldersUnifiedResult {
  folder_id: number;
  folder_name: string;
  similarity: number;
  match_type: "profile" | "name";
  bookmark_count: number;
  top_tags: string[];
}

/**
 * 相似文件夹搜索结果
 */
export interface SimilarFolderResult {
  folder_id: number;
  folder_name: string;
  similarity: number;
  bookmark_count: number;
  top_tags: string[];
  sample_titles: string[];
}

// ============================================================================
// 类型别名（方便使用）
// 注意: FolderProfile 在 classification.ts 中已定义（camelCase 业务类型）
// 这里的 Row 类型是 snake_case 数据库类型，不能混淆
// ============================================================================

export type OperationSnapshot = OperationSnapshotRow;
export type JobQueue = JobQueueRow;
export type ClassificationDecision = ClassificationDecisionRow;
export type ClassificationMetrics = ClassificationMetricsRow;

// Re-export Json type for convenience
export type { Json };

// ============================================================================
// 书签扩展字段
// ============================================================================

/**
 * V4.2 书签扩展字段（聚类相关）
 */
export interface BookmarkV42Fields {
  pending_cluster: boolean | null;
  pending_since: string | null;
  cluster_id: string | null;
  cluster_confidence: number | null;
}
