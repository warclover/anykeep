/**
 * 分发调度器接口
 *
 * @module distribution/interfaces
 * @description 定义调度器接口，用于管理定时和实时触发的分发任务
 */

import type { DistributionTarget } from "../types";

/**
 * 调度任务状态
 */
export type ScheduleStatus = "active" | "paused" | "completed" | "error";

/**
 * 调度任务信息
 */
export interface ScheduledTask {
  /** 任务 ID */
  id: string;
  /** 目标 ID */
  targetId: string;
  /** 用户 ID */
  userId: string;
  /** 状态 */
  status: ScheduleStatus;
  /** 下次执行时间 */
  nextRunAt?: Date;
  /** 上次执行时间 */
  lastRunAt?: Date;
  /** 上次执行结果 */
  lastResult?: "success" | "failed";
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 分发调度器接口
 *
 * 管理定时触发和实时触发的分发任务
 *
 * @example
 * ```typescript
 * const scheduler = new DistributionScheduler(eventBus, service);
 *
 * // 注册定时任务
 * await scheduler.register(target);
 *
 * // 暂停任务
 * await scheduler.pause(targetId);
 *
 * // 恢复任务
 * await scheduler.resume(targetId);
 *
 * // 注销任务
 * await scheduler.unregister(targetId);
 * ```
 */
export interface IDistributionScheduler {
  /**
   * 注册调度任务
   *
   * 根据目标配置的触发模式注册任务：
   * - realtime: 订阅 EventBus 的 bookmark_created 事件
   * - scheduled: 创建定时任务
   * - manual: 不注册自动触发
   *
   * @param target - 分发目标配置
   */
  register(target: DistributionTarget): Promise<void>;

  /**
   * 注销调度任务
   *
   * @param targetId - 目标 ID
   */
  unregister(targetId: string): Promise<void>;

  /**
   * 暂停任务
   *
   * @param targetId - 目标 ID
   */
  pause(targetId: string): Promise<void>;

  /**
   * 恢复任务
   *
   * @param targetId - 目标 ID
   */
  resume(targetId: string): Promise<void>;

  /**
   * 立即触发执行
   *
   * @param targetId - 目标 ID
   * @param bookmarkIds - 可选的书签 ID 列表，不传则同步所有
   */
  triggerNow(targetId: string, bookmarkIds?: string[]): Promise<void>;

  /**
   * 获取任务状态
   *
   * @param targetId - 目标 ID
   * @returns 任务信息，不存在返回 undefined
   */
  getTask(targetId: string): ScheduledTask | undefined;

  /**
   * 获取用户的所有任务
   *
   * @param userId - 用户 ID
   * @returns 任务列表
   */
  getTasksByUser(userId: string): ScheduledTask[];

  /**
   * 更新任务配置
   *
   * 当目标配置变更时调用，更新调度规则
   *
   * @param target - 更新后的目标配置
   */
  updateTask(target: DistributionTarget): Promise<void>;

  /**
   * 启动调度器
   *
   * 初始化所有活跃目标的调度任务
   */
  start(): Promise<void>;

  /**
   * 停止调度器
   *
   * 清理所有定时任务和事件订阅
   */
  stop(): Promise<void>;

  /**
   * 检查任务是否正在运行
   *
   * @param targetId - 目标 ID
   * @returns 是否正在运行
   */
  isRunning(targetId: string): boolean;
}

/**
 * 调度器配置
 */
export interface SchedulerConfig {
  /** 最小调度间隔（分钟） */
  minIntervalMinutes?: number;
  /** 最大并发任务数 */
  maxConcurrentTasks?: number;
  /** 任务超时时间（毫秒） */
  taskTimeoutMs?: number;
  /** 失败重试次数 */
  retryCount?: number;
  /** 重试延迟（毫秒） */
  retryDelayMs?: number;
}
