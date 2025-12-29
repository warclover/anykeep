/**
 * Task Producer
 *
 * 任务生产者，负责创建和入队异步任务
 *
 * @module services/jobs/task-producer
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";
import type {
  JobType,
  JobPriority,
  CreateJobRequest,
  Job,
  DbJobType,
  DbJobStatus,
} from "./types";
import { toDbType, fromDbType, fromDbStatus } from "./types";

const logger = createLogger("task-producer");

/**
 * 默认优先级映射
 */
const DEFAULT_PRIORITIES: Record<JobType, JobPriority> = {
  fetch_metadata: 5,
  generate_embedding: 5,
  auto_classify: 4,
  deep_crawl: 6,
  cleanup_trash: 8,
  validate_links: 7,
  profile_update: 6,
  batch_import: 3,
  send_notification: 2,
};

/**
 * 默认重试次数映射
 */
const DEFAULT_MAX_RETRIES: Record<JobType, number> = {
  fetch_metadata: 2,
  generate_embedding: 3,
  auto_classify: 2,
  deep_crawl: 1,
  cleanup_trash: 1,
  validate_links: 1,
  profile_update: 2,
  batch_import: 2,
  send_notification: 3,
};

/**
 * 任务生产者类
 */
export class TaskProducer {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * 创建单个任务
   */
  async createJob<TPayload>(
    request: CreateJobRequest<TPayload>,
  ): Promise<Job<TPayload>> {
    const {
      type,
      userId,
      payload,
      priority,
      maxRetries,
      bookmarkId,
      scheduledFor,
      dependsOn,
    } = request;

    const jobData = {
      type: toDbType(type),
      user_id: userId,
      payload,
      priority: priority ?? DEFAULT_PRIORITIES[type],
      max_retries: maxRetries ?? DEFAULT_MAX_RETRIES[type],
      status: "PENDING" as const,
      bookmark_id: bookmarkId,
      scheduled_for: scheduledFor?.toISOString() ?? new Date().toISOString(),
      depends_on: dependsOn,
    };

    const { data, error } = await this.supabase
      .from("system_jobs")
      .insert(jobData)
      .select()
      .single();

    if (error) {
      logger.error({ error, type, userId }, "Failed to create job");
      throw error;
    }

    logger.info({ jobId: data.id, type }, "Job created");

    return this.mapToJob<TPayload>(data);
  }

  /**
   * 批量创建任务
   */
  async createJobs<TPayload>(
    requests: CreateJobRequest<TPayload>[],
  ): Promise<Job<TPayload>[]> {
    if (requests.length === 0) {
      return [];
    }

    const jobsData = requests.map((request) => ({
      type: toDbType(request.type),
      user_id: request.userId,
      payload: request.payload,
      priority: request.priority ?? DEFAULT_PRIORITIES[request.type],
      max_retries: request.maxRetries ?? DEFAULT_MAX_RETRIES[request.type],
      status: "PENDING" as const,
      bookmark_id: request.bookmarkId,
      scheduled_for:
        request.scheduledFor?.toISOString() ?? new Date().toISOString(),
      depends_on: request.dependsOn,
    }));

    const { data, error } = await this.supabase
      .from("system_jobs")
      .insert(jobsData)
      .select();

    if (error) {
      logger.error(
        { error, count: requests.length },
        "Failed to create batch jobs",
      );
      throw error;
    }

    logger.info({ count: data.length }, "Batch jobs created");

    return data.map((row) => this.mapToJob<TPayload>(row));
  }

  /**
   * 获取任务状态
   */
  async getJobStatus(jobId: string): Promise<Job | null> {
    const { data, error } = await this.supabase
      .from("system_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error({ error, jobId }, "Failed to get job status");
      throw error;
    }

    return this.mapToJob(data);
  }

  /**
   * 获取用户的任务列表
   */
  async getUserJobs(
    userId: string,
    options?: {
      status?: string[];
      type?: JobType[];
      limit?: number;
      offset?: number;
    },
  ): Promise<{ jobs: Job[]; total: number }> {
    let query = this.supabase
      .from("system_jobs")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (options?.status?.length) {
      // 转换为数据库大写格式
      const dbStatuses = options.status.map((s) => s.toUpperCase());
      query = query.in("status", dbStatuses);
    }

    if (options?.type?.length) {
      // 转换为数据库大写格式
      const dbTypes = options.type.map((t) => toDbType(t));
      query = query.in("type", dbTypes);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 20) - 1,
      );
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error({ error, userId }, "Failed to get user jobs");
      throw error;
    }

    return {
      jobs: (data || []).map((row) => this.mapToJob(row)),
      total: count || 0,
    };
  }

  /**
   * 取消任务 (使用 RPC 函数)
   */
  async cancelJob(jobId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.supabase.rpc("cancel_job", {
      p_job_id: jobId,
      p_user_id: userId,
    });

    if (error) {
      logger.error({ error, jobId }, "Failed to cancel job");
      throw error;
    }

    const cancelled = data === true;
    if (cancelled) {
      logger.info({ jobId }, "Job cancelled");
    }

    return cancelled;
  }

  /**
   * 映射数据库行到 Job 类型
   */
  private mapToJob<TPayload = unknown, TResult = unknown>(
    row: Record<string, unknown>,
  ): Job<TPayload, TResult> {
    return {
      id: row.id as string,
      type: fromDbType(row.type as DbJobType),
      status: fromDbStatus(row.status as DbJobStatus),
      priority: row.priority as JobPriority,
      userId: row.user_id as string,
      payload: row.payload as TPayload,
      result: row.result as TResult | undefined,
      error: row.last_error as string | undefined,
      retryCount: row.retry_count as number,
      maxRetries: row.max_retries as number,
      startedAt: row.started_at
        ? new Date(row.started_at as string)
        : undefined,
      completedAt: row.completed_at
        ? new Date(row.completed_at as string)
        : undefined,
      scheduledFor: row.scheduled_for
        ? new Date(row.scheduled_for as string)
        : undefined,
      createdAt: new Date(row.created_at as string),
    };
  }
}
