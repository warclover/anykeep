/**
 * 待办事项追踪服务
 *
 * 管理跨会话的用户待办事项，支持：
 * - 获取待办列表
 * - 标记为已完成
 * - 批量操作
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 待办事项
 */
export interface PendingTask {
  /** 任务内容 */
  content: string;
  /** 来源会话 ID */
  sourceSessionId?: string;
  /** 创建时间 */
  createdAt?: Date;
}

/**
 * 待办事项服务配置
 */
export interface PendingTasksConfig {
  /** 有效期（天），默认 7 天 */
  retentionDays?: number;
  /** 最大返回数量，默认 10 */
  maxTasks?: number;
}

// =============================================================================
// 默认配置
// =============================================================================

const DEFAULT_CONFIG: Required<PendingTasksConfig> = {
  retentionDays: 7,
  maxTasks: 10,
};

// =============================================================================
// 待办事项服务
// =============================================================================

/**
 * 待办事项服务
 *
 * 封装 EpisodicMemoryService 的待办追踪功能，
 * 提供更清晰的 API 接口
 */
export class PendingTasksService {
  private config: Required<PendingTasksConfig>;
  private log = logger.child({ module: "PendingTasksService" });

  constructor(config?: PendingTasksConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // 公开方法
  // ===========================================================================

  /**
   * 获取用户的待办事项列表
   *
   * @param userId 用户 ID
   * @returns 待办事项内容列表
   */
  async getTasks(userId: string): Promise<string[]> {
    this.log.debug({ userId }, "Fetching pending tasks");

    try {
      const supabase = await createClient();

      const { data, error } = await (supabase.rpc as CallableFunction)(
        "get_pending_intents",
        { p_user_id: userId },
      );

      if (error) {
        this.log.error({ error, userId }, "Failed to get pending tasks");
        return [];
      }

      const tasks = (data as string[]) || [];
      this.log.debug(
        { userId, count: tasks.length },
        "Pending tasks retrieved",
      );

      // 限制返回数量
      return tasks.slice(0, this.config.maxTasks);
    } catch (error) {
      this.log.error({ error, userId }, "Error fetching pending tasks");
      return [];
    }
  }

  /**
   * 标记任务为已完成
   *
   * @param userId 用户 ID
   * @param task 任务内容
   * @returns 是否成功
   */
  async completeTask(userId: string, task: string): Promise<boolean> {
    this.log.debug({ userId, task }, "Completing task");

    try {
      const supabase = await createClient();

      const { error } = await (supabase.rpc as CallableFunction)(
        "remove_pending_intent",
        {
          p_user_id: userId,
          p_intent: task,
        },
      );

      if (error) {
        this.log.error({ error, userId, task }, "Failed to complete task");
        return false;
      }

      this.log.info({ userId, task }, "Task completed");
      return true;
    } catch (error) {
      this.log.error({ error, userId, task }, "Error completing task");
      return false;
    }
  }

  /**
   * 批量标记任务为已完成
   *
   * @param userId 用户 ID
   * @param tasks 任务内容列表
   * @returns 成功完成的数量
   */
  async completeTasks(userId: string, tasks: string[]): Promise<number> {
    this.log.debug(
      { userId, count: tasks.length },
      "Completing multiple tasks",
    );

    let completedCount = 0;

    for (const task of tasks) {
      const success = await this.completeTask(userId, task);
      if (success) {
        completedCount++;
      }
    }

    this.log.info(
      { userId, total: tasks.length, completed: completedCount },
      "Batch task completion finished",
    );

    return completedCount;
  }

  /**
   * 检查是否有待办事项
   *
   * @param userId 用户 ID
   * @returns 是否有待办事项
   */
  async hasTasks(userId: string): Promise<boolean> {
    const tasks = await this.getTasks(userId);
    return tasks.length > 0;
  }

  /**
   * 获取待办事项数量
   *
   * @param userId 用户 ID
   * @returns 待办事项数量
   */
  async getTaskCount(userId: string): Promise<number> {
    const tasks = await this.getTasks(userId);
    return tasks.length;
  }

  /**
   * 模糊匹配并完成任务
   *
   * 用于 AI 根据用户描述找到并完成相关任务
   *
   * @param userId 用户 ID
   * @param description 任务描述
   * @returns 匹配并完成的任务，未找到返回 null
   */
  async completeTaskByMatch(
    userId: string,
    description: string,
  ): Promise<string | null> {
    const tasks = await this.getTasks(userId);

    if (tasks.length === 0) {
      return null;
    }

    // 简单的关键词匹配
    const normalizedDesc = description.toLowerCase();
    const matchedTask = tasks.find((task) => {
      const normalizedTask = task.toLowerCase();
      // 任务包含描述，或描述包含任务
      return (
        normalizedTask.includes(normalizedDesc) ||
        normalizedDesc.includes(normalizedTask)
      );
    });

    if (matchedTask) {
      const success = await this.completeTask(userId, matchedTask);
      return success ? matchedTask : null;
    }

    return null;
  }
}

// =============================================================================
// 单例导出
// =============================================================================

let _instance: PendingTasksService | null = null;

/**
 * 获取待办事项服务实例
 */
export function getPendingTasksService(
  config?: PendingTasksConfig,
): PendingTasksService {
  if (!_instance) {
    _instance = new PendingTasksService(config);
  }
  return _instance;
}

/**
 * 重置服务实例（用于测试）
 */
export function resetPendingTasksService(): void {
  _instance = null;
}

// =============================================================================
// 便捷函数导出
// =============================================================================

/**
 * 获取用户待办事项
 */
export async function getPendingTasks(userId: string): Promise<string[]> {
  return getPendingTasksService().getTasks(userId);
}

/**
 * 完成待办事项
 */
export async function completePendingTask(
  userId: string,
  task: string,
): Promise<boolean> {
  return getPendingTasksService().completeTask(userId, task);
}

/**
 * 检查是否有待办事项
 */
export async function hasPendingTasks(userId: string): Promise<boolean> {
  return getPendingTasksService().hasTasks(userId);
}
