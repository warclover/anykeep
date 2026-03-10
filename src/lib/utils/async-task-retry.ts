/**
 * V4.2.7: 异步任务重试工具
 *
 * 提供带重试功能的异步任务执行机制
 * 失败时自动入队到 job_queue 进行重试
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import { logger } from "@/lib/logger";
import { jobQueueService } from "@/lib/job-queue";
import type {
  JobQueueType,
  Json,
} from "@/lib/classification-v2/types/legacy-compat";

/**
 * 异步任务配置
 */
export interface AsyncTaskConfig {
  /** 任务类型（用于 job_queue） */
  jobType: JobQueueType;
  /** 用户 ID */
  userId: string;
  /** 任务载荷（用于重试） */
  payload: Json;
  /** 任务优先级（默认 0） */
  priority?: number;
  /** 最大立即重试次数（默认 1，即不立即重试） */
  maxImmediateRetries?: number;
  /** 是否在失败时入队（默认 true） */
  enqueueOnFailure?: boolean;
}

/**
 * 任务执行结果
 */
export interface TaskResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  enqueuedJobId?: string;
}

/**
 * 执行带重试的异步任务
 *
 * 工作流程：
 * 1. 立即尝试执行任务
 * 2. 如果失败且配置了立即重试，则重试指定次数
 * 3. 如果最终失败且 enqueueOnFailure=true，则入队到 job_queue
 *
 * @param taskFn 要执行的异步任务函数
 * @param config 任务配置
 * @returns 任务执行结果
 *
 * @example
 * ```typescript
 * const result = await executeWithRetry(
 *   () => generateAIContent(bookmarkId),
 *   {
 *     jobType: 'generate_ai_content',
 *     userId: user.id,
 *     payload: { bookmarkId, url },
 *   }
 * );
 *
 * if (!result.success && result.enqueuedJobId) {
 *   logger.info(`Task enqueued for retry: ${result.enqueuedJobId}`);
 * }
 * ```
 */
export async function executeWithRetry<T>(
  taskFn: () => Promise<T>,
  config: AsyncTaskConfig,
): Promise<TaskResult<T>> {
  const {
    jobType,
    userId,
    payload,
    priority = 0,
    maxImmediateRetries = 1,
    enqueueOnFailure = true,
  } = config;

  let lastError: Error | null = null;

  // 立即重试逻辑
  for (let attempt = 0; attempt < maxImmediateRetries; attempt++) {
    try {
      const data = await taskFn();
      return { success: true, data };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(
        {
          jobType,
          attempt: attempt + 1,
          maxAttempts: maxImmediateRetries,
          error: lastError.message,
        },
        "AsyncTaskRetry: Immediate attempt failed",
      );

      // 如果不是最后一次重试，等待一小段时间
      if (attempt < maxImmediateRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 100 * (attempt + 1)),
        );
      }
    }
  }

  // 所有立即重试都失败了
  const errorMessage = lastError?.message || "Unknown error";

  // 入队到 job_queue 进行后台重试
  if (enqueueOnFailure) {
    try {
      const jobId = await jobQueueService.enqueue(userId, jobType, payload, {
        priority,
        maxAttempts: 3,
      });

      if (jobId) {
        logger.info(
          {
            jobType,
            jobId,
            payload,
            originalError: errorMessage,
          },
          "AsyncTaskRetry: Task enqueued for background retry",
        );

        return {
          success: false,
          error: errorMessage,
          enqueuedJobId: jobId,
        };
      }
    } catch (enqueueError) {
      logger.error(
        {
          jobType,
          error:
            enqueueError instanceof Error
              ? enqueueError.message
              : String(enqueueError),
          originalError: errorMessage,
        },
        "AsyncTaskRetry: Failed to enqueue task",
      );
    }
  }

  return {
    success: false,
    error: errorMessage,
  };
}

/**
 * 执行不阻塞的异步任务（fire-and-forget 但带重试）
 *
 * 与 executeWithRetry 类似，但不等待结果
 * 适用于不需要立即知道结果的后台任务
 *
 * @param taskFn 要执行的异步任务函数
 * @param config 任务配置
 * @param onComplete 可选的完成回调
 */
export function executeInBackground<T>(
  taskFn: () => Promise<T>,
  config: AsyncTaskConfig,
  onComplete?: (result: TaskResult<T>) => void,
): void {
  executeWithRetry(taskFn, config)
    .then((result) => {
      if (onComplete) {
        onComplete(result);
      } else if (!result.success) {
        logger.warn(
          {
            jobType: config.jobType,
            error: result.error,
            enqueuedJobId: result.enqueuedJobId,
          },
          "AsyncTaskRetry: Background task failed",
        );
      }
    })
    .catch((error) => {
      logger.error(
        {
          jobType: config.jobType,
          error: error instanceof Error ? error.message : String(error),
        },
        "AsyncTaskRetry: Unexpected error in background task",
      );
    });
}

/**
 * 用于书签创建后的 AI 任务链
 * 封装了常见的任务配置
 */
export const bookmarkAITasks = {
  /**
   * 执行 AI 内容生成（带重试）
   */
  generateContent: (
    taskFn: () => Promise<void>,
    userId: string,
    bookmarkId: number,
    url: string,
  ) =>
    executeInBackground(taskFn, {
      jobType: "generate_ai_content",
      userId,
      payload: { bookmarkId, url },
      priority: 5, // 中等优先级
    }),

  /**
   * 执行向量嵌入生成（带重试）
   */
  generateEmbedding: (
    taskFn: () => Promise<void>,
    userId: string,
    bookmarkId: number,
  ) =>
    executeInBackground(taskFn, {
      jobType: "generate_embedding",
      userId,
      payload: { bookmarkId },
      priority: 3, // 较低优先级
    }),

  /**
   * 执行书签分类（带重试）
   */
  classifyBookmark: (
    taskFn: () => Promise<void>,
    userId: string,
    bookmarkId: number,
  ) =>
    executeInBackground(taskFn, {
      jobType: "classify_bookmark",
      userId,
      payload: { bookmarkId },
      priority: 7, // 较高优先级
    }),
};
