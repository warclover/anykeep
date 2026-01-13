/**
 * 待办事项 Tools 类型定义
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

// ============================================
// 返回类型
// ============================================

/**
 * 获取待办事项结果
 */
export interface ListPendingTasksResult {
  /** 待办事项列表 */
  tasks: string[];
  /** 任务数量 */
  count: number;
  /** 是否有更多（超过限制） */
  hasMore: boolean;
  /** 提示信息 */
  message: string;
}

/**
 * 完成待办事项结果
 */
export interface CompletePendingTaskResult {
  /** 是否成功 */
  success: boolean;
  /** 完成的任务 */
  completedTask?: string;
  /** 剩余任务数量 */
  remainingCount: number;
  /** 提示信息 */
  message: string;
}
