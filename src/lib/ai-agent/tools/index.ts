/**
 * AI Agent Tools 模块导出
 *
 * @version 1.5.0
 * @since 2025-12-23
 */

// 类型定义
export * from "./types";

// 共享工具函数和常量
export * from "./utils";

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

// 注册默认 Tools
import { toolRegistry } from "./tool-registry";
import { queryTools } from "./query";
import { readTools } from "./read";
import { searchTools } from "./search";
import { actionTools } from "./action";
import { smartListTools } from "./smart-list";
import { folderTools } from "./folder";
import { exportTools } from "./export";

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
}

/**
 * 获取所有 Tools 作为 Vercel AI SDK 格式
 */
export function getToolsAsVercelTools(context: {
  userId: string;
  conversationId?: string;
}) {
  return toolRegistry.getAsVercelTools(context);
}
