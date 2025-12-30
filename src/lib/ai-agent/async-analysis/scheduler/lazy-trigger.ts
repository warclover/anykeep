/**
 * 延迟触发器
 *
 * 实现"懒惰馆长"模式：用户上线时触发后台分析，而非使用 Cron
 *
 * @module ai-agent/async-analysis/scheduler
 * @version 1.0.0
 * @since 2025-12-30
 */

import { logger } from "@/lib/logger";
import {
  DEFAULT_LAZY_TRIGGER_CONFIG,
  TRIGGER_DEFAULT_TASKS,
} from "../constants";
import type {
  LazyTriggerConfig,
  AnalysisTaskType,
  TaskPriority,
} from "../types";

/**
 * 用户访问状态
 */
interface UserVisitState {
  /** 用户 ID */
  userId: string;
  /** 上次访问时间 */
  lastVisitAt: number;
  /** 待触发的任务 */
  pendingTasks: PendingTask[];
  /** 最后触发时间 */
  lastTriggeredAt?: number;
}

/**
 * 待触发任务
 */
interface PendingTask {
  type: AnalysisTaskType;
  priority: TaskPriority;
  scheduledAt: number;
}

/**
 * 触发回调
 */
type TriggerCallback = (
  userId: string,
  tasks: Array<{ type: AnalysisTaskType; priority: TaskPriority }>,
) => Promise<void>;

/**
 * 延迟触发器
 *
 * 核心设计：
 * 1. 用户离线期间积累分析任务
 * 2. 用户上线时，延迟一小段时间后触发分析
 * 3. 避免影响用户的首屏加载体验
 */
