/**
 * 分发调度器
 *
 * @module distribution/core
 * @description 管理定时和实时触发的分发任务
 */

import type {
  IDistributionScheduler,
  IDistributionEventBus,
  ScheduledTask,
  SchedulerConfig,
  Unsubscribe,
} from "../interfaces";
import type { DistributionTarget, DistributionEvent } from "../types";
import type { DistributionService } from "./distribution.service";
import { logger } from "@/lib/logger";

/**
 * 调度器默认配置
 */
const DEFAULT_CONFIG: Required<SchedulerConfig> = {
  minIntervalMinutes: 5,
  maxConcurrentTasks: 3,
  taskTimeoutMs: 60000,
  retryCount: 3,
  retryDelayMs: 1000,
};

/**
 * 内部任务状态
 */
interface InternalTask extends ScheduledTask {
  intervalId?: ReturnType<typeof setInterval>;
  unsubscribe?: Unsubscribe;
  target: DistributionTarget;
}

/**
 * 分发调度器实现
 *
 * 管理定时触发和实时触发的分发任务
 *
 * @example
 * ```typescript
 * const scheduler = new DistributionScheduler(eventBus, service);
 * await scheduler.start();
 *
 * // 注册任务
 * await scheduler.register(target);
 *
 * // 手动触发
 * await scheduler.triggerNow(targetId);
 *
 * // 停止调度器
 * await scheduler.stop();
 * ```
 */
export class DistributionScheduler implements IDistributionScheduler {
  private readonly config: Required<SchedulerConfig>;
  private readonly tasks: Map<string, InternalTask> = new Map();
  private readonly runningTasks: Set<string> = new Set();
  private started = false;

