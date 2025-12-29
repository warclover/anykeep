/**
 * Task Producer
 *
 * 任务生产者 - 负责将任务推送到队列
 *
 * @module jobs/producers
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createLogger } from "@/lib/logger";
import type { TaskDefinition, JobType, JobRecord } from "../types";

const logger = createLogger("TaskProducer");

/**
 * 任务生产者
 *
 * 负责将任务推送到 system_jobs 表
 *
 * @example
 * ```typescript
 * const producer = new TaskProducer(supabase);
 *
 * // 生产单个任务
 * const jobId = await producer.produce({
 *   type: "FETCH_METADATA",
 *   payload: { bookmarkId: 123, url: "https://example.com" },
 * }, userId);
 *
 * // 生产批量任务（带依赖）
 * const jobIds = await producer.produceBatch([
 *   { type: "FETCH_METADATA", payload: { bookmarkId: 123 } },
 *   { type: "GENERATE_EMBEDDING", payload: { bookmarkId: 123 }, dependsOn: "FETCH_METADATA" },
 *   { type: "AUTO_CLASSIFY", payload: { bookmarkId: 123 }, dependsOn: "GENERATE_EMBEDDING" },
 * ], userId);
 * ```
 */
export class TaskProducer {
  private readonly supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 生产单个任务
   */
  async produce(task: TaskDefinition, userId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from("system_jobs")
      .insert({
        type: task.type,
        payload: task.payload,
        priority: task.priority ?? 10,
        max_retries: task.maxRetries ?? 3,
        scheduled_for:
          task.scheduledFor?.toISOString() ?? new Date().toISOString(),
        user_id: userId,
        bookmark_id:
          task.bookmarkId ?? (task.payload.bookmarkId as number | undefined),
      })
      .select("id")
      .single();

    if (error) {
      logger.error({ error, task, userId }, "Failed to produce task");
      throw error;
    }

    logger.info({ jobId: data.id, type: task.type, userId }, "Task produced");
    return data.id;
  }

  /**
   * 生产批量任务（支持依赖关系）
   *
   * 任务按依赖顺序排序后逐个插入，确保依赖关系正确建立
   */
  async produceBatch(
    tasks: TaskDefinition[],
    userId: string,
  ): Promise<string[]> {
    if (tasks.length === 0) return [];

    const jobIds: string[] = [];
    const typeToJobId = new Map<JobType, string>();

    // 按依赖顺序排序
    const sorted = this.topologicalSort(tasks);

    for (const task of sorted) {
      let dependsOnId: string | undefined;

      // 解析依赖
      if (task.dependsOn && typeToJobId.has(task.dependsOn)) {
        dependsOnId = typeToJobId.get(task.dependsOn);
      }

      const { data, error } = await this.supabase
        .from("system_jobs")
        .insert({
          type: task.type,
          payload: task.payload,
          priority: task.priority ?? 10,
          max_retries: task.maxRetries ?? 3,
          scheduled_for:
            task.scheduledFor?.toISOString() ?? new Date().toISOString(),
          depends_on: dependsOnId,
          user_id: userId,
          bookmark_id:
            task.bookmarkId ?? (task.payload.bookmarkId as number | undefined),
        })
        .select("id")
        .single();

      if (error) {
        logger.error({ error, task, userId }, "Failed to produce batch task");
        // 继续处理其他任务
        continue;
      }

      jobIds.push(data.id);
      typeToJobId.set(task.type, data.id);
    }

    logger.info({ count: jobIds.length, userId }, "Batch tasks produced");
    return jobIds;
  }

  /**
   * 为书签创建标准处理流水线
   *
   * 创建 FETCH_METADATA → GENERATE_EMBEDDING → AUTO_CLASSIFY 任务链
   */
  async produceBookmarkPipeline(
    bookmarkId: number,
    url: string,
    userId: string,
    options?: {
      priority?: number;
      autoClassify?: boolean;
    },
  ): Promise<string[]> {
    const { priority = 10, autoClassify = true } = options ?? {};

    const tasks: TaskDefinition[] = [
      {
        type: "FETCH_METADATA",
        payload: { bookmarkId, url },
        priority,
        bookmarkId,
      },
      {
        type: "GENERATE_EMBEDDING",
        payload: { bookmarkId },
        priority,
        dependsOn: "FETCH_METADATA",
        bookmarkId,
      },
    ];

    if (autoClassify) {
      tasks.push({
        type: "AUTO_CLASSIFY",
        payload: { bookmarkId, autoApply: true },
        priority,
        dependsOn: "GENERATE_EMBEDDING",
        bookmarkId,
      });
    }

    return this.produceBatch(tasks, userId);
  }

  /**
   * 调度延迟任务
   */
  async scheduleTask(
    task: TaskDefinition,
    userId: string,
    delayMs: number,
  ): Promise<string> {
    const scheduledFor = new Date(Date.now() + delayMs);
    return this.produce({ ...task, scheduledFor }, userId);
  }

  /**
   * 获取用户的待处理任务数
   */
  async getPendingCount(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("system_jobs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "PENDING");

    if (error) {
      logger.error({ error, userId }, "Failed to get pending count");
      return 0;
    }

    return count ?? 0;
  }

  /**
   * 获取书签的任务状态
   */
  async getBookmarkJobStatus(
    bookmarkId: number,
    userId: string,
  ): Promise<JobRecord[]> {
    const { data, error } = await this.supabase
      .from("system_jobs")
      .select("*")
      .eq("bookmark_id", bookmarkId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      logger.error(
        { error, bookmarkId, userId },
        "Failed to get bookmark job status",
      );
      return [];
    }

    return (data ?? []) as unknown as JobRecord[];
  }

  /**
   * 取消任务
   */
  async cancelTask(jobId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.supabase.rpc("cancel_job", {
      p_job_id: jobId,
      p_user_id: userId,
    });

    if (error) {
      logger.error({ error, jobId, userId }, "Failed to cancel task");
      return false;
    }

    return data as boolean;
  }

  /**
   * 拓扑排序（处理依赖关系）
   */
  private topologicalSort(tasks: TaskDefinition[]): TaskDefinition[] {
    const graph = new Map<JobType, TaskDefinition>();
    const inDegree = new Map<JobType, number>();
    const result: TaskDefinition[] = [];

    // 初始化
    for (const task of tasks) {
      graph.set(task.type, task);
      if (!inDegree.has(task.type)) {
        inDegree.set(task.type, 0);
      }
    }

    // 计算入度
    for (const task of tasks) {
      if (task.dependsOn && graph.has(task.dependsOn)) {
        inDegree.set(task.type, (inDegree.get(task.type) || 0) + 1);
      }
    }

    // BFS 拓扑排序
    const queue = tasks.filter((t) => (inDegree.get(t.type) || 0) === 0);

    while (queue.length > 0) {
      const task = queue.shift()!;
      result.push(task);

      for (const t of tasks) {
        if (t.dependsOn === task.type) {
          const degree = (inDegree.get(t.type) || 1) - 1;
          inDegree.set(t.type, degree);
          if (degree === 0) {
            queue.push(t);
          }
        }
      }
    }

    // 如果有循环依赖，添加剩余任务
    if (result.length < tasks.length) {
      logger.warn({ tasks }, "Circular dependency detected in tasks");
      for (const task of tasks) {
        if (!result.includes(task)) {
          result.push(task);
        }
      }
    }

    return result;
  }
}
