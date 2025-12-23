/**
 * 搜索 Tools 导出
 *
 * @version 2.0.0
 * @since 2025-12-23
 * @description 简化版搜索 Tool，只需关键词即可搜索
 */

// 简化版（推荐）
export { searchTool } from "./search.tool";

// 保留原版用于兼容（后续可移除）
export { semanticSearchTool } from "./semantic-search.tool";

// 导出所有搜索 Tools 数组
import { searchTool } from "./search.tool";

// 只注册简化版
export const searchTools = [searchTool];
