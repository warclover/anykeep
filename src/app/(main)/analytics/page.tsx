// 标记为动态路由
export const dynamic = "force-dynamic";

/**
 * 数据统计页面 - 服务端组件
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsPageClient } from "@/components/analytics/analytics-page-client";
import type { Platform } from "@/types/supabase";
import {
  getPlatformName,
  getPlatformHexColor,
} from "@/lib/constants/platforms";
import { ANALYTICS } from "@/lib/constants/app";

export default async function AnalyticsPage() {
  const supabase = await createClient();

  // 获取当前用户
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // 获取所有收藏（用于统计）
  const { data: bookmarks, error: bookmarksError } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (bookmarksError) {
    return (
      <AnalyticsPageClient
        data={{ trendData: [], platformData: [], tagData: [], typeData: [] }}
        error="加载数据统计时出错，请稍后重试"
      />
    );
  }

  if (!bookmarks) {
    return (
      <AnalyticsPageClient
        data={{ trendData: [], platformData: [], tagData: [], typeData: [] }}
      />
    );
  }

  // 1. 收藏趋势数据
  const trendDaysAgo = new Date();
  trendDaysAgo.setDate(trendDaysAgo.getDate() - ANALYTICS.TREND_DAYS);

  const trendMap = new Map<string, number>();
  bookmarks.forEach((bookmark) => {
    const date = new Date(bookmark.created_at);
    if (date >= trendDaysAgo) {
      const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD
      trendMap.set(dateKey, (trendMap.get(dateKey) || 0) + 1);
    }
  });

  // 填充缺失日期（确保连续）
  const trendData = [];
  for (let i = ANALYTICS.TREND_DAYS - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split("T")[0];
    trendData.push({
      date: dateKey,
      count: trendMap.get(dateKey) || 0,
    });
  }

  // 2. 平台分布数据
  const platformMap = new Map<Platform, number>();
  bookmarks.forEach((bookmark) => {
    const platform = bookmark.platform;
    platformMap.set(platform, (platformMap.get(platform) || 0) + 1);
  });

  const platformData = Array.from(platformMap.entries()).map(
    ([platform, count]) => ({
      name: getPlatformName(platform),
      value: count,
      color: getPlatformHexColor(platform),
    }),
  );

  // 3. 热门标签数据
  const tagMap = new Map<string, number>();
  bookmarks.forEach((bookmark) => {
    bookmark.ai_tags?.forEach((tag: string) => {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
    });
  });

  const tagData = Array.from(tagMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, ANALYTICS.TOP_TAGS_COUNT)
    .map(([tag, count]) => ({
      tag,
      count,
    }));

  // 4. 内容类型统计（根据平台推测）
  const typeMap: Record<string, number> = {
    文章: 0,
    视频: 0,
    图文: 0,
  };

  bookmarks.forEach((bookmark) => {
    if (bookmark.platform === "BILIBILI") {
      typeMap["视频"]++;
    } else if (bookmark.platform === "XIAOHONGSHU") {
      typeMap["图文"]++;
    } else {
      typeMap["文章"]++;
    }
  });

  const typeData = Object.entries(typeMap)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => ({
      type,
      count,
    }));

  return (
    <AnalyticsPageClient
      data={{
        trendData,
        platformData,
        tagData,
        typeData,
      }}
    />
  );
}
