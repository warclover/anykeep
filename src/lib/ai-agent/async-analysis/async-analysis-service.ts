/**
 * 异步分析服务
 *
 * Phase 4: 后台异步分析任务调度与执行
 *
 * @module ai-agent/async-analysis
 * @version 1.0.0
 * @since 2025-12-30
 */

import { logger } from "@/lib/logger";
import { TopicClusteringAnalyzer, PatternDetectionAnalyzer } from "./analyzers";
import type { LazyTrigger } from "./scheduler";
import { createLazyTrigger } from "./scheduler";
import {
  DEFAULT_ASYNC_ANALYSIS_CONFIG,
  TASK_TYPE_PRIORITY,
  TRIGGER_DEFAULT_TASKS,
} from "./constants";
import type {
  AsyncAnalysisConfig,
  AsyncAnalysisTask,
  AnalysisResult,
  AnalysisTaskType,
  IAnalyzer,
  ScheduleOptions,
  TaskQueueStats,
  TaskPriority,
  TaskStatus,
} from "./types";

/**
 * 异步分析服务
 *
 * 核心功能：
 * 1. 任务调度与队列管理
 * 2. 分析器注册与执行
 * 3. 延迟触发集成
 * 4. 结果缓存与回调
 */
export class AsyncAnalysisService {
  private config: AsyncAnalysisConfig;
  private analyzers: Map<AnalysisTaskType, IAnalyzer> = new Map();
  private taskQueue: AsyncAnalysisTask[] = [];
  private runningTasks: Map<string, AsyncAnalysisTask> = new Map();
  private completedResults: Map<string, AnalysisResult> = new Map();
  private lazyTrigger: LazyTrigger;
  private isProcessing = false;

  constructor(config: Partial<AsyncAnalysisConfig> = {}) {
    this.config = { ...DEFAULT_ASYNC_ANALYSIS_CONFIG, ...config };

    // 注册分析器
    this.registerDefaultAnalyzers();

    // 初始化延迟触发器
    this.lazyTrigger = createLazyTrigger();
    this.lazyTrigger.setTriggerCallback(this.handleLazyTrigger.bind(this));
  }

  /**
   * 注册默认分析器
   */
  private registerDefaultAnalyzers(): void {
    if (this.config.enableTopicClustering) {
      this.registerAnalyzer(new TopicClusteringAnalyzer());
    }
    if (this.config.enablePatternDetection) {
      this.registerAnalyzer(new PatternDetectionAnalyzer());
    }
    logger.info(
      {
        module: "AsyncAnalysis",
        analyzerCount: this.analyzers.size,
        types: Array.from(this.analyzers.keys()),
      },
      "Default analyzers registered",
    );
  }

  /**
   * 注册分析器
   */
  registerAnalyzer(analyzer: IAnalyzer): void {
    this.analyzers.set(analyzer.type, analyzer);
    logger.debug(
      { module: "AsyncAnalysis", type: analyzer.type },
      "Analyzer registered",
    );
  }

  /**
   * 调度分析任务
   */
  async scheduleAnalysis(
    userId: string,
    options: ScheduleOptions,
  ): Promise<string[]> {
    if (!this.config.enabled) {
      return [];
    }

    const types = options.types ?? this.getDefaultTaskTypes(options.trigger);
    const taskIds: string[] = [];

    for (const type of types) {
      // 检查是否有对应的分析器
      if (!this.analyzers.has(type)) {
        logger.warn(
          { module: "AsyncAnalysis", type },
          "No analyzer registered for task type",
        );
        continue;
      }

      const task: AsyncAnalysisTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId,
        type,
        priority: options.priority,
        status: "pending",
        trigger: options.trigger,
        input: options.input,
        createdAt: new Date().toISOString(),
        maxRetries: this.config.defaultMaxRetries,
        retryCount: 0,
      };

      this.taskQueue.push(task);
      taskIds.push(task.id);

      logger.info(
        {
          module: "AsyncAnalysis",
          taskId: task.id,
          type,
          userId,
          trigger: options.trigger,
        },
        "Analysis task scheduled",
      );
    }

