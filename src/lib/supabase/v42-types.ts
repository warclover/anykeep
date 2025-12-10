/**
 * V4.2 类型断言工具
 *
 * 由于 Database 类型尚未通过 Supabase CLI 重新生成，
 * 此文件提供类型安全的方式访问 V4.2 新增的表和字段。
 *
 * TODO: 运行 `npm run supabase:gen:types` 后删除此文件
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// ============================================================================
// V4.2 表定义
// ============================================================================

/**
 * folder_profiles 表类型 (与 supabase.ts 保持同步)
 * @see Database["public"]["Tables"]["folder_profiles"]["Row"]
 */
export interface FolderProfileRow {
  id: number;
  folder_id: number;
  user_id: string;
  bookmark_count: number | null;
  computed_at: string | null;
  internal_similarity: number | null;
  last_bookmark_at: string | null;
  name_embedding: string | null;
  profile_embedding: string | null;
  sample_titles: string[] | null;
  source: string | null;
  top_tags: string[] | null;
  updated_at: string | null;
  // V4.2 扩展字段
  heat_computed_at: string | null;
  heat_score: number | null;
  is_ai_renamable: boolean | null;
  is_merge_candidate: boolean | null;
  is_split_candidate: boolean | null;
  is_system_locked: boolean | null;
  recent_additions: number | null;
  similar_folder_ids: number[] | null;
  suggested_name: string | null;
  suggested_name_reason: string | null;
}

/**
 * job_queue 表类型
 */
export interface JobQueueRow {
  id: number;
  user_id: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  priority: number;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

/**
 * operation_snapshots 表类型
 */
export interface OperationSnapshotRow {
  id: number;
  user_id: string;
  operation_type: string;
  action: string;
  folder_id: number | null;
  folder_name: string | null;
  folder_ids: number[] | null;
  bookmark_ids: number[] | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  reason: string | null;
  source: string;
  is_undone: boolean;
  undone_at: string | null;
  expires_at: string;
  created_at: string;
}

/**
 * classification_trace 表类型
 */
export interface ClassificationTraceRow {
  id: number;
  user_id: string;
  bookmark_id: number;
  request_id: string;
  tier: number;
  steps: Record<string, unknown>[];
  final_decision: Record<string, unknown>;
  execution_time_ms: number;
  created_at: string;
}

/**
 * classification_metrics 表类型
 */
export interface ClassificationMetricsRow {
  id: number;
  user_id: string;
  bookmark_url: string | null;
  action: string;
  folder_id: number | null;
  folder_name: string | null;
  confidence: number | null;
  tier: number;
  cache_hit: boolean;
  ai_called: boolean;
  match_type: string | null;
  vector_score: number | null;
  execution_time_ms: number;
  decision_reason: string | null;
  created_at: string;
}

/**
 * embedding_ab_test_metrics 表类型
 */
export interface EmbeddingAbTestMetricsRow {
  id: number;
  user_id: string;
  test_group: string;
  model_name: string;
  bookmark_id: number;
  query_text: string | null;
  match_score: number | null;
  match_rank: number | null;
  user_feedback: string | null;
  created_at: string;
}

/**
 * classification_decisions 表类型 (V4.0 追踪)
 */
export interface ClassificationDecisionRow {
  id: number;
  user_id: string;
  bookmark_id: number;
  decision_type: ClassificationDecisionType;
  final_folder_id: number | null;
  final_folder_name: string | null;
  confidence: number | null;
  matcher_scores: Json | null;
  ai_skipped: boolean;
  created_at: string;
}

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

/**
 * classification_decisions 插入类型
 */
export interface ClassificationDecisionInsert {
  user_id: string;
  bookmark_id: number;
  decision_type: ClassificationDecisionType;
  final_folder_id?: number | null;
  final_folder_name?: string | null;
  confidence?: number | null;
  matcher_scores?: Json | null;
  ai_skipped?: boolean;
}

// ============================================================================
// V4.2 操作快照相关类型
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
 * 操作快照插入类型
 */
export interface OperationSnapshotInsert {
  user_id: string;
  operation_type?: string;
  action: OperationSnapshotAction;
  folder_id?: number | null;
  folder_name?: string | null;
  folder_ids?: number[] | null;
  bookmark_ids?: number[] | null;
  before_state?: Json | null;
  after_state?: Json | null;
  reason?: string | null;
  source?: string;
  expires_at?: string;
}

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
 * 分拆文件夹操作状态 (snake_case 匹配数据库字段)
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
 * 合并文件夹操作状态 (snake_case 匹配数据库字段)
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
 * 重命名文件夹操作状态 (snake_case 匹配数据库字段)
 */
export interface RenameOperationState {
  folder_id?: number;
  old_name?: string;
  new_name?: string;
  source?: string;
}

// ============================================================================
// V4.2 任务队列相关类型
// ============================================================================

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
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * 任务队列项
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
  worker_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 任务队列插入类型
 */
export interface JobQueueInsert {
  user_id: string;
  type: JobQueueType;
  payload?: Json;
  priority?: number;
  scheduled_at?: string;
  max_attempts?: number;
}

// ============================================================================
// V4.2 bookmarks 表扩展字段
// ============================================================================

export interface BookmarkV42Fields {
  pending_cluster: boolean | null;
  pending_since: string | null;
  cluster_id: string | null;
  cluster_confidence: number | null;
}

// ============================================================================
// V4.2 classification_suggestions 表扩展字段
// ============================================================================

export interface SuggestionV42Fields {
  bookmark_ids: number[] | null;
  suggested_action: string | null;
  metadata: Record<string, unknown> | null;
}

// ============================================================================
// V4.2 profiles 表扩展字段
// ============================================================================

export interface ProfileV42Fields {
  ai_evolution_level: "manual" | "semi" | "auto" | null;
}

// ============================================================================
// 类型断言工具函数
// ============================================================================

type AnySupabaseClient = SupabaseClient<Database> | SupabaseClient<unknown>;

/**
 * 访问 V4.2 新增表的类型安全包装
 * 使用时：v42Table(supabase).from("folder_profiles")
 */
export function v42Table(client: AnySupabaseClient) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client as any;
}

/**
 * 调用 V4.2 新增 RPC 函数的类型安全包装
 */
export function v42Rpc(client: AnySupabaseClient) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client as any;
}

/**
 * 断言查询结果包含 V4.2 字段
 */
export function asV42Bookmark<T>(data: T): T & BookmarkV42Fields {
  return data as T & BookmarkV42Fields;
}

/**
 * 断言查询结果包含 V4.2 建议字段
 */
export function asV42Suggestion<T>(data: T): T & SuggestionV42Fields {
  return data as T & SuggestionV42Fields;
}

/**
 * 断言查询结果包含 V4.2 配置字段
 */
export function asV42Profile<T>(data: T): T & ProfileV42Fields {
  return data as T & ProfileV42Fields;
}

// ============================================================================
// 通用 JSON 类型
// ============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ============================================================================
// 类型别名导出（方便使用）
// ============================================================================

export type FolderProfile = FolderProfileRow;
export type JobQueue = JobQueueRow;
export type OperationSnapshot = OperationSnapshotRow;
export type ClassificationTrace = ClassificationTraceRow;
export type ClassificationMetrics = ClassificationMetricsRow;
export type EmbeddingAbTestMetrics = EmbeddingAbTestMetricsRow;