  constructor(
    private readonly eventBus: IDistributionEventBus,
    private readonly service: DistributionService,
    config: SchedulerConfig = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 启动调度器
   */
  async start(): Promise<void> {
    if (this.started) {
      logger.warn("Scheduler already started");
      return;
    }

    this.started = true;
    logger.info("DistributionScheduler started");
  }

  /**
   * 停止调度器
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    // 清理所有任务
    for (const [targetId] of this.tasks) {
      await this.unregister(targetId);
    }

    this.started = false;
    logger.info("DistributionScheduler stopped");
  }

  /**
   * 注册调度任务
   */
  async register(target: DistributionTarget): Promise<void> {
    // 如果已存在，先注销
    if (this.tasks.has(target.id)) {
      await this.unregister(target.id);
    }

    const task: InternalTask = {
      id: `task-${target.id}`,
      targetId: target.id,
      userId: target.userId,
      status: "active",
      createdAt: new Date(),
      target,
    };

    // 根据触发模式配置任务
    switch (target.trigger.mode) {
      case "realtime":
        this.setupRealtimeTask(task);
        break;

      case "scheduled":
        this.setupScheduledTask(task);
        break;

      case "manual":
        // 手动模式不需要自动触发
        break;
    }

    this.tasks.set(target.id, task);

    logger.info(
      {
        targetId: target.id,
        mode: target.trigger.mode,
        intervalMinutes: target.trigger.scheduleIntervalMinutes,
      },
      "Scheduler: Task registered",
    );
  }

  /**
   * 注销调度任务
   */
  async unregister(targetId: string): Promise<void> {
    const task = this.tasks.get(targetId);
    if (!task) {
      return;
    }

    // 清理定时器
    if (task.intervalId) {
      clearInterval(task.intervalId);
    }

    // 清理事件订阅
    if (task.unsubscribe) {
      task.unsubscribe();
    }

    this.tasks.delete(targetId);
    this.runningTasks.delete(targetId);

    logger.info({ targetId }, "Scheduler: Task unregistered");
  }

  /**
   * 暂停任务
   */
  async pause(targetId: string): Promise<void> {
    const task = this.tasks.get(targetId);
    if (!task) {
      logger.warn({ targetId }, "Scheduler: Task not found for pause");
      return;
    }

    // 清理定时器
    if (task.intervalId) {
      clearInterval(task.intervalId);
      task.intervalId = undefined;
    }

    // 清理事件订阅
    if (task.unsubscribe) {
      task.unsubscribe();
      task.unsubscribe = undefined;
    }

    task.status = "paused";
    task.nextRunAt = undefined;

    logger.info({ targetId }, "Scheduler: Task paused");
  }

  /**
   * 恢复任务
   */
  async resume(targetId: string): Promise<void> {
    const task = this.tasks.get(targetId);
    if (!task) {
      logger.warn({ targetId }, "Scheduler: Task not found for resume");
      return;
    }

    if (task.status !== "paused") {
      logger.warn(
        { targetId, status: task.status },
        "Scheduler: Task not paused",
      );
      return;
    }

    // 重新设置任务
    switch (task.target.trigger.mode) {
      case "realtime":
        this.setupRealtimeTask(task);
        break;

      case "scheduled":
        this.setupScheduledTask(task);
        break;
    }

    task.status = "active";

    logger.info({ targetId }, "Scheduler: Task resumed");
  }

  /**
   * 立即触发执行
   */
  async triggerNow(targetId: string, bookmarkIds?: string[]): Promise<void> {
    const task = this.tasks.get(targetId);
    if (!task) {
      logger.warn({ targetId }, "Scheduler: Task not found for trigger");
      return;
    }

    await this.executeTask(task, bookmarkIds);
  }

  /**
   * 获取任务状态
   */
  getTask(targetId: string): ScheduledTask | undefined {
    const task = this.tasks.get(targetId);
    if (!task) {
      return undefined;
    }

    // 返回公开的任务信息（不含内部字段）
    return {
      id: task.id,
      targetId: task.targetId,
      userId: task.userId,
      status: task.status,
      nextRunAt: task.nextRunAt,
      lastRunAt: task.lastRunAt,
      lastResult: task.lastResult,
      createdAt: task.createdAt,
    };
  }

  /**
   * 获取用户的所有任务
   */
  getTasksByUser(userId: string): ScheduledTask[] {
    const userTasks: ScheduledTask[] = [];

    for (const task of this.tasks.values()) {
      if (task.userId === userId) {
        userTasks.push({
          id: task.id,
          targetId: task.targetId,
          userId: task.userId,
          status: task.status,
          nextRunAt: task.nextRunAt,
          lastRunAt: task.lastRunAt,
          lastResult: task.lastResult,
          createdAt: task.createdAt,
        });
      }
    }

    return userTasks;
  }

  /**
   * 更新任务配置
   */
  async updateTask(target: DistributionTarget): Promise<void> {
    const task = this.tasks.get(target.id);
    if (!task) {
      // 如果任务不存在，直接注册
      await this.register(target);
      return;
    }

    // 检查是否需要重新配置
    const modeChanged = task.target.trigger.mode !== target.trigger.mode;
    const intervalChanged =
      task.target.trigger.scheduleIntervalMinutes !==
      target.trigger.scheduleIntervalMinutes;

    if (modeChanged || intervalChanged) {
      // 重新注册任务
      await this.unregister(target.id);
      await this.register(target);
    } else {
      // 仅更新目标配置
      task.target = target;
    }

    logger.info(
      {
        targetId: target.id,
        modeChanged,
        intervalChanged,
      },
      "Scheduler: Task updated",
    );
  }

  /**
   * 检查任务是否正在运行
   */
  isRunning(targetId: string): boolean {
    return this.runningTasks.has(targetId);
  }

  /**
   * 设置实时任务（EventBus 订阅）
   */
  private setupRealtimeTask(task: InternalTask): void {
    const handler = async (event: DistributionEvent) => {
      // 只处理 bookmark_created 事件
      if (event.type !== "bookmark_created") {
        return;
      }

      // 检查是否是同一用户
      if (event.userId !== task.userId) {
        return;
      }

      // 检查筛选条件
      if (!this.matchFilters(event, task.target)) {
        return;
      }

      // 延迟执行，避免频繁触发
      setTimeout(() => {
        this.executeTask(task, [event.bookmarkId]).catch((error) => {
          logger.error(
            { error, targetId: task.targetId },
            "Scheduler: Realtime task failed",
          );
        });
      }, 1000);
    };

    task.unsubscribe = this.eventBus.subscribe("bookmark_created", handler);
  }

  /**
   * 设置定时任务
   */
  private setupScheduledTask(task: InternalTask): void {
    const intervalMinutes = Math.max(
      task.target.trigger.scheduleIntervalMinutes ??
        this.config.minIntervalMinutes,
      this.config.minIntervalMinutes,
    );

    const intervalMs = intervalMinutes * 60 * 1000;

    // 计算下次执行时间
    task.nextRunAt = new Date(Date.now() + intervalMs);

    task.intervalId = setInterval(() => {
      this.executeTask(task).catch((error) => {
        logger.error(
          { error, targetId: task.targetId },
          "Scheduler: Scheduled task failed",
        );
      });
    }, intervalMs);
  }

  /**
   * 执行任务
   */
  private async executeTask(
    task: InternalTask,
    bookmarkIds?: string[],
  ): Promise<void> {
    // 并发控制：检查是否正在运行
    if (this.runningTasks.has(task.targetId)) {
      logger.warn(
        { targetId: task.targetId },
        "Scheduler: Task already running, skipping",
      );
      return;
    }

    // 检查最大并发数
    if (this.runningTasks.size >= this.config.maxConcurrentTasks) {
      logger.warn(
        {
          targetId: task.targetId,
          runningCount: this.runningTasks.size,
          maxConcurrent: this.config.maxConcurrentTasks,
        },
        "Scheduler: Max concurrent tasks reached, skipping",
      );
      return;
    }

    // 标记为正在运行
    this.runningTasks.add(task.targetId);
    task.lastRunAt = new Date();

    try {
      // 如果没有指定书签，获取增量书签
      const idsToSync =
        bookmarkIds ?? (await this.getIncrementalBookmarkIds(task));

      if (idsToSync.length === 0) {
        logger.debug(
          { targetId: task.targetId },
          "Scheduler: No bookmarks to sync",
        );
        task.lastResult = "success";
        return;
      }

      // 执行分发
      const result = await Promise.race([
        this.service.distribute(task.targetId, idsToSync),
        this.createTimeoutPromise(this.config.taskTimeoutMs),
      ]);

      if (result.success) {
        task.lastResult = "success";
        task.status = "active";
      } else {
        task.lastResult = "failed";
        task.status = "error";
      }

      logger.info(
        {
          targetId: task.targetId,
          success: result.success,
          distributedCount: result.distributedCount,
          failedCount: result.failedCount,
        },
        "Scheduler: Task completed",
      );
    } catch (error) {
      task.lastResult = "failed";
      task.status = "error";

      logger.error(
        {
          targetId: task.targetId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Scheduler: Task execution failed",
      );
    } finally {
      this.runningTasks.delete(task.targetId);

      // 更新下次执行时间（仅定时任务）
      if (task.target.trigger.mode === "scheduled" && task.intervalId) {
        const intervalMinutes = Math.max(
          task.target.trigger.scheduleIntervalMinutes ??
            this.config.minIntervalMinutes,
          this.config.minIntervalMinutes,
        );
        task.nextRunAt = new Date(Date.now() + intervalMinutes * 60 * 1000);
      }
    }
  }

  /**
   * 获取增量书签 ID（自上次同步后的新增书签）
   */
  private async getIncrementalBookmarkIds(
    task: InternalTask,
  ): Promise<string[]> {
    // 获取目标的最新信息
    const target = await this.service.getTarget(task.targetId);
    if (!target) {
      return [];
    }

    // 从 service 获取未同步的书签
    // 这里假设 service 有一个方法可以获取未同步的书签
    // 实际实现可能需要查询 distribution_records 表
    const bookmarks = await this.service.getUnsyncedBookmarks(
      task.targetId,
      task.userId,
      target.lastSyncAt,
    );

    return bookmarks.map((b) => b.id);
  }

  /**
   * 检查事件是否匹配筛选条件
   */
  private matchFilters(
    event: DistributionEvent,
    target: DistributionTarget,
  ): boolean {
    const filters = target.filters;
    if (!filters) {
      return true;
    }

    // 检查平台筛选
    if (filters.platforms && filters.platforms.length > 0) {
      if (event.type === "bookmark_created" && event.platform) {
        if (!filters.platforms.includes(event.platform)) {
          return false;
        }
      }
    }

    // 检查标签筛选
    if (filters.tags && filters.tags.length > 0) {
      if (event.type === "bookmark_created" && event.tags) {
        const hasMatchingTag = filters.tags.some((tag) =>
          event.tags?.includes(tag),
        );
        if (!hasMatchingTag) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 创建超时 Promise
   */
  private createTimeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Task timed out after ${ms}ms`));
      }, ms);
    });
  }
}
