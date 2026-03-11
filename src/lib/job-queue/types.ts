/**
 * 任务队列相关类型定义
 * 从 classification-v1 提取，独立维护
 */

import type { Json } from "@/types/supabase";

/**
 * 任务类型枚举
 */
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
  | "update_folder_profiles"
  | "cleanup_expired_data"
  | "generate_ai_content"
  | "generate_embedding"
  | "classify_bookmark"
  | "fetch_bookmark_content";

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
