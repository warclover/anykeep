/**
 * 导入 Tools 导出
 *
 * 这些 Tools 处理书签的批量导入功能，
 * 包括 URL 批量导入和浏览器书签导入状态查询。
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

export { importBookmarksTool } from "./import-bookmarks.tool";
export { importBrowserBookmarksTool } from "./import-browser-bookmarks.tool";

// 导出所有导入 Tools 数组
import { importBookmarksTool } from "./import-bookmarks.tool";
import { importBrowserBookmarksTool } from "./import-browser-bookmarks.tool";

export const importTools = [importBookmarksTool, importBrowserBookmarksTool];
