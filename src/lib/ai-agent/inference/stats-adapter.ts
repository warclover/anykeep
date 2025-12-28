/**
 * 统计数据适配器
 *
 * 将现有 QuickStats 转换为推断引擎所需的 UserBookmarkStats
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { QuickStats, PlatformStat } from "../services/quick-stats.service";
import type { UserBookmarkStats } from "./types";

// =============================================================================
// 平台代码 → 域名映射
// =============================================================================

/**
 * 平台代码转域名映射
 * 用于匹配推断规则中的域名格式
 */
const PLATFORM_CODE_TO_DOMAIN: Record<string, string> = {
  WECHAT: "mp.weixin.qq.com",
  BILIBILI: "bilibili.com",
  XIAOHONGSHU: "xiaohongshu.com",
  ZHIHU: "zhihu.com",
  WEIBO: "weibo.com",
  DOUYIN: "douyin.com",
  JUEJIN: "juejin.cn",
  CSDN: "csdn.net",
  GITHUB: "github.com",
  ARXIV: "arxiv.org",
  "36KR": "36kr.com",
  PRODUCTHUNT: "producthunt.com",
  HACKERNEWS: "news.ycombinator.com",
  V2EX: "v2ex.com",
  DEDAO: "dedao.cn",
  MEDIUM: "medium.com",
  STACKOVERFLOW: "stackoverflow.com",
  TOUTIAO: "toutiao.com",
  DOUBAN: "douban.com",
  OTHER: "",
};

/**
 * 平台代码转域名
 */
function platformCodeToDomain(code: string): string | null {
  return PLATFORM_CODE_TO_DOMAIN[code] || null;
}

/**
 * 获取 7 天前的日期字符串
 */
function getSevenDaysAgo(): string {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString();
}

// =============================================================================
// 适配器函数
// =============================================================================

/**
 * 扩展的 QuickStats 类型别名（保持向后兼容）
 * @deprecated 使用 QuickStats 即可，tagFrequency 已在 v3.1 中添加
 */
export type ExtendedQuickStats = QuickStats;

/**
 * 将 QuickStats 转换为 UserBookmarkStats
 *
 * @param userId 用户 ID
 * @param stats QuickStats 数据
 */
export function adaptQuickStatsToInference(
  userId: string,
  stats: QuickStats,
): UserBookmarkStats {
  // 转换平台分布格式：PlatformStat[] → Record<string, number>
  const platformDistribution: Record<string, number> = {};

  for (const p of stats.platformDistribution) {
    // 使用域名格式（与推断规则匹配）
    const domain = platformCodeToDomain(p.platform);
    if (domain) {
      platformDistribution[domain] = p.count;
    }
  }

  return {
    userId,
    platformDistribution,
    tagFrequency: stats.tagFrequency,
    totalBookmarks: stats.totalBookmarks + stats.browserBookmarks,
    statsRange: {
      from: getSevenDaysAgo(),
      to: stats.generatedAt,
    },
  };
}

/**
 * 从平台统计数组转换为域名分布
 */
export function convertPlatformStatsToDistribution(
  platformStats: PlatformStat[],
): Record<string, number> {
  const distribution: Record<string, number> = {};

  for (const p of platformStats) {
    const domain = platformCodeToDomain(p.platform);
    if (domain) {
      distribution[domain] = p.count;
    }
  }

  return distribution;
}

/**
 * 检查是否有足够的数据进行推断
 */
export function hasEnoughDataForInference(
  stats: QuickStats,
  minSampleSize: number = 10,
): boolean {
  const totalBookmarks = stats.totalBookmarks + stats.browserBookmarks;
  return totalBookmarks >= minSampleSize;
}

/**
 * 获取支持的平台代码列表
 */
export function getSupportedPlatformCodes(): string[] {
  return Object.keys(PLATFORM_CODE_TO_DOMAIN);
}

/**
 * 检查平台代码是否支持
 */
export function isPlatformSupported(code: string): boolean {
  return (
    code in PLATFORM_CODE_TO_DOMAIN && PLATFORM_CODE_TO_DOMAIN[code] !== ""
  );
}
