/**
 * 智能列表 Tools 模块导出
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

// 类型导出
export * from "./types";

// 工具导出
export { listSmartListsTool } from "./list-smart-lists.tool";
export { getSmartListItemsTool } from "./get-smart-list-items.tool";
export { getSmartListCountTool } from "./get-smart-list-count.tool";

// 导入所有工具用于批量注册
import { listSmartListsTool } from "./list-smart-lists.tool";
import { getSmartListItemsTool } from "./get-smart-list-items.tool";
import { getSmartListCountTool } from "./get-smart-list-count.tool";
import type { Tool } from "../types";

/**
 * 智能列表相关 Tools 数组
 *
 * 使用 any[] 类型转换以兼容批量注册
 * 实际类型在运行时是正确的
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const smartListTools: Tool<any, any>[] = [
  listSmartListsTool,
  getSmartListItemsTool,
  getSmartListCountTool,
];
