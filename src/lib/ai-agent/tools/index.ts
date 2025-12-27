/**
 * AI Agent Tools 模块导出
 *
 * @version 2.1.0
 * @since 2025-12-23
 *
 * v2.1.0 新增:
 * - 快照 Tools: compare-snapshots（快照对比）
 *
 * v2.0.0 新增:
 * - 消息 Tools: list-messages, summarize-unread, batch-mark-read
 *
 * v1.9.0 新增:
 * - 工具描述模板: tool-description-templates.ts（增强型描述，提升 LLM 工具选择准确性）
 * - 工具结果增强器: tool-result-enhancer.ts（结果摘要、错误分析、下一步建议）
 *
 * v1.8.0 新增:
 * - 设置: get-user-interests, update-user-interests
 * - 导入: import-bookmarks, import-browser-bookmarks
 *
 * v1.7.0 新增 P1/P2 Tools:
 * - 书签: update-bookmark, batch-delete-bookmarks, create-snapshot
 * - 设置: get-user-settings, get-classification-settings, update-classification-settings
 * - MD 收藏: toggle-md-read, toggle-md-starred, update-md-collection, delete-md-collection, get-md-stats
 * - 智能列表: toggle-smart-list-pin, update-smart-list, delete-smart-list, create-smart-list
 */

// 类型定义
export * from "./types";

// 共享工具函数和常量
export * from "./utils";

// 工具描述模板（v1.9.0）
export * from "./tool-description-templates";

// 工具结果增强器（v1.9.0）
export * from "./tool-result-enhancer";

// Tool 注册表
export { ToolRegistry, toolRegistry } from "./tool-registry";

// 查询 Tools
export * from "./query";

// 阅读 Tools
export * from "./read";

// 搜索 Tools
export * from "./search";

// 操作 Tools（需要确认）
export * from "./action";

// 智能列表 Tools
export * from "./smart-list";

// 文件夹 Tools
export * from "./folder";

// 导出 Tools
export * from "./export";

// 书签 Tools (新增 v1.6.0)
export * from "./bookmark";

// 设置 Tools (新增 v1.6.0)
export * from "./settings";

// MD 收藏 Tools (新增 v1.6.0)
export * from "./md-collection";

// 导入 Tools (新增 v1.8.0)
export * from "./import";

// 消息 Tools (新增 v2.0.0)
export * from "./messages";

// 快照 Tools (新增 v2.1.0)
export * from "./snapshot";

// 注册默认 Tools
import { toolRegistry } from "./tool-registry";
import { queryTools } from "./query";
import { readTools } from "./read";
import { searchTools } from "./search";
import { actionTools } from "./action";
import { smartListTools } from "./smart-list";
import { folderTools } from "./folder";
import { exportTools } from "./export";
import { bookmarkTools } from "./bookmark";
import { settingsTools } from "./settings";
import { mdCollectionTools } from "./md-collection";
import { importTools } from "./import";
import { messageTools } from "./messages";
import { snapshotTools } from "./snapshot";

/**
 * 注册所有默认 Tools
 */
export function registerDefaultTools(): void {
  toolRegistry.registerAll(queryTools);
  toolRegistry.registerAll(readTools);
  toolRegistry.registerAll(searchTools);
  toolRegistry.registerAll(actionTools);
  toolRegistry.registerAll(smartListTools);
  toolRegistry.registerAll(folderTools);
  toolRegistry.registerAll(exportTools);
  // 新增 Tools (v1.6.0)
  toolRegistry.registerAll(bookmarkTools);
  toolRegistry.registerAll(settingsTools);
  toolRegistry.registerAll(mdCollectionTools);
  // 新增 Tools (v1.8.0)
  toolRegistry.registerAll(importTools);
  // 新增 Tools (v2.0.0)
  toolRegistry.registerAll(messageTools);
  // 新增 Tools (v2.1.0)
  toolRegistry.registerAll(snapshotTools);
}

/**
 * 获取所有 Tools 作为 Vercel AI SDK 格式
 *
 * @param context - 工具执行上下文
 * @param context.userId - 用户 ID
 * @param context.conversationId - 会话 ID（可选）
 * @param context.onSearchResults - 搜索结果记录回调（可选，用于上下文保持）
 */
export function getToolsAsVercelTools(context: {
  userId: string;
  conversationId?: string;
  onSearchResults?: (info: { query: string; resultIds: number[] }) => void;
}) {
  return toolRegistry.getAsVercelTools(context);
}
