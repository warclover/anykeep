/**
 * 搜索 Tools 导出
 *
 * @version 2.0.0
 * @since 2025-12-23
 * @description 简化版搜索 Tool，只需关键词即可搜索
 */

// 简化版搜索 Tool（已包含语义搜索能力）
export { searchTool } from "./search.tool";

// 导出所有搜索 Tools 数组
import { searchTool } from "./search.tool";

// 只注册简化版
export const searchTools = [searchTool];
