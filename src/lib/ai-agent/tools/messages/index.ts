/**
 * 消息 Tools 导出
 *
 * @version 1.0.0
 * @since 2025-12-27
 * @description 消息系统 AI 工具集
 */

// 工具导出
export { listMessagesTool } from "./list-messages.tool";
export { summarizeUnreadMessagesTool } from "./summarize-unread.tool";
export { batchMarkReadTool } from "./batch-mark-read.tool";

// 导入用于数组导出
import { listMessagesTool } from "./list-messages.tool";
import { summarizeUnreadMessagesTool } from "./summarize-unread.tool";
import { batchMarkReadTool } from "./batch-mark-read.tool";

/**
 * 消息系统 Tools 数组
 */
export const messageTools = [
  // 查询类
  listMessagesTool,
  summarizeUnreadMessagesTool,
  // 操作类
  batchMarkReadTool,
];
