/**
 * 导入 Tools 导出
 *
 * 这些 Tools 处理书签的批量导入功能，
 * 包括 URL 批量导入、浏览器书签导入和微信文章导入。
 *
 * @version 1.1.0
 * @since 2025-12-24
 * @updated 2025-12-27 添加 import_wechat_article Tool
 */

export { importBookmarksTool } from "./import-bookmarks.tool";
export { importBrowserBookmarksTool } from "./import-browser-bookmarks.tool";
export { importWechatArticleTool } from "./import-wechat-article.tool";

// 导出所有导入 Tools 数组
import { importBookmarksTool } from "./import-bookmarks.tool";
import { importBrowserBookmarksTool } from "./import-browser-bookmarks.tool";
import { importWechatArticleTool } from "./import-wechat-article.tool";

export const importTools = [
  importBookmarksTool,
  importBrowserBookmarksTool,
  importWechatArticleTool,
];
