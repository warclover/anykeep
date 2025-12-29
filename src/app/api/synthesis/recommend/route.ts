/**
 * 综述推荐 API
 *
 * GET /api/synthesis/recommend - 获取 AI 推荐的可合成主题
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { type SynthesisSourceType, SynthesisErrorCode } from "@/lib/synthesis";
import { MIN_BOOKMARKS_COUNT } from "@/lib/synthesis/constants";

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
}

interface RecommendResponse {
  success: boolean;
  data: {
    recommendations: RecommendedTopic[];
    totalBookmarks: number;
    eligibleForSynthesis: boolean;
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
        },
      } as RecommendResponse);
    }

    const recommendations: RecommendedTopic[] = [];

    // 1. 基于文件夹推荐
    const { data: folders } = await supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", user.id);

    if (folders) {
      for (const folder of folders) {
        const { count } = await supabase
          .from("bookmarks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("folder_id", folder.id);

        const folderBookmarkCount = count || 0;

        if (folderBookmarkCount >= MIN_BOOKMARKS_COUNT) {
          recommendations.push({
            id: `folder-${folder.id}`,
            title: `${folder.name} 主题综述`,
            description: `基于「${folder.name}」文件夹中的 ${folderBookmarkCount} 篇收藏生成综述`,
            sourceType: "folder",
            sourceId: String(folder.id),
            bookmarkCount: folderBookmarkCount,
            relevanceScore: Math.min(1, folderBookmarkCount / 20), // 20篇满分
            suggestedDepthMode: folderBookmarkCount > 30 ? "standard" : "quick",
          });
        }
      }
    }

    // 2. 基于标签推荐
    const { data: tagStats } = await supabase
      .from("bookmarks")
      .select("ai_tags")
      .eq("user_id", user.id)
      .not("ai_tags", "is", null);

    if (tagStats) {
      // 统计标签频率
      const tagCounts: Record<string, number> = {};
      for (const bookmark of tagStats) {
        const tags = bookmark.ai_tags as string[] | null;
        if (tags && Array.isArray(tags)) {
          for (const tag of tags) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        }
      }

      // 筛选出满足条件的标签
      const eligibleTags = Object.entries(tagCounts)
        .filter(([, count]) => count >= MIN_BOOKMARKS_COUNT)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5); // 最多推荐 5 个标签主题

      for (const [tag, tagCount] of eligibleTags) {
        recommendations.push({
          id: `tag-${tag}`,
          title: `#${tag} 主题综述`,
          description: `基于标签「${tag}」下的 ${tagCount} 篇收藏生成综述`,
          sourceType: "tag",
          sourceId: tag,
          bookmarkCount: tagCount,
          relevanceScore: Math.min(1, tagCount / 15), // 15篇满分
          suggestedDepthMode: tagCount > 25 ? "standard" : "quick",
        });
      }
    }

    // 3. 基于时间范围推荐（最近一周）
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: recentBookmarks, count: recentCount } = await supabase
      .from("bookmarks")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .gte("created_at", oneWeekAgo.toISOString());

    if (recentCount && recentCount >= MIN_BOOKMARKS_COUNT) {
      recommendations.push({
        id: "recent-week",
        title: "本周收藏综述",
        description: `基于最近 7 天内收藏的 ${recentCount} 篇内容生成综述`,
        sourceType: "selection",
        bookmarkIds: recentBookmarks?.map((b) => String(b.id)),
        bookmarkCount: recentCount,
        relevanceScore: 0.9, // 时间相关性高
        suggestedDepthMode: "quick",
      });
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
