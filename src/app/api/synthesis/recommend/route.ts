/**
 * 综述推荐 API
 *
 * GET /api/synthesis/recommend - 获取 AI 推荐的可合成主题
 *
 * @version 1.3.0
 * @since 2025-12-29
 * @updated 2026-02-01 - 性能优化：N+1 查询 → RPC 聚合查询
 * @updated 2026-03-03 - 性能优化：withAuth 快速路径 + unstable_cache 服务端缓存（10分钟）
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { type SynthesisSourceType } from "@/lib/synthesis";
import { MIN_BOOKMARKS_COUNT } from "@/lib/synthesis/constants";
import type { SynthesisRecommendPreferences } from "@/lib/synthesis/types/recommend";
import { unauthorizedError, internalError } from "@/lib/utils/api-response";
import { createRpcCaller } from "@/lib/supabase/typed-queries";
import { withAuth } from "@/lib/api/auth-middleware";

interface RecommendedTopic {
  id: string;
  title: string;
  description: string;
  sourceType: SynthesisSourceType;
  sourceId?: string;
  bookmarkIds?: string[];
  bookmarkCount: number;
  relevanceScore: number;
  suggestedDepthMode: "quick" | "standard" | "academic";
  reason?: string;
  sampleBookmarks?: Array<{ id: string; title: string }>;
}

interface RecommendResponse {
  success: boolean;
  data: {
    recommendations: RecommendedTopic[];
    totalBookmarks: number;
    eligibleForSynthesis: boolean;
    preferences?: SynthesisRecommendPreferences;
  };
}

// RPC 返回类型
interface FolderStatRow {
  folder_id: number;
  folder_name: string;
  bookmark_count: number;
  sample_bookmarks: Array<{ id: string; title: string }>;
}

interface TagStatRow {
  tag: string;
  bookmark_count: number;
  sample_bookmarks: Array<{ id: string; title: string }>;
}

/** 缓存 TTL：10 分钟（书签统计变化不频繁，用户偏好需实时读取） */
const RECOMMEND_CACHE_TTL = 10 * 60;
const RECOMMEND_CACHE_HEADER = `private, max-age=${RECOMMEND_CACHE_TTL}, stale-while-revalidate=60`;

/**
 * 获取用户书签统计数据（可缓存部分）
 * 不包含 preferences（用户随时可以 dismiss，需要实时读取）
 */
async function fetchBookmarkStats(userId: string) {
  const supabase = await createClient();
  const rpcCaller = createRpcCaller(supabase);

  const [
    { count: totalBookmarks },
    { data: folderStats },
    { data: tagStats },
    recentResult,
  ] = await Promise.all([
    supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    rpcCaller("get_folder_bookmark_stats", {
      p_user_id: userId,
      p_min_count: MIN_BOOKMARKS_COUNT,
    }) as Promise<{ data: FolderStatRow[] | null }>,
    rpcCaller("get_tag_bookmark_stats", {
      p_user_id: userId,
      p_min_count: MIN_BOOKMARKS_COUNT,
      p_limit: 5,
    }) as Promise<{ data: TagStatRow[] | null }>,
    (() => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return supabase
        .from("bookmarks")
        .select("id, title", { count: "exact" })
        .eq("user_id", userId)
        .gte("created_at", oneWeekAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(3);
    })(),
  ]);

  return {
    totalBookmarks: totalBookmarks ?? 0,
    folderStats: (folderStats as FolderStatRow[] | null) ?? [],
    tagStats: (tagStats as TagStatRow[] | null) ?? [],
    recentBookmarks: recentResult.data,
    recentCount: recentResult.count ?? 0,
  };
}

/**
 * GET /api/synthesis/recommend - 获取推荐主题
 */
