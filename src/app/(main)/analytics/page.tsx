// 标记为动态路由，禁用所有缓存
export const dynamic = "force-dynamic";

/**
 * 数据统计页面 - 服务端组件
 * 使用 AnalyticsService 统一服务层获取数据
 *
 * 重要：此页面不使用 Keep-Alive 缓存，确保每次访问都获取最新数据
 * @see src/contexts/navigation-context.tsx - analytics 已从 PAGE_IDS 移除
 *
 * V4.2.28: 添加回退机制，解决登录后 session 同步延迟问题
 */

import { createClient } from "@/lib/supabase/server";
import { AnalyticsPageClient } from "@/components/analytics/analytics-page-client";
import { getAnalyticsData } from "@/lib/analytics";
import { getAuthenticatedUserIdWithFallback } from "@/lib/server/auth";
import { logger } from "@/lib/logger";

// 默认空数据
const EMPTY_ANALYTICS_DATA = {
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
};

// 获取分析数据的辅助函数
async function fetchAnalyticsData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  try {
    // 使用服务层获取分析数据
    // Phase 3: 启用时间对比和 AI 统计功能
    const analyticsData = await getAnalyticsData(supabase, userId, {
      mergeBrowserPlatforms: true,
      includeComparison: true,
      includeAIStats: true,
      includeSkillsStats: true,
    });
    return { data: analyticsData, error: null };
  } catch (err) {
    logger.error({ error: err }, "[Analytics] Failed to load data");
    return {
      data: EMPTY_ANALYTICS_DATA,
      error: "加载数据统计时出错，请稍后重试",
    };
  }
}

export default async function AnalyticsPage() {
  // V4.2.31: 使用统一认证函数（带 session 回退）
  const userId = await getAuthenticatedUserIdWithFallback();
  if (!userId) {
    return <AnalyticsPageClient data={EMPTY_ANALYTICS_DATA} error="请先登录" />;
  }

  const supabase = await createClient();

  const { data: analyticsData, error } = await fetchAnalyticsData(
    supabase,
    userId,
  );

  return (
    <AnalyticsPageClient data={analyticsData} error={error ?? undefined} />
  );
}
