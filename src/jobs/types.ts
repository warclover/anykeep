/**
 * Job Queue Types
 *
 * 异步任务队列类型定义
 *
 * @module jobs/types
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";

// ============================================================================
// 任务类型
// ============================================================================

/**
 * 任务类型枚举
 */
export type JobType =
  | "FETCH_METADATA"
  | "GENERATE_EMBEDDING"
  | "AUTO_CLASSIFY"
  | "DEEP_CRAWL"
  | "CLEANUP_TRASH"
  | "VALIDATE_LINKS"
  | "PROFILE_UPDATE"
  | "BATCH_IMPORT"
  | "SEND_NOTIFICATION";

/**
 * 任务状态枚举
 */
export type JobStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

// ============================================================================
// 任务定义
// ============================================================================

/**
 * JSON 兼容的 payload 类型
 */
export type JobPayload = Record<string, Json | undefined>;

/**
 * 任务定义（用于生产者）
 */
export interface TaskDefinition<TPayload extends JobPayload = JobPayload> {
  /** 任务类型 */
  type: JobType;
  /** 任务载荷 */
  payload: TPayload;
  /** 优先级 1-100，越小优先级越高 */
  priority?: number;
  /** 依赖的前置任务类型 */
  dependsOn?: JobType;
  /** 计划执行时间 */
  scheduledFor?: Date;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 关联的书签 ID */
  bookmarkId?: number;
}

/**
 * 任务记录（数据库行）
 */
export interface JobRecord {
  id: string;
  type: JobType;
  payload: Json;
  status: JobStatus;
  priority: number;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  depends_on: string | null;
  user_id: string;
  bookmark_id: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  scheduled_for: string;
  locked_by: string | null;
  locked_at: string | null;
  result: Json | null;
}

// ============================================================================
// 消费者上下文
// ============================================================================

/**
 * 任务执行上下文
 */
export interface JobContext {
  /** 任务 ID */
  jobId: string;
  /** 任务类型 */
  type: JobType;
  /** 任务载荷 */
  payload: Json;
  /** 用户 ID */
  userId: string;
  /** 关联书签 ID */
  bookmarkId: number | null;
  /** 当前重试次数 */
  retryCount: number;
  /** Supabase 客户端 */
  supabase: SupabaseClient<Database>;
  /** 中止信号 */
  abortSignal?: AbortSignal;
}

/**
 * 任务执行结果
 */
export interface JobResult<T = unknown> {
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  data?: T;
  /** 错误信息 */
  error?: string;
  /** 元数据 */
  metadata?: {
    /** 执行耗时（毫秒） */
    executionTimeMs: number;
    /** 影响的记录数 */
    affectedCount?: number;
    /** 警告信息 */
    warnings?: string[];
  };
}

// ============================================================================
// 任务载荷类型
// ============================================================================

/**
 * 元数据获取任务载荷
 */
export interface FetchMetadataPayload {
  bookmarkId: number;
  url: string;
  /** 是否强制刷新 */
  force?: boolean;
}

/**
 * 向量生成任务载荷
 */
export interface GenerateEmbeddingPayload {
  bookmarkId: number;
  /** 要嵌入的文本（可选，默认从书签获取） */
  text?: string;
}

/**
 * 自动分类任务载荷
 */
export interface AutoClassifyPayload {
  bookmarkId: number;
  /** 是否自动应用分类 */
  autoApply?: boolean;
}

/**
 * 批量导入任务载荷
 */
export interface BatchImportPayload {
  /** 导入来源 */
  source: "browser" | "api" | "file";
  /** 要导入的 URL 列表 */
  urls: string[];
  /** 目标文件夹 ID */
  folderId?: number;
  /** 默认标签 */
  tags?: string[];
}

/**
 * 链接验证任务载荷
 */
export interface ValidateLinksPayload {
  /** 书签 ID 列表（为空则验证所有） */
  bookmarkIds?: number[];
  /** 验证超时（毫秒） */
  timeout?: number;
}

// ============================================================================
// 任务统计
// ============================================================================

/**
 * 任务统计
 */
export interface JobStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

// ============================================================================
// 消费者配置
// ============================================================================

/**
 * 消费者配置
 */
export interface ConsumerConfig {
  /** 消费者名称 */
  name: string;
  /** 处理的任务类型 */
  jobTypes: JobType[];
  /** 轮询间隔（毫秒） */
  pollIntervalMs?: number;
  /** 每次批量获取的任务数 */
  batchSize?: number;
  /** 锁超时时间（毫秒） */
  lockTimeoutMs?: number;
  /** 并发处理数 */
  concurrency?: number;
}

/**
 * 消费者默认配置
 */
export const DEFAULT_CONSUMER_CONFIG: Required<
  Omit<ConsumerConfig, "name" | "jobTypes">
> = {
  pollIntervalMs: 5000,
  batchSize: 5,
  lockTimeoutMs: 5 * 60 * 1000, // 5 分钟
  concurrency: 3,
};
