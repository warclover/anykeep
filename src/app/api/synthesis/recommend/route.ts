/**
 * 综述推荐 API
 *
 * GET /api/synthesis/recommend - 获取 AI 推荐的可合成主题
 *
 * @version 1.2.0
 * @since 2025-12-29
 * @updated 2026-02-01 - 性能优化：N+1 查询 → RPC 聚合查询
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { type SynthesisSourceType, SynthesisErrorCode } from "@/lib/synthesis";
import { MIN_BOOKMARKS_COUNT } from "@/lib/synthesis/constants";
import type { SynthesisRecommendPreferences } from "@/lib/synthesis/types/recommend";

// 内存缓存（5分钟有效期）
const cache = new Map<string, { data: RecommendResponse; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

/**
 * GET /api/synthesis/recommend - 获取推荐主题
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // 验证用户
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", code: SynthesisErrorCode.UNAUTHORIZED },
        { status: 401 },
      );
    }

    // P2: 检查缓存
    const cacheKey = `synthesis:recommend:${user.id}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return NextResponse.json(cached.data);
    }

    // 获取用户偏好
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prefsData } = await (supabase.rpc as any)(
      "get_synthesis_recommend_preferences",
      { p_user_id: user.id },
    );

    const preferences: SynthesisRecommendPreferences =
      (prefsData as unknown as SynthesisRecommendPreferences) || {
        enabled: false,
        dismissedTopics: [],
        lastShownAt: null,
        dailyShowCount: 0,
        dailyShowDate: null,
      };

    // 获取用户书签统计
    const { count: totalBookmarks } = await supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    const bookmarkCount = totalBookmarks || 0;

    // 如果书签数量不足，返回空推荐
    if (bookmarkCount < MIN_BOOKMARKS_COUNT) {
      return NextResponse.json({
        success: true,
        data: {
          recommendations: [],
          totalBookmarks: bookmarkCount,
          eligibleForSynthesis: false,
          preferences,
        },
      } as RecommendResponse);
    }

    const recommendations: RecommendedTopic[] = [];

    // 1. 基于文件夹推荐 - 使用 RPC 聚合查询（替代 N+1 循环）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: folderStats } = (await (supabase.rpc as any)(
      "get_folder_bookmark_stats",
      { p_user_id: user.id, p_min_count: MIN_BOOKMARKS_COUNT },
    )) as { data: FolderStatRow[] | null };

    if (folderStats) {
      for (const folder of folderStats) {
        const topicId = `folder-${folder.folder_id}`;

        // 跳过已忽略的主题
        if (preferences.dismissedTopics.includes(topicId)) {
          continue;
        }

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
    }

    // 2. 基于标签推荐 - 使用 RPC 聚合查询（替代内存遍历）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tagStats } = (await (supabase.rpc as any)(
      "get_tag_bookmark_stats",
      { p_user_id: user.id, p_min_count: MIN_BOOKMARKS_COUNT, p_limit: 5 },
    )) as { data: TagStatRow[] | null };

    if (tagStats) {
      for (const tagStat of tagStats) {
        const topicId = `tag-${tagStat.tag}`;

        // 跳过已忽略的主题
        if (preferences.dismissedTopics.includes(topicId)) {
          continue;
        }

        recommendations.push({
          id: topicId,
          title: `#${tagStat.tag} 主题综述`,
          description: `基于标签「${tagStat.tag}」下的 ${tagStat.bookmark_count} 篇收藏生成综述`,
          sourceType: "tag",
          sourceId: tagStat.tag,
          bookmarkCount: tagStat.bookmark_count,
          relevanceScore: Math.min(1, tagStat.bookmark_count / 15),
          suggestedDepthMode:
            tagStat.bookmark_count > 25 ? "standard" : "quick",
          reason: `标签「${tagStat.tag}」下有 ${tagStat.bookmark_count} 篇相关内容`,
          sampleBookmarks: tagStat.sample_bookmarks,
        });
      }
    }

    // 3. 基于时间范围推荐（最近一周）
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    type RecentBookmarkRow = { id: number; title: string | null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recentBookmarks, count: recentCount } = (await (
      supabase.from("bookmarks") as any
    )
      .select("id, title", { count: "exact" })
      .eq("user_id", user.id)
      .gte("created_at", oneWeekAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(3)) as { data: RecentBookmarkRow[] | null; count: number | null };

    if (recentCount && recentCount >= MIN_BOOKMARKS_COUNT) {
      const topicId = "recent-week";

      // 跳过已忽略的主题
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

    // 按相关性排序
    recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // 限制推荐数量
    const topRecommendations = recommendations.slice(0, 10);

    const response: RecommendResponse = {
      success: true,
      data: {
        recommendations: topRecommendations,
        totalBookmarks: bookmarkCount,
        eligibleForSynthesis: bookmarkCount >= MIN_BOOKMARKS_COUNT,
        preferences,
      },
    };

    // P2: 写入缓存
    cache.set(cacheKey, { data: response, expiry: Date.now() + CACHE_TTL });

    logger.info(
      {
        userId: user.id,
        totalBookmarks: bookmarkCount,
        recommendationCount: topRecommendations.length,
      },
      "Synthesis recommendations generated",
    );

    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Synthesis recommend API error",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
