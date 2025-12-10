/**
 * Job Queue Service (V4.2)
 * 异步任务队列管理服务
 *
 * 核心功能：
 * - 入队任务
 * - 领取任务（原子操作）
 * - 完成/失败任务
 * - 查询任务状态
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  JobQueueItem,
  JobQueueCreateParams,
  JobQueueType,
  JobStatus,
  Json,
} from "@/lib/classification/types";

/**
 * 任务领取结果
 */
export interface ClaimedJob {
  id: string;
  type: JobQueueType;
  payload: Json;
  userId: string;
  attempts: number;
}

/**
 * 任务统计
 */
export interface JobStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

/**
 * 任务队列查询选项
 */
export interface JobQueryOptions {
  type?: JobQueueType;
  status?: JobStatus | JobStatus[];
  limit?: number;
}

/**
 * 任务队列服务
 */
export class JobQueueService {
  private supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  > | null = null;
  private workerId: string;

  constructor(workerId?: string) {
    this.workerId =
      workerId ||
      `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 获取 Supabase 客户端（延迟初始化）
   */
  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createServerSupabaseClient();
    }
    return this.supabase;
  }

  /**
   * 入队新任务
   */
  async enqueue(
    userId: string,
    type: JobQueueType,
    payload: Json = {},
    options: {
      priority?: number;
      scheduledAt?: Date;
      maxAttempts?: number;
    } = {},
  ): Promise<string> {
    const supabase = await this.getSupabase();

    // 检查是否有相同的待执行任务（防重复）
    const hasPending = await this.hasPendingJob(userId, type, payload);
    if (hasPending) {
      logger.info({ type }, "JobQueueService: Duplicate job skipped");
      return ""; // 返回空字符串表示已存在
    }

    const jobData: JobQueueCreateParams = {
      user_id: userId,
      type,
      payload,
      priority: options.priority ?? 0,
      scheduled_at:
        options.scheduledAt?.toISOString() ?? new Date().toISOString(),
      max_attempts: options.maxAttempts ?? 3,
    };

    const { data, error } = await supabase
      .from("job_queue")
      .insert(jobData)
      .select("id")
      .single();

    if (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
          jobType: type,
          priority: options.priority ?? 0,
        },
        "[JobQueueService] Failed to enqueue job",
      );
      throw new Error(`任务入队失败: ${error.message}`);
    }

    return data.id;
  }

  /**
   * 检查是否有相同的待执行任务
   */
  async hasPendingJob(
    userId: string,
    type: JobQueueType,
    payload?: Json,
  ): Promise<boolean> {
    const supabase = await this.getSupabase();

    let query = supabase
      .from("job_queue")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("type", type)
      .eq("status", "pending");

    // 如果提供了 payload，进行完整匹配
    if (payload && Object.keys(payload).length > 0) {
      query = query.eq("payload", payload);
    }

    const { count, error } = await query;

    if (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
          jobType: type,
        },
        "[JobQueueService] Failed to check pending job",
      );
      return false;
    }

    return (count ?? 0) > 0;
  }

  /**
   * 领取下一个任务（原子操作）
   */
  async claimNextJob(
    jobTypes?: JobQueueType[],
    lockDurationMinutes: number = 5,
  ): Promise<ClaimedJob | null> {
    const supabase = await this.getSupabase();

    // 使用 RPC 函数实现原子领取
    const { data, error } = await supabase.rpc("claim_next_job", {
      p_worker_id: this.workerId,
      p_job_types: jobTypes as string[] | undefined,
      p_lock_duration: `${lockDurationMinutes} minutes`,
    });

    if (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          workerId: this.workerId,
          jobTypes,
          lockDurationMinutes,
        },
        "[JobQueueService] Failed to claim job",
      );
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const job = data[0];
    return {
      id: job.job_id,
      type: job.job_type as JobQueueType,
      payload: job.job_payload,
      userId: job.job_user_id,
      attempts: job.job_attempts,
    };
  }

  /**
   * 标记任务完成
   */
  async completeJob(jobId: string, result?: Json): Promise<boolean> {
    const supabase = await this.getSupabase();

    const { data, error } = await supabase.rpc("complete_job", {
      p_job_id: jobId,
      p_result: result ?? null,
    });

    if (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          jobId,
        },
        "[JobQueueService] Failed to complete job",
      );
      return false;
    }

    return data === true;
  }

  /**
   * 标记任务失败
   */
  async failJob(
    jobId: string,
    errorMessage: string,
    retry: boolean = true,
  ): Promise<boolean> {
    const supabase = await this.getSupabase();

    const { data, error } = await supabase.rpc("fail_job", {
      p_job_id: jobId,
      p_error: errorMessage,
      p_retry: retry,
    });

    if (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          jobId,
          errorMessage,
          retry,
        },
        "[JobQueueService] Failed to fail job",
      );
      return false;
    }

    return data === true;
  }

  /**
   * 取消任务
   */
  async cancelJob(userId: string, jobId: string): Promise<boolean> {
    const supabase = await this.getSupabase();

    const { error } = await supabase
      .from("job_queue")
      .update({ status: "cancelled" })
      .eq("id", jobId)
      .eq("user_id", userId)
      .eq("status", "pending");

    if (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
          jobId,
        },
        "[JobQueueService] Failed to cancel job",
      );
      return false;
    }

    return true;
  }

  /**
   * 获取用户的任务列表
   */
  async getUserJobs(
    userId: string,
    options: JobQueryOptions = {},
  ): Promise<JobQueueItem[]> {
    const supabase = await this.getSupabase();
    const { type, status, limit = 50 } = options;

    let query = supabase
      .from("job_queue")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (type) {
      query = query.eq("type", type);
    }

    if (status) {
      if (Array.isArray(status)) {
        query = query.in("status", status);
      } else {
        query = query.eq("status", status);
      }
    }

    const { data, error } = await query;

    if (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
          queryType: type,
          queryStatus: status,
          limit,
        },
        "[JobQueueService] Failed to get user jobs",
      );
      throw new Error(`获取任务列表失败: ${error.message}`);
    }

    return (data || []) as JobQueueItem[];
  }

  /**
   * 获取任务详情
   */
  async getJobById(
    userId: string,
    jobId: string,
  ): Promise<JobQueueItem | null> {
    const supabase = await this.getSupabase();

    const { data, error } = await supabase
      .from("job_queue")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
          jobId,
        },
        "[JobQueueService] Failed to get job",
      );
      throw new Error(`获取任务详情失败: ${error.message}`);
    }

    return data as JobQueueItem;
  }

  /**
   * 获取任务统计
   */
  async getJobStats(userId: string): Promise<JobStats> {
    const supabase = await this.getSupabase();

    const statuses: JobStatus[] = ["pending", "running", "completed", "failed"];
    const stats: JobStats = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
    };

    for (const status of statuses) {
      const { count, error } = await supabase
        .from("job_queue")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", status);

      if (!error && count !== null) {
        if (status === "running") {
          stats.running = count;
        } else {
          stats[status as keyof JobStats] = count;
        }
      }
    }

    return stats;
  }

  /**
   * 批量入队相同类型的任务（用于用户批量操作）
   */
  async enqueueBatch(
    userId: string,
    type: JobQueueType,
    payloads: Json[],
    options: {
      priority?: number;
      scheduledAt?: Date;
    } = {},
  ): Promise<string[]> {
    const supabase = await this.getSupabase();

    const jobsData: JobQueueCreateParams[] = payloads.map((payload) => ({
      user_id: userId,
      type,
      payload,
      priority: options.priority ?? 0,
      scheduled_at:
        options.scheduledAt?.toISOString() ?? new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("job_queue")
      .insert(jobsData)
      .select("id");

    if (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
          jobType: type,
          batchSize: payloads.length,
          priority: options.priority ?? 0,
        },
        "[JobQueueService] Failed to enqueue batch",
      );
      throw new Error(`批量任务入队失败: ${error.message}`);
    }

    return (data || []).map((job: { id: string }) => job.id);
  }

  /**
   * 清理旧任务（用于定时任务）
   */
  async cleanupOldJobs(daysOld: number = 7): Promise<number> {
    const supabase = await this.getSupabase();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await supabase
      .from("job_queue")
      .delete()
      .in("status", ["completed", "failed", "cancelled"])
      .lt("completed_at", cutoffDate.toISOString())
      .select("id");

    if (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          daysOld,
          cutoffDate: cutoffDate.toISOString(),
        },
        "[JobQueueService] Failed to cleanup",
      );
      return 0;
    }

    return data?.length ?? 0;
  }

  /**
   * 重置卡住的任务（用于定时任务）
   */
  async resetStuckJobs(): Promise<number> {
    const supabase = await this.getSupabase();

    const { data, error } = await supabase
      .from("job_queue")
      .update({
        status: "pending",
        lock_until: null,
        claimed_by: null,
      })
      .eq("status", "claimed")
      .lt("lock_until", new Date().toISOString())
      .select("id");

    if (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
        "[JobQueueService] Failed to reset stuck jobs",
      );
      return 0;
    }

    return data?.length ?? 0;
  }

  /**
   * 获取待执行任务数量
   */
  async getPendingCount(userId?: string, type?: JobQueueType): Promise<number> {
    const supabase = await this.getSupabase();

    let query = supabase
      .from("job_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    if (userId) {
      query = query.eq("user_id", userId);
    }

    if (type) {
      query = query.eq("type", type);
    }

    const { count, error } = await query;

    if (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
          jobType: type,
        },
        "[JobQueueService] Failed to get pending count",
      );
      return 0;
    }

    return count ?? 0;
  }
}

// 导出单例
export const jobQueueService = new JobQueueService();

// 导出便捷函数
export const enqueueJob = jobQueueService.enqueue.bind(jobQueueService);
