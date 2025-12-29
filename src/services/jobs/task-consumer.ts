/**
 * Task Consumer
 *
 * 任务消费者，负责从队列中获取并处理任务
 *
 * @module services/jobs/task-consumer
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";
import type { JobType, ClaimedJob, JobProcessor, DbJobType } from "./types";
import { fromDbType, toDbType } from "./types";

const logger = createLogger("task-consumer");

/**
 * 任务消费者配置
 */
export interface TaskConsumerConfig {
  /** 工作者 ID */
  workerId: string;
  /** 要处理的任务类型 */
  jobTypes?: JobType[];
  /** 轮询间隔 (毫秒) */
  pollInterval?: number;
  /** 锁持续时间 (分钟) */
  lockDurationMinutes?: number;
  /** 批量获取数量 */
  batchSize?: number;
}

/**
 * 任务消费者类
 */
export class TaskConsumer {
  private supabase: SupabaseClient;
  private config: Required<TaskConsumerConfig>;
  private processors: Map<JobType, JobProcessor> = new Map();
  private isRunning = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(supabase: SupabaseClient, config: TaskConsumerConfig) {
    this.supabase = supabase;
    this.config = {
      workerId: config.workerId,
      jobTypes: config.jobTypes ?? [],
      pollInterval: config.pollInterval ?? 5000,
      lockDurationMinutes: config.lockDurationMinutes ?? 5,
      batchSize: config.batchSize ?? 1,
    };
  }

  /**
   * 注册任务处理器
   */
  registerProcessor(processor: JobProcessor): void {
    this.processors.set(processor.type, processor);
    logger.info({ type: processor.type }, "Processor registered");
  }

  /**
   * 启动消费者
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("Consumer already running");
      return;
    }

    this.isRunning = true;
    logger.info({ workerId: this.config.workerId }, "Consumer started");
    this.poll();
  }

  /**
   * 停止消费者
   */
  stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    logger.info({ workerId: this.config.workerId }, "Consumer stopped");
  }

  /**
   * 轮询任务
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const jobs = await this.claimJobs();

      if (jobs.length > 0) {
        await Promise.all(jobs.map((job) => this.processJob(job)));
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Poll error",
      );
    }

    // 调度下一次轮询
    if (this.isRunning) {
      this.pollTimer = setTimeout(() => this.poll(), this.config.pollInterval);
    }
  }

  /**
   * 领取任务
   */
  private async claimJobs(): Promise<ClaimedJob[]> {
    const dbJobTypes =
      this.config.jobTypes.length > 0
        ? this.config.jobTypes.map((t) => toDbType(t))
        : null;

    // 使用数据库中已有的 claim_next_job 或 claim_jobs_batch RPC
    if (this.config.batchSize === 1) {
      const { data, error } = await this.supabase.rpc("claim_next_job", {
        p_worker_id: this.config.workerId,
        p_job_types: dbJobTypes,
        p_lock_duration: `${this.config.lockDurationMinutes} minutes`,
      });

      if (error) {
        logger.error({ error }, "Failed to claim job");
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((row: Record<string, unknown>) => ({
        jobId: row.id as string,
        jobType: fromDbType(row.type as DbJobType),
        jobPayload: row.payload,
        jobRetryCount: row.retry_count as number,
      }));
    } else {
      const { data, error } = await this.supabase.rpc("claim_jobs_batch", {
        p_worker_id: this.config.workerId,
        p_job_types: dbJobTypes,
        p_limit: this.config.batchSize,
        p_lock_duration: `${this.config.lockDurationMinutes} minutes`,
      });

      if (error) {
        logger.error({ error }, "Failed to claim jobs batch");
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((row: Record<string, unknown>) => ({
        jobId: row.id as string,
        jobType: fromDbType(row.type as DbJobType),
        jobPayload: row.payload,
        jobRetryCount: row.retry_count as number,
      }));
    }
  }

  /**
   * 处理单个任务
   */
  private async processJob(job: ClaimedJob): Promise<void> {
    const processor = this.processors.get(job.jobType);

    if (!processor) {
      logger.warn(
        { jobId: job.jobId, type: job.jobType },
        "No processor found for job type",
      );
      // 标记为失败
      await this.completeJob(
        job.jobId,
        false,
        "No processor registered for this job type",
      );
      return;
    }

    try {
      logger.info({ jobId: job.jobId, type: job.jobType }, "Processing job");

      const result = await processor.process(job);

      await this.completeJob(job.jobId, true, undefined, result);

      logger.info(
        { jobId: job.jobId, type: job.jobType },
        "Job completed successfully",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        { jobId: job.jobId, type: job.jobType, error: errorMessage },
        "Job processing failed",
      );

      await this.completeJob(job.jobId, false, errorMessage);
    }
  }

  /**
   * 完成任务
   */
  private async completeJob(
    jobId: string,
    success: boolean,
    errorMessage?: string,
    result?: unknown,
  ): Promise<void> {
    const { error } = await this.supabase.rpc("complete_job", {
      p_job_id: jobId,
      p_success: success,
      p_error: errorMessage ?? null,
      p_result: result ?? null,
    });

    if (error) {
      logger.error({ error, jobId }, "Failed to complete job");
    }
  }
}
