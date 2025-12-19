// 标记为动态路由
export const dynamic = "force-dynamic";

/**
 * 数据统计页面 - 服务端组件
 * 使用 AnalyticsService 统一服务层获取数据
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsPageClient } from "@/components/analytics/analytics-page-client";
import { getAnalyticsData } from "@/lib/analytics";

// 获取分析数据的辅助函数
async function fetchAnalyticsData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  try {
    // 使用服务层获取分析数据（带 React cache 缓存）
    // Phase 3: 启用时间对比和 AI 统计功能
    const analyticsData = await getAnalyticsData(supabase, userId, {
      mergeBrowserPlatforms: true,
      includeComparison: true,
      includeAIStats: true,
    });
    return { data: analyticsData, error: null };
  } catch (error) {
    console.error("Analytics data fetch error:", error);
    return {
      data: {
        stats: {
          totalBookmarks: 0,
          contentBookmarks: 0,
          browserBookmarks: 0,
          todayCount: 0,
          weekCount: 0,
          last30DaysCount: 0,
          unclassifiedCount: 0,
          classificationRate: 0,
        },
        trendData: [],
        platformData: [],
        folderData: [],
        tagData: [],
        typeData: [],
        generatedAt: new Date().toISOString(),
      },
      error: "加载数据统计时出错，请稍后重试",
    };
  }
}

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

  const { data: analyticsData, error } = await fetchAnalyticsData(
    supabase,
    user.id,
  );

  return (
    <AnalyticsPageClient data={analyticsData} error={error ?? undefined} />
  );
}
