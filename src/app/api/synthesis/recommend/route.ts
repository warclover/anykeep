/**
 * 综述推荐 API
 *
 * GET /api/synthesis/recommend - 获取 AI 推荐的可合成主题
 *
 * @version 1.1.0
 * @since 2025-12-29
 * @updated 2025-12-29 - 添加用户偏好返回和代表书签
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { type SynthesisSourceType, SynthesisErrorCode } from "@/lib/synthesis";
import { MIN_BOOKMARKS_COUNT } from "@/lib/synthesis/constants";
import type { SynthesisRecommendPreferences } from "@/lib/synthesis/types/recommend";

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

    // 1. 基于文件夹推荐
    // 类型断言: 手动维护类型文件时需要此断言
    type FolderRow = { id: number; name: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: folders } = await (supabase.from("folders") as any)
      .select("id, name")
      .eq("user_id", user.id) as { data: FolderRow[] | null };

    if (folders) {
      for (const folder of folders) {
        // 获取文件夹内书签数量和代表书签
        type FolderBookmarkRow = { id: number; title: string | null };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: folderBookmarks, count } = await (supabase.from("bookmarks") as any)
          .select("id, title", { count: "exact" })
          .eq("user_id", user.id)
          .eq("folder_id", folder.id)
          .order("created_at", { ascending: false })
          .limit(3) as { data: FolderBookmarkRow[] | null; count: number | null };

        const folderBookmarkCount = count || 0;

        if (folderBookmarkCount >= MIN_BOOKMARKS_COUNT) {
          const topicId = `folder-${folder.id}`;

          // 跳过已忽略的主题
          if (preferences.dismissedTopics.includes(topicId)) {
            continue;
          }

          recommendations.push({
            id: topicId,
            title: `${folder.name} 主题综述`,
            description: `基于「${folder.name}」文件夹中的 ${folderBookmarkCount} 篇收藏生成综述`,
            sourceType: "folder",
            sourceId: String(folder.id),
            bookmarkCount: folderBookmarkCount,
            relevanceScore: Math.min(1, folderBookmarkCount / 20),
            suggestedDepthMode: folderBookmarkCount > 30 ? "standard" : "quick",
            reason: `文件夹「${folder.name}」包含 ${folderBookmarkCount} 篇相关收藏`,
            sampleBookmarks: folderBookmarks?.map((b) => ({
              id: String(b.id),
              title: b.title || "无标题",
            })),
          });
        }
      }
    }

    // 2. 基于标签推荐
    type TagStatsRow = { id: number; title: string | null; ai_tags: string[] | null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tagStats } = await (supabase.from("bookmarks") as any)
      .select("id, title, ai_tags")
      .eq("user_id", user.id)
      .not("ai_tags", "is", null) as { data: TagStatsRow[] | null };

    if (tagStats) {
      // 统计标签频率和收集代表书签
      const tagData: Record<
        string,
        { count: number; samples: Array<{ id: string; title: string }> }
      > = {};

      for (const bookmark of tagStats) {
        const tags = bookmark.ai_tags as string[] | null;
        if (tags && Array.isArray(tags)) {
          for (const tag of tags) {
            if (!tagData[tag]) {
              tagData[tag] = { count: 0, samples: [] };
            }
            tagData[tag].count += 1;
            if (tagData[tag].samples.length < 3) {
              tagData[tag].samples.push({
                id: String(bookmark.id),
                title: bookmark.title || "无标题",
              });
            }
          }
        }
      }

      // 筛选出满足条件的标签
      const eligibleTags = Object.entries(tagData)
        .filter(([, data]) => data.count >= MIN_BOOKMARKS_COUNT)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);

      for (const [tag, data] of eligibleTags) {
        const topicId = `tag-${tag}`;

        // 跳过已忽略的主题
        if (preferences.dismissedTopics.includes(topicId)) {
          continue;
        }

        recommendations.push({
          id: topicId,
          title: `#${tag} 主题综述`,
          description: `基于标签「${tag}」下的 ${data.count} 篇收藏生成综述`,
          sourceType: "tag",
          sourceId: tag,
          bookmarkCount: data.count,
          relevanceScore: Math.min(1, data.count / 15),
          suggestedDepthMode: data.count > 25 ? "standard" : "quick",
          reason: `标签「${tag}」下有 ${data.count} 篇相关内容`,
          sampleBookmarks: data.samples,
        });
      }
    }

    // 3. 基于时间范围推荐（最近一周）
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    type RecentBookmarkRow = { id: number; title: string | null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recentBookmarks, count: recentCount } = await (supabase.from("bookmarks") as any)
      .select("id, title", { count: "exact" })
      .eq("user_id", user.id)
      .gte("created_at", oneWeekAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(3) as { data: RecentBookmarkRow[] | null; count: number | null };

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

    logger.info(
      {
        userId: user.id,
        totalBookmarks: bookmarkCount,
        recommendationCount: topRecommendations.length,
      },
      "Synthesis recommendations generated",
    );

    return NextResponse.json({
      success: true,
      data: {
        recommendations: topRecommendations,
        totalBookmarks: bookmarkCount,
        eligibleForSynthesis: bookmarkCount >= MIN_BOOKMARKS_COUNT,
        preferences,
      },
    } as RecommendResponse);
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