    // 按优先级排序队列
    this.sortQueue();

    // 如果有延迟要求，使用延迟触发
    if (options.delayMs) {
      setTimeout(() => this.processQueue(), options.delayMs);
    } else {
      // 立即开始处理
      void this.processQueue();
    }

    return taskIds;
  }

  /**
   * 记录用户访问（触发延迟分析）
   */
  async recordUserVisit(userId: string): Promise<void> {
    await this.lazyTrigger.recordUserVisit(userId);
  }

  /**
   * 添加收藏后任务
   */
  addPostCollectionTask(userId: string, bookmarkId: number): void {
    this.lazyTrigger.addPendingTask(userId, "content_enrichment", "medium");
    this.lazyTrigger.addPendingTask(userId, "duplicate_detection", "low");

    logger.debug(
      { module: "AsyncAnalysis", userId, bookmarkId },
      "Post-collection tasks added",
    );
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(taskId: string): TaskStatus | null {
    // 检查运行中的任务
    const running = this.runningTasks.get(taskId);
    if (running) {
      return running.status;
    }

    // 检查队列中的任务
    const queued = this.taskQueue.find((t) => t.id === taskId);
    if (queued) {
      return queued.status;
    }

    // 检查已完成的结果
    if (this.completedResults.has(taskId)) {
      return "completed";
    }

    return null;
  }

  /**
   * 获取分析结果
   */
  getResult(taskId: string): AnalysisResult | null {
    return this.completedResults.get(taskId) ?? null;
  }

  /**
   * 获取用户的最新结果
   */
  getUserResults(userId: string, type?: AnalysisTaskType): AnalysisResult[] {
    const results: AnalysisResult[] = [];

    for (const result of this.completedResults.values()) {
      const task = this.findTaskById(result.taskId);
      if (task && task.userId === userId) {
        if (!type || result.type === type) {
          results.push(result);
        }
      }
    }

    return results;
  }

  /**
   * 获取队列统计
   */
  getQueueStats(): TaskQueueStats {
    const stats: TaskQueueStats = {
      pending: 0,
      running: this.runningTasks.size,
      completed: this.completedResults.size,
      failed: 0,
      byType: {} as Record<AnalysisTaskType, number>,
    };

    for (const task of this.taskQueue) {
      if (task.status === "pending") {
        stats.pending++;
      } else if (task.status === "failed") {
        stats.failed++;
      }

      stats.byType[task.type] = (stats.byType[task.type] ?? 0) + 1;
    }

    return stats;
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    const index = this.taskQueue.findIndex((t) => t.id === taskId);
    if (index >= 0) {
      this.taskQueue[index].status = "cancelled";
      this.taskQueue.splice(index, 1);
      logger.info({ module: "AsyncAnalysis", taskId }, "Task cancelled");
      return true;
    }
    return false;
  }

  /**
   * 清除用户数据
   */
  clearUserData(userId: string): void {
    // 取消待处理任务
    this.taskQueue = this.taskQueue.filter((t) => t.userId !== userId);

    // 清除延迟触发状态
    this.lazyTrigger.clearUserState(userId);

    // 清除已完成结果（可选，根据业务需求）
    for (const [taskId, _result] of this.completedResults) {
      const task = this.findTaskById(taskId);
      if (task && task.userId === userId) {
        this.completedResults.delete(taskId);
      }
    }

    logger.info({ module: "AsyncAnalysis", userId }, "User data cleared");
  }

  /**
   * 处理延迟触发回调
   */
  private async handleLazyTrigger(
    userId: string,
    tasks: Array<{ type: AnalysisTaskType; priority: TaskPriority }>,
  ): Promise<void> {
    await this.scheduleAnalysis(userId, {
      trigger: "on_visit",
      priority: "medium",
      types: tasks.map((t) => t.type),
    });
  }

  /**
   * 处理任务队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.taskQueue.length > 0) {
        // 检查并发限制
        if (this.runningTasks.size >= this.config.maxConcurrentTasks) {
          break;
        }

        // 获取下一个待处理任务
        const task = this.taskQueue.find((t) => t.status === "pending");
        if (!task) {
          break;
        }

        // 执行任务
        void this.executeTask(task);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 执行单个任务
   */
  private async executeTask(task: AsyncAnalysisTask): Promise<void> {
    const analyzer = this.analyzers.get(task.type);
    if (!analyzer) {
      task.status = "failed";
      task.error = `No analyzer for type: ${task.type}`;
      return;
    }

    // 更新状态
    task.status = "running";
    task.startedAt = new Date().toISOString();
    this.runningTasks.set(task.id, task);

    // 从队列移除
    const index = this.taskQueue.indexOf(task);
    if (index >= 0) {
      this.taskQueue.splice(index, 1);
    }

    const startTime = Date.now();

    try {
      // 检查是否可以执行
      const canExecute = await analyzer.canExecute(task);
      if (!canExecute) {
        task.status = "cancelled";
        task.error = "Pre-conditions not met";
        this.runningTasks.delete(task.id);
        return;
      }

      // 设置超时
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Task timeout")),
          this.config.taskTimeoutMs,
        );
      });

      // 执行分析
      const output = await Promise.race([
        analyzer.analyze(task),
        timeoutPromise,
      ]);

      // 保存结果
      const result: AnalysisResult = {
        taskId: task.id,
        type: task.type,
        data: output.data,
        insights: output.insights,
        suggestedActions: output.suggestedActions,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      task.status = "completed";
      task.completedAt = result.completedAt;
      task.output = output.data as Record<string, unknown>;

      this.completedResults.set(task.id, result);

      logger.info(
        {
          module: "AsyncAnalysis",
          taskId: task.id,
          type: task.type,
          durationMs: result.durationMs,
          insightCount: result.insights.length,
        },
        "Task completed",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // 检查是否需要重试
      if (
        task.retryCount !== undefined &&
        task.maxRetries !== undefined &&
        task.retryCount < task.maxRetries
      ) {
        task.retryCount++;
        task.status = "pending";

        // 重新加入队列
        this.taskQueue.push(task);
        this.sortQueue();

        logger.warn(
          {
            module: "AsyncAnalysis",
            taskId: task.id,
            type: task.type,
            retryCount: task.retryCount,
            error: errorMessage,
          },
          "Task failed, retrying",
        );
      } else {
        task.status = "failed";
        task.error = errorMessage;

        logger.error(
          {
            module: "AsyncAnalysis",
            taskId: task.id,
            type: task.type,
            error: errorMessage,
          },
          "Task failed",
        );
      }
    } finally {
      this.runningTasks.delete(task.id);

      // 继续处理队列
      void this.processQueue();
    }
  }

  /**
   * 获取默认任务类型
   */
  private getDefaultTaskTypes(
    trigger: AsyncAnalysisTask["trigger"],
  ): AnalysisTaskType[] {
    return TRIGGER_DEFAULT_TASKS[trigger] ?? [];
  }

  /**
   * 按优先级排序队列
   */
  private sortQueue(): void {
    this.taskQueue.sort((a, b) => {
      // 先按优先级排序
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff =
        priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // 再按任务类型优先级排序
      const typePriorityDiff =
        TASK_TYPE_PRIORITY[a.type] - TASK_TYPE_PRIORITY[b.type];
      if (typePriorityDiff !== 0) {
        return typePriorityDiff;
      }

      // 最后按创建时间排序
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  /**
   * 根据 ID 查找任务
   */
  private findTaskById(taskId: string): AsyncAnalysisTask | undefined {
    return (
      this.taskQueue.find((t) => t.id === taskId) ??
      this.runningTasks.get(taskId)
    );
  }

  /**
   * 销毁服务
   */
  dispose(): void {
    this.lazyTrigger.dispose();
    this.taskQueue = [];
    this.runningTasks.clear();
    this.completedResults.clear();
    this.analyzers.clear();

    logger.info({ module: "AsyncAnalysis" }, "Service disposed");
  }
}

/**
 * 创建异步分析服务实例
 */
export function createAsyncAnalysisService(
  config?: Partial<AsyncAnalysisConfig>,
): AsyncAnalysisService {
  return new AsyncAnalysisService(config);
}