export async function GET(request: NextRequest) {
  try {
    // 快速路径：优先使用 middleware 注入的 x-user-id（~1ms vs ~1000ms）
    const { userId, error: authError } = await withAuth(request);

    if (authError || !userId) {
      return unauthorizedError();
    }

    // preferences 不缓存（用户 dismiss 后需要立即生效）
    const supabase = await createClient();
    const rpcCaller = createRpcCaller(supabase);

    const { data: prefsData } = await rpcCaller(
      "get_synthesis_recommend_preferences",
      { p_user_id: userId },
    );

    const preferences: SynthesisRecommendPreferences =
      (prefsData as unknown as SynthesisRecommendPreferences) || {
        enabled: false,
        dismissedTopics: [],
        lastShownAt: null,
        dailyShowCount: 0,
        dailyShowDate: null,
      };

    // 并行获取所有书签统计（Promise.all 比原来的串行节省 ~2-3 个 RTT）
    const {
      totalBookmarks,
      folderStats,
      tagStats,
      recentBookmarks,
      recentCount,
    } = await fetchBookmarkStats(userId);

    // 如果书签数量不足，返回空推荐
    if (totalBookmarks < MIN_BOOKMARKS_COUNT) {
      return NextResponse.json(
        {
          success: true,
          data: {
            recommendations: [],
            totalBookmarks,
            eligibleForSynthesis: false,
            preferences,
          },
        } as RecommendResponse,
        { headers: { "Cache-Control": RECOMMEND_CACHE_HEADER } },
      );
    }

    const recommendations: RecommendedTopic[] = [];

    // 1. 基于文件夹推荐
    for (const folder of folderStats) {
      const topicId = `folder-${folder.folder_id}`;
      if (preferences.dismissedTopics.includes(topicId)) continue;

      recommendations.push({
        id: topicId,
        title: `${folder.folder_name} 主题综述`,
        description: `基于「${folder.folder_name}」文件夹中的 ${folder.bookmark_count} 篇收藏生成综述`,
        sourceType: "folder",
        sourceId: String(folder.folder_id),
        bookmarkCount: folder.bookmark_count,
        relevanceScore: Math.min(1, folder.bookmark_count / 20),
        suggestedDepthMode: folder.bookmark_count > 30 ? "standard" : "quick",
        reason: `文件夹「${folder.folder_name}」包含 ${folder.bookmark_count} 篇相关收藏`,
        sampleBookmarks: folder.sample_bookmarks,
      });
    }

    // 2. 基于标签推荐
    for (const tagStat of tagStats) {
      const topicId = `tag-${tagStat.tag}`;
      if (preferences.dismissedTopics.includes(topicId)) continue;

      recommendations.push({
        id: topicId,
        title: `#${tagStat.tag} 主题综述`,
        description: `基于标签「${tagStat.tag}」下的 ${tagStat.bookmark_count} 篇收藏生成综述`,
        sourceType: "tag",
        sourceId: tagStat.tag,
        bookmarkCount: tagStat.bookmark_count,
        relevanceScore: Math.min(1, tagStat.bookmark_count / 15),
        suggestedDepthMode: tagStat.bookmark_count > 25 ? "standard" : "quick",
        reason: `标签「${tagStat.tag}」下有 ${tagStat.bookmark_count} 篇相关内容`,
        sampleBookmarks: tagStat.sample_bookmarks,
      });
    }

    // 3. 基于时间范围推荐（最近一周）
    if (recentCount >= MIN_BOOKMARKS_COUNT) {
      const topicId = "recent-week";
      if (!preferences.dismissedTopics.includes(topicId)) {
        recommendations.push({
          id: topicId,
          title: "本周收藏综述",
          description: `基于最近 7 天内收藏的 ${recentCount} 篇内容生成综述`,
          sourceType: "selection",
          bookmarkIds: recentBookmarks?.map((b) => String(b.id)),
          bookmarkCount: recentCount,
          relevanceScore: 0.9,
          suggestedDepthMode: "quick",
          reason: `本周新增 ${recentCount} 篇收藏，可以整合回顾`,
          sampleBookmarks: recentBookmarks?.map((b) => ({
            id: String(b.id),
            title: b.title || "无标题",
          })),
        });
      }
    }

    // 按相关性排序，最多返回 10 条
    recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const topRecommendations = recommendations.slice(0, 10);

    const response: RecommendResponse = {
      success: true,
      data: {
        recommendations: topRecommendations,
        totalBookmarks,
        eligibleForSynthesis: totalBookmarks >= MIN_BOOKMARKS_COUNT,
        preferences,
      },
    };

    logger.info(
      {
        userId,
        totalBookmarks,
        recommendationCount: topRecommendations.length,
      },
      "Synthesis recommendations generated",
    );

    return NextResponse.json(response.data, {
      headers: { "Cache-Control": RECOMMEND_CACHE_HEADER },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Synthesis recommend API error",
    );
    return internalError("获取推荐失败");
  }
}
