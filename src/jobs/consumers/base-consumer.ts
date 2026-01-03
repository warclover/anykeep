/**
 * Base Consumer
 *
 * 任务消费者基类 - 负责从队列获取并处理任务
 *
 * @module jobs/consumers
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createLogger } from "@/lib/logger";
import type {
  JobType,
  JobContext,
  JobResult,
  JobRecord,
  ConsumerConfig,
} from "../types";

/**
 * 任务消费者基类
 *
 * 提供任务获取、执行、完成的通用逻辑
 * 子类只需实现 execute 方法
 *
 * @example
 * ```typescript
 * class MetadataConsumer extends BaseConsumer {
 *   constructor(supabase: SupabaseClient<Database>) {
 *     super(supabase, {
 *       name: "MetadataConsumer",
 *       jobTypes: ["FETCH_METADATA"],
 *     });
 *   }
 *
 *   protected async execute(context: JobContext): Promise<JobResult> {
 *     // 实现具体逻辑
 *   }
 * }
 * ```
 */
export abstract class BaseConsumer {
  protected readonly supabase: SupabaseClient<Database>;
  protected readonly logger: ReturnType<typeof createLogger>;
  protected readonly workerId: string;
  protected readonly config: Required<ConsumerConfig>;

  private isRunning = false;
  private abortController: AbortController | null = null;

  constructor(supabase: SupabaseClient<Database>, config: ConsumerConfig) {
    this.supabase = supabase;
    this.config = {
      ...{
        pollIntervalMs: 5000,
        batchSize: 5,
        lockTimeoutMs: 5 * 60 * 1000,
        concurrency: 3,
      },
      ...config,
    };
    this.workerId = `${config.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.logger = createLogger(config.name);
  }

  /**
   * 启动消费者（持续运行模式）
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn("Consumer already running");
      return;
    }

    this.isRunning = true;
    this.abortController = new AbortController();
    this.logger.info({ workerId: this.workerId }, "Consumer started");

    while (this.isRunning) {
      try {
        await this.pollAndProcess();
      } catch (error) {
        this.logger.error({ error }, "Poll error");
      }

      if (this.isRunning) {
        await this.sleep(this.config.pollIntervalMs);
      }
    }

    this.logger.info("Consumer stopped");
  }

  /**
   * 停止消费者
   */
  stop(): void {
    this.isRunning = false;
    this.abortController?.abort();
    this.logger.info("Consumer stopping");
  }

  /**
   * 处理单批次任务（用于 Cron 触发）
   */
  async processBatch(limit?: number): Promise<number> {
    const batchSize = limit ?? this.config.batchSize;

    try {
      const jobs = await this.claimJobs(batchSize);

      if (jobs.length === 0) {
        return 0;
      }

      this.logger.info({ count: jobs.length }, "Processing batch");

      // 并发处理（受 concurrency 限制）
      const results = await this.processWithConcurrency(
        jobs,
        this.config.concurrency,
      );

      const successCount = results.filter(
        (r) => r.status === "fulfilled",
      ).length;
      this.logger.info(
        { total: jobs.length, success: successCount },
        "Batch completed",
      );

      return jobs.length;
    } catch (error) {
      this.logger.error({ error }, "Batch processing error");
      return 0;
    }
  }

  /**
   * 子类实现具体执行逻辑
   */
  protected abstract execute(context: JobContext): Promise<JobResult>;

  /**
   * 拉取并处理任务
   */
  private async pollAndProcess(): Promise<void> {
    const jobs = await this.claimJobs(this.config.batchSize);

    if (jobs.length === 0) {
      return;
    }

    this.logger.debug({ count: jobs.length }, "Claimed jobs");

    await this.processWithConcurrency(jobs, this.config.concurrency);
  }

  /**
   * 获取任务
   */
  private async claimJobs(limit: number): Promise<JobRecord[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase.rpc as any)("claim_jobs_batch", {
      p_worker_id: this.workerId,
      p_job_types: this.config.jobTypes,
      p_limit: limit,
      p_lock_duration: `${this.config.lockTimeoutMs / 1000} seconds`,
    });

    if (error) {
      this.logger.error({ error }, "Failed to claim jobs");
      return [];
    }

    return (data ?? []) as unknown as JobRecord[];
  }

  /**
   * 并发处理任务
   */
  private async processWithConcurrency(
    jobs: JobRecord[],
    concurrency: number,
  ): Promise<PromiseSettledResult<void>[]> {
    const results: PromiseSettledResult<void>[] = [];

    // 分批并发处理
    for (let i = 0; i < jobs.length; i += concurrency) {
      const batch = jobs.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map((job) => this.processJob(job)),
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 处理单个任务
   */
  private async processJob(job: JobRecord): Promise<void> {
    const startTime = Date.now();

    const context: JobContext = {
      jobId: job.id,
      type: job.type as JobType,
      payload: job.payload,
      userId: job.user_id,
      bookmarkId: job.bookmark_id,
      retryCount: job.retry_count,
      supabase: this.supabase,
      abortSignal: this.abortController?.signal,
    };

    try {
      this.logger.info({ jobId: job.id, type: job.type }, "Processing job");

      const result = await this.execute(context);

      if (result.success) {
        await this.completeJob(job.id, true, undefined, result.data);
        this.logger.info(
          {
            jobId: job.id,
            duration: Date.now() - startTime,
          },
          "Job completed",
        );
      } else {
        await this.completeJob(job.id, false, result.error);
        this.logger.warn(
          {
            jobId: job.id,
            error: result.error,
            retryCount: job.retry_count,
          },
          "Job failed",
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      this.logger.error(
        {
          jobId: job.id,
          error: errorMessage,
          retryCount: job.retry_count,
        },
        "Job execution error",
      );

      await this.completeJob(job.id, false, errorMessage);
    }
  }

  /**
   * 完成任务
   */
  private async completeJob(
    jobId: string,
    success: boolean,
    error?: string,
    result?: unknown,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (this.supabase.rpc as any)("complete_job", {
      p_job_id: jobId,
      p_success: success,
      p_error: error ?? null,
      p_result: result ? JSON.parse(JSON.stringify(result)) : null,
    });

    if (rpcError) {
      this.logger.error({ error: rpcError, jobId }, "Failed to complete job");
    }
  }

  /**
   * 辅助：延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
