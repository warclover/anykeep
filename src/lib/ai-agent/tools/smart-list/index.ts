/**
 * 智能列表 Tools 模块导出
 *
 * 这些 Tools 处理智能列表的查询、创建、更新和删除，
 * 支持筛选条件配置和列表管理。
 *
 * @version 1.1.0
 * @since 2025-12-23
 */

// 类型导出
export * from "./types";

// 查询 Tools
export { listSmartListsTool } from "./list-smart-lists.tool";
export { getSmartListItemsTool } from "./get-smart-list-items.tool";
export { getSmartListCountTool } from "./get-smart-list-count.tool";

// 操作 Tools
export { toggleSmartListPinTool } from "./toggle-smart-list-pin.tool";
export { updateSmartListTool } from "./update-smart-list.tool";
export { deleteSmartListTool } from "./delete-smart-list.tool";
export { createSmartListTool } from "./create-smart-list.tool";

// 导入所有工具用于批量注册
import { listSmartListsTool } from "./list-smart-lists.tool";
import { getSmartListItemsTool } from "./get-smart-list-items.tool";
import { getSmartListCountTool } from "./get-smart-list-count.tool";
import { toggleSmartListPinTool } from "./toggle-smart-list-pin.tool";
import { updateSmartListTool } from "./update-smart-list.tool";
import { deleteSmartListTool } from "./delete-smart-list.tool";
import { createSmartListTool } from "./create-smart-list.tool";
import type { Tool } from "../types";

/**
 * 智能列表相关 Tools 数组
 *
 * 使用 any[] 类型转换以兼容批量注册
 * 实际类型在运行时是正确的
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const smartListTools: Tool<any, any>[] = [
  // 查询类
  listSmartListsTool,
  getSmartListItemsTool,
  getSmartListCountTool,
  // 操作类
  toggleSmartListPinTool,
  updateSmartListTool,
  deleteSmartListTool,
  createSmartListTool,
];
