/**
 * Job Queue Types
 *
 * 异步任务队列类型定义
 * 匹配数据库 enum 类型（大写值）
 *
 * @module services/jobs/types
 */

/**
 * 数据库任务状态 (匹配 job_status enum)
 */
export type DbJobStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

/**
 * API 层任务状态 (小写，用于 API 响应)
 */
export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * 任务优先级 (1-100, 1 最高)
 */
export type JobPriority = number;

/**
 * 数据库任务类型 (匹配 job_type enum)
 */
export type DbJobType =
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
 * API 层任务类型 (小写，用于 API 请求/响应)
 */
export type JobType =
  | "fetch_metadata"
  | "generate_embedding"
  | "auto_classify"
  | "deep_crawl"
  | "cleanup_trash"
  | "validate_links"
  | "profile_update"
  | "batch_import"
  | "send_notification";

/**
 * 状态转换函数
 */
export function toDbStatus(status: JobStatus): DbJobStatus {
  return status.toUpperCase() as DbJobStatus;
}

export function fromDbStatus(status: DbJobStatus): JobStatus {
  return status.toLowerCase() as JobStatus;
}

/**
 * 类型转换函数
 */
export function toDbType(type: JobType): DbJobType {
  return type.toUpperCase() as DbJobType;
}

export function fromDbType(type: DbJobType): JobType {
  return type.toLowerCase() as JobType;
}

/**
 * 任务记录
 */
export interface Job<TPayload = unknown, TResult = unknown> {
  id: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  userId: string;
  payload: TPayload;
  result?: TResult;
  error?: string;
  retryCount: number;
  maxRetries: number;
  startedAt?: Date;
  completedAt?: Date;
  scheduledFor?: Date;
  createdAt: Date;
}

/**
 * 创建任务请求
 */
export interface CreateJobRequest<TPayload = unknown> {
  type: JobType;
  userId: string;
  payload: TPayload;
  priority?: JobPriority;
  maxRetries?: number;
  bookmarkId?: number;
  scheduledFor?: Date;
  dependsOn?: string;
}

/**
 * 领取任务响应
 */
export interface ClaimedJob<TPayload = unknown> {
  jobId: string;
  jobType: JobType;
  jobPayload: TPayload;
  jobRetryCount: number;
}

/**
 * 任务处理器接口
 */
export interface JobProcessor<TPayload = unknown, TResult = unknown> {
  type: JobType;
  process(job: ClaimedJob<TPayload>): Promise<TResult>;
}

/**
 * 任务队列事件
 */
export interface JobQueueEvents {
  jobCreated: (job: Job) => void;
  jobStarted: (job: ClaimedJob) => void;
  jobCompleted: (jobId: string, result: unknown) => void;
  jobFailed: (jobId: string, error: string) => void;
  jobRetried: (jobId: string, retryCount: number) => void;
}

/**
 * Embedding Generation 任务载荷
 */
export interface EmbeddingGenerationPayload {
  bookmarkId: number;
  content: string;
  model?: string;
}

/**
 * Content Fetch 任务载荷
 */
export interface ContentFetchPayload {
  bookmarkId: number;
  url: string;
  fetchMetadata?: boolean;
  fetchSnapshot?: boolean;
}

/**
 * Batch Classification 任务载荷
 */
export interface BatchClassificationPayload {
  bookmarkIds: number[];
  reclassify?: boolean;
}

/**
 * Export Generation 任务载荷
 */
export interface ExportGenerationPayload {
  format: "csv" | "json" | "html" | "markdown" | "obsidian";
  bookmarkIds?: number[];
  folderId?: number;
  includeArchived?: boolean;
}

/**
 * Synthesis Report 任务载荷
 */
export interface SynthesisReportPayload {
  bookmarkIds: number[];
  topic?: string;
  format?: "markdown" | "html";
}
