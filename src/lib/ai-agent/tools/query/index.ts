/**
 * 数据查询 Tools 导出
 *
 * @version 2.0.0
 * @since 2025-12-23
 * @description 简化版 Tools，每个 Tool 只做一件事，参数尽量少
 */

// 列表类（简化版）
export { listRecentTool } from "./list-recent.tool";
export { listByFolderTool } from "./list-by-folder.tool";
export { listByPlatformTool } from "./list-by-platform.tool";

// 统计类（简化版）
export { countTotalTool } from "./count-total.tool";
export { countByFolderTool } from "./count-by-folder.tool";
export { countByPlatformTool } from "./count-by-platform.tool";

// 详细统计（保留）
export { getStatsTool } from "./get-stats.tool";

// 保留原版用于兼容（后续可移除）
export { countBookmarksTool } from "./count-bookmarks.tool";
export { listBookmarksTool } from "./list-bookmarks.tool";

// 导出所有查询 Tools 数组
import { listRecentTool } from "./list-recent.tool";
import { listByFolderTool } from "./list-by-folder.tool";
import { listByPlatformTool } from "./list-by-platform.tool";
import { countTotalTool } from "./count-total.tool";
import { countByFolderTool } from "./count-by-folder.tool";
import { countByPlatformTool } from "./count-by-platform.tool";
import { getStatsTool } from "./get-stats.tool";

// 简化版 Tools 优先注册，LLM 更容易正确调用
export const queryTools = [
  // 最常用：获取最近收藏（无参数 / 1参数）
  listRecentTool,
  countTotalTool,
  // 按条件筛选（1-2参数）
  listByFolderTool,
  listByPlatformTool,
  countByFolderTool,
  countByPlatformTool,
  // 详细统计概览
  getStatsTool,
];
