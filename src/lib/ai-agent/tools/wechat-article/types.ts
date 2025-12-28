/**
 * Wechat Article Tools 类型定义
 *
 * 微信文章相关 AI Agent Tools 的共享类型
 *
 * 注意：list_wechat_articles 相关类型在 query 模块中定义
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

// ============================================
// get_wechat_article_stats 返回类型
// ============================================

/**
 * 微信文章统计结果
 */
export interface WechatArticleStatsResult {
  /** 总文章数 */
  totalArticles: number;
  /** 总图片数 */
  totalImages: number;
  /** 成功持久化的图片数 */
  successImages: number;
  /** 持久化失败的图片数 */
  failedImages: number;
  /** 存储空间使用（字节） */
  storageUsed: number;
  /** 存储空间使用（友好格式） */
  storageUsedFormatted: string;
  /** 图片成功率 */
  imageSuccessRate: string;
  /** 友好消息 */
  message: string;
}

// ============================================
// 工具函数
// ============================================

/**
 * 格式化存储大小
 */
export function formatStorageSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
