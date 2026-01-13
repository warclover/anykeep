/**
 * 待办事项 Tools 模块导出
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

export * from "./types";
export { listPendingTasksTool } from "./list-pending-tasks.tool";
export { completePendingTaskTool } from "./complete-pending-task.tool";

import { listPendingTasksTool } from "./list-pending-tasks.tool";
import { completePendingTaskTool } from "./complete-pending-task.tool";

/**
 * 待办事项相关的所有 Tools
 */
export const pendingTasksTools = [
  listPendingTasksTool,
  completePendingTaskTool,
];
