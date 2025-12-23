/**
 * AI Agent 轻量级统计服务
 *
 * 为 AI 对话上下文注入提供快速统计数据
 * 设计目标：低延迟（<100ms）、轻量级、缓存友好
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { createClient } from "@/lib/supabase/server";
import { getPlatformName } from "@/lib/constants/platforms";
import { logger } from "@/lib/logger";

// ============================================
// 类型定义
// ============================================

/**
 * 平台统计项
 */
export interface PlatformStat {
  platform: string;
  name: string;
  count: number;
}

/**
 * 文件夹统计项
 */
export interface FolderStat {
  id: number;
  name: string;
  count: number;
}

/**
 * 轻量级统计数据
 * 用于 AI 对话上下文注入
 */
export interface QuickStats {
  /** 书签总数（不含浏览器书签） */
  totalBookmarks: number;
  /** 浏览器书签数 */
  browserBookmarks: number;
  /** 文件夹总数 */
  folderCount: number;
  /** 未分类书签数 */
  uncategorized: number;
  /** 最近 7 天新增 */
  recentAdded: number;
  /** 有 AI 摘要的书签数 */
  withAiSummary: number;
  /** 收藏（星标）书签数 */
  starredCount: number;
  /** 平台分布（前 8 个） */
  platformDistribution: PlatformStat[];
  /** 常用文件夹（前 5 个） */
  topFolders: FolderStat[];
  /** 统计生成时间 */
  generatedAt: string;
}

// ============================================
// 常量
// ============================================

/** 浏览器平台列表（与 bookmark-server.repository.ts 保持一致） */
const BROWSER_PLATFORMS = [
  "BROWSER_CHROME",
  "BROWSER_EDGE",
  "BROWSER_FIREFOX",
  "BROWSER_SAFARI",
];

/** 缓存过期时间（毫秒）- 5 分钟 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** 内存缓存 */
const statsCache = new Map<string, { data: QuickStats; timestamp: number }>();

// ============================================
// 核心服务
// ============================================

/**
 * 获取用户的轻量级统计数据
 *
 * @param userId - 用户 ID
 * @param skipCache - 是否跳过缓存
 * @returns 轻量级统计数据
 */
export async function getQuickStats(
  userId: string,
  skipCache = false,
): Promise<QuickStats> {
  const startTime = performance.now();

  // 检查缓存
  if (!skipCache) {
    const cached = statsCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      logger.debug(
        { userId: userId.slice(0, 8) + "...", source: "cache" },
        "QuickStats: Cache hit",
      );
      return cached.data;
    }
  }

  try {
    const supabase = await createClient();

    // 并行执行所有查询
    const [
      bookmarkStats,
      folderCount,
      recentAdded,
      platformCounts,
      folderCounts,
    ] = await Promise.all([
      // 1. 书签基础统计（使用聚合查询）
      getBookmarkAggregates(supabase, userId),

      // 2. 文件夹总数
      getFolderCount(supabase, userId),

      // 3. 最近 7 天新增
      getRecentAddedCount(supabase, userId),

      // 4. 平台分布
      getPlatformDistribution(supabase, userId),

      // 5. 文件夹分布
      getFolderDistribution(supabase, userId),
    ]);

    const stats: QuickStats = {
      totalBookmarks: bookmarkStats.contentCount,
      browserBookmarks: bookmarkStats.browserCount,
      folderCount,
      uncategorized: bookmarkStats.uncategorized,
      recentAdded,
      withAiSummary: bookmarkStats.withAiSummary,
      starredCount: bookmarkStats.starredCount,
      platformDistribution: platformCounts,
      topFolders: folderCounts,
      generatedAt: new Date().toISOString(),
    };

    // 更新缓存
    statsCache.set(userId, { data: stats, timestamp: Date.now() });

    const duration = Math.round(performance.now() - startTime);
    logger.info(
      {
        userId: userId.slice(0, 8) + "...",
        durationMs: duration,
        totalBookmarks: stats.totalBookmarks,
      },
      "QuickStats: Generated",
    );

    return stats;
  } catch (error) {
    logger.error(
      {
        userId: userId.slice(0, 8) + "...",
        error: error instanceof Error ? error.message : String(error),
      },
      "QuickStats: Failed",
    );

    // 返回空统计
    return createEmptyStats();
  }
}

/**
 * 清除用户缓存
 */
export function clearQuickStatsCache(userId: string): void {
  statsCache.delete(userId);
}

/**
 * 清除所有缓存
 */
export function clearAllQuickStatsCache(): void {
  statsCache.clear();
}

// ============================================
// 辅助查询函数
// ============================================

interface BookmarkAggregates {
  contentCount: number;
  browserCount: number;
  uncategorized: number;
  withAiSummary: number;
  starredCount: number;
}

/**
 * 获取书签聚合统计
 */
