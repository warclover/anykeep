/**
 * Wechat Article Tools
 *
 * 微信文章相关 AI Agent Tools 导出
 *
 * 注意：list_wechat_articles 已在 query 模块中实现
 * 本模块仅提供 get_wechat_article_stats Tool
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

export { getWechatArticleStatsTool } from "./get-wechat-article-stats.tool";

export type { WechatArticleStatsResult } from "./types";

// 批量注册用的 Tools 数组
import { getWechatArticleStatsTool } from "./get-wechat-article-stats.tool";

export const wechatArticleTools = [getWechatArticleStatsTool];
