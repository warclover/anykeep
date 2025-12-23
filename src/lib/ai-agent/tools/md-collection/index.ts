/**
 * MD 收藏 Tools 导出
 *
 * 这些 Tools 处理 Markdown 收藏的查询、读取、搜索和管理，
 * 支持语义搜索、关键词搜索和状态管理。
 *
 * @version 1.1.0
 * @since 2025-12-23
 */

// 查询 Tools
export { listMdCollectionsTool } from "./list-md-collections.tool";
export { getMdCollectionTool } from "./get-md-collection.tool";
export { searchMdCollectionsTool } from "./search-md-collections.tool";
export { getMdStatsTool } from "./get-md-stats.tool";

// 操作 Tools
export { toggleMdReadTool } from "./toggle-md-read.tool";
export { toggleMdStarredTool } from "./toggle-md-starred.tool";
export { updateMdCollectionTool } from "./update-md-collection.tool";
export { deleteMdCollectionTool } from "./delete-md-collection.tool";

// 导出所有 MD 收藏 Tools 数组
import { listMdCollectionsTool } from "./list-md-collections.tool";
import { getMdCollectionTool } from "./get-md-collection.tool";
import { searchMdCollectionsTool } from "./search-md-collections.tool";
import { getMdStatsTool } from "./get-md-stats.tool";
import { toggleMdReadTool } from "./toggle-md-read.tool";
import { toggleMdStarredTool } from "./toggle-md-starred.tool";
import { updateMdCollectionTool } from "./update-md-collection.tool";
import { deleteMdCollectionTool } from "./delete-md-collection.tool";

export const mdCollectionTools = [
  // 查询类
  listMdCollectionsTool,
  getMdCollectionTool,
  searchMdCollectionsTool,
  getMdStatsTool,
  // 操作类
  toggleMdReadTool,
  toggleMdStarredTool,
  updateMdCollectionTool,
  deleteMdCollectionTool,
];