async function getBookmarkAggregates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<BookmarkAggregates> {
  // 获取所有活跃书签的关键字段
  const { data, error } = await supabase
    .from("bookmarks")
    .select("platform, folder_id, ai_summary, is_starred")
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (error) throw error;

  const bookmarks = data || [];

  let contentCount = 0;
  let browserCount = 0;
  let uncategorized = 0;
  let withAiSummary = 0;
  let starredCount = 0;

  for (const b of bookmarks) {
    const isBrowser = BROWSER_PLATFORMS.includes(b.platform);

    if (isBrowser) {
      browserCount++;
    } else {
      contentCount++;
      if (!b.folder_id) uncategorized++;
      if (b.ai_summary) withAiSummary++;
      if (b.is_starred) starredCount++;
    }
  }

  return {
    contentCount,
    browserCount,
    uncategorized,
    withAiSummary,
    starredCount,
  };
}

/**
 * 获取文件夹总数
 */
async function getFolderCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("folders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_archived", false);

  if (error) throw error;
  return count || 0;
}

/**
 * 获取最近 7 天新增数
 */
async function getRecentAddedCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { count, error } = await supabase
    .from("bookmarks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .not(
      "platform",
      "in",
      `(${BROWSER_PLATFORMS.map((p) => `"${p}"`).join(",")})`,
    )
    .gte("created_at", sevenDaysAgo.toISOString());

  if (error) throw error;
  return count || 0;
}

/**
 * 获取平台分布
 */
async function getPlatformDistribution(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<PlatformStat[]> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("platform")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .not(
      "platform",
      "in",
      `(${BROWSER_PLATFORMS.map((p) => `"${p}"`).join(",")})`,
    );

  if (error) throw error;

  // 统计平台分布
  const platformMap = new Map<string, number>();
  for (const b of data || []) {
    const count = platformMap.get(b.platform) || 0;
    platformMap.set(b.platform, count + 1);
  }

  // 转换并排序
  const result: PlatformStat[] = [];
  for (const [platform, count] of platformMap.entries()) {
    result.push({
      platform,
      name: getPlatformName(platform),
      count,
    });
  }

  // 按数量降序，取前 8 个
  return result.sort((a, b) => b.count - a.count).slice(0, 8);
}

/**
 * 获取文件夹分布
 */
async function getFolderDistribution(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<FolderStat[]> {
  // 获取所有文件夹
  const { data: folders, error: folderError } = await supabase
    .from("folders")
    .select("id, name")
    .eq("user_id", userId)
    .eq("is_archived", false);

  if (folderError) throw folderError;

  // 获取书签的文件夹分布
  const { data: bookmarks, error: bookmarkError } = await supabase
    .from("bookmarks")
    .select("folder_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .not("folder_id", "is", null);

  if (bookmarkError) throw bookmarkError;

  // 统计每个文件夹的书签数
  const folderCountMap = new Map<number, number>();
  for (const b of bookmarks || []) {
    if (b.folder_id) {
      const count = folderCountMap.get(b.folder_id) || 0;
      folderCountMap.set(b.folder_id, count + 1);
    }
  }

  // 构建结果
  const folderMap = new Map(folders?.map((f) => [f.id, f.name]) || []);
  const result: FolderStat[] = [];

  for (const [folderId, count] of folderCountMap.entries()) {
    const name = folderMap.get(folderId);
    if (name) {
      result.push({ id: folderId, name, count });
    }
  }

  // 按数量降序，取前 5 个
  return result.sort((a, b) => b.count - a.count).slice(0, 5);
}

/**
 * 创建空统计对象
 */
function createEmptyStats(): QuickStats {
  return {
    totalBookmarks: 0,
    browserBookmarks: 0,
    folderCount: 0,
    uncategorized: 0,
    recentAdded: 0,
    withAiSummary: 0,
    starredCount: 0,
    platformDistribution: [],
    topFolders: [],
    generatedAt: new Date().toISOString(),
  };
}

// ============================================
// 格式化函数（用于 System Prompt）
// ============================================

/**
 * 将统计数据格式化为 System Prompt 片段
 */
export function formatStatsForPrompt(stats: QuickStats): string {
  const lines: string[] = [];

  lines.push("## 用户数据概况");
  lines.push("");
  lines.push(`- 内容收藏: ${stats.totalBookmarks} 条`);
  lines.push(`- 浏览器书签: ${stats.browserBookmarks} 条`);
  lines.push(`- 文件夹: ${stats.folderCount} 个`);
  lines.push(`- 未分类: ${stats.uncategorized} 条`);
  lines.push(`- 本周新增: ${stats.recentAdded} 条`);
  lines.push(`- 有AI摘要: ${stats.withAiSummary} 条`);
  lines.push(`- 星标收藏: ${stats.starredCount} 条`);

  if (stats.platformDistribution.length > 0) {
    lines.push("");
    lines.push("### 平台分布");
    for (const p of stats.platformDistribution) {
      lines.push(`- ${p.name}: ${p.count} 条`);
    }
  }

  if (stats.topFolders.length > 0) {
    lines.push("");
    lines.push("### 常用文件夹");
    for (const f of stats.topFolders) {
      lines.push(`- ${f.name}: ${f.count} 条`);
    }
  }

  return lines.join("\n");
}