export class LazyTrigger {
  private config: LazyTriggerConfig;
  private userStates: Map<string, UserVisitState> = new Map();
  private triggerCallback?: TriggerCallback;
  private pendingTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<LazyTriggerConfig> = {}) {
    this.config = { ...DEFAULT_LAZY_TRIGGER_CONFIG, ...config };
  }

  /**
   * 设置触发回调
   */
  setTriggerCallback(callback: TriggerCallback): void {
    this.triggerCallback = callback;
  }

  /**
   * 记录用户访问
   *
   * 用户上线时调用此方法
   */
  async recordUserVisit(userId: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const now = Date.now();
    const state = this.userStates.get(userId);

    if (!state) {
      // 首次访问，创建状态
      this.userStates.set(userId, {
        userId,
        lastVisitAt: now,
        pendingTasks: [],
      });
      return;
    }

    // 计算离线时长
    const offlineDuration = now - state.lastVisitAt;

    // 更新访问时间
    state.lastVisitAt = now;

    // 检查是否需要触发分析
    if (offlineDuration >= this.config.minOfflineDurationMs) {
      await this.scheduleTrigger(userId, offlineDuration);
    }
  }

  /**
   * 添加待处理任务
   *
   * 用于在收藏等操作后添加分析任务
   */
  addPendingTask(
    userId: string,
    type: AnalysisTaskType,
    priority: TaskPriority = "medium",
  ): void {
    let state = this.userStates.get(userId);

    if (!state) {
      state = {
        userId,
        lastVisitAt: Date.now(),
        pendingTasks: [],
      };
      this.userStates.set(userId, state);
    }

    // 检查是否已存在相同类型的任务
    const existing = state.pendingTasks.find((t) => t.type === type);
    if (!existing) {
      state.pendingTasks.push({
        type,
        priority,
        scheduledAt: Date.now(),
      });

      logger.debug(
        { module: "AsyncAnalysis", userId, type, priority },
        "Pending task added",
      );
    }
  }

  /**
   * 获取待处理任务数
   */
  getPendingTaskCount(userId: string): number {
    const state = this.userStates.get(userId);
    return state?.pendingTasks.length ?? 0;
  }

  /**
   * 清除用户状态
   */
  clearUserState(userId: string): void {
    // 取消待触发的定时器
    const timer = this.pendingTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.pendingTimers.delete(userId);
    }

    this.userStates.delete(userId);
  }

  /**
   * 手动触发分析
   */
  async triggerNow(userId: string, types?: AnalysisTaskType[]): Promise<void> {
    if (!this.triggerCallback) {
      logger.warn(
        { module: "AsyncAnalysis", userId },
        "Trigger callback not set",
      );
      return;
    }

    const tasksToTrigger = types
      ? types.map((type) => ({ type, priority: "medium" as TaskPriority }))
      : this.getDefaultTasks();

    await this.triggerCallback(userId, tasksToTrigger);
  }

  /**
   * 调度延迟触发
   */
  private async scheduleTrigger(
    userId: string,
    offlineDuration: number,
  ): Promise<void> {
    // 取消之前的定时器
    const existingTimer = this.pendingTimers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const state = this.userStates.get(userId);
    if (!state) {
      return;
    }

    logger.info(
      {
        module: "AsyncAnalysis",
        userId,
        offlineHours: (offlineDuration / (60 * 60 * 1000)).toFixed(1),
        pendingTasks: state.pendingTasks.length,
      },
      "Scheduling delayed analysis trigger",
    );

    // 延迟触发
    const timer = setTimeout(async () => {
      this.pendingTimers.delete(userId);
      await this.executeTrigger(userId);
    }, this.config.triggerDelayMs);

    this.pendingTimers.set(userId, timer);
  }

  /**
   * 执行触发
   */
  private async executeTrigger(userId: string): Promise<void> {
    if (!this.triggerCallback) {
      return;
    }

    const state = this.userStates.get(userId);
    if (!state) {
      return;
    }

    // 收集任务
    const tasks: Array<{ type: AnalysisTaskType; priority: TaskPriority }> = [];

    // 添加待处理任务
    for (const pending of state.pendingTasks) {
      tasks.push({ type: pending.type, priority: pending.priority });
    }

    // 添加默认任务（如果数量不足）
    if (tasks.length < this.config.maxTasksPerTrigger) {
      const defaultTasks = this.getDefaultTasks();
      for (const task of defaultTasks) {
        if (
          tasks.length < this.config.maxTasksPerTrigger &&
          !tasks.some((t) => t.type === task.type)
        ) {
          tasks.push(task);
        }
      }
    }

    // 限制任务数量
    const tasksToExecute = tasks.slice(0, this.config.maxTasksPerTrigger);

    logger.info(
      {
        module: "AsyncAnalysis",
        userId,
        taskCount: tasksToExecute.length,
        types: tasksToExecute.map((t) => t.type),
      },
      "Executing delayed trigger",
    );

    try {
      await this.triggerCallback(userId, tasksToExecute);

      // 清除已触发的待处理任务
      state.pendingTasks = state.pendingTasks.filter(
        (p) => !tasksToExecute.some((t) => t.type === p.type),
      );
      state.lastTriggeredAt = Date.now();
    } catch (error) {
      logger.error(
        {
          module: "AsyncAnalysis",
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Trigger execution failed",
      );
    }
  }

  /**
   * 获取默认任务列表
   */
  private getDefaultTasks(): Array<{
    type: AnalysisTaskType;
    priority: TaskPriority;
  }> {
    return TRIGGER_DEFAULT_TASKS.on_visit.map((type) => ({
      type,
      priority: "medium" as TaskPriority,
    }));
  }

  /**
   * 销毁
   */
  dispose(): void {
    // 清除所有定时器
    for (const timer of this.pendingTimers.values()) {
      clearTimeout(timer);
    }
    this.pendingTimers.clear();
    this.userStates.clear();
    this.triggerCallback = undefined;
  }
}

/**
 * 创建延迟触发器实例
 */
export function createLazyTrigger(
  config?: Partial<LazyTriggerConfig>,
): LazyTrigger {
  return new LazyTrigger(config);
}
