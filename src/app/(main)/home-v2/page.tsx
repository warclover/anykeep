/**
 * Home V2 — SSR 入口
 *
 * 性能优化（对比旧版 home/page.tsx）：
 * - B1 修复：删除 unstable_cache，改用客户端 TanStack Query 缓存
 * - B2 修复：认证函数用 React cache() 包装，同一请求只执行一次
 * - B3 修复：使用 BOOKMARK_HOMEPAGE_SELECT 精简查询字段
 * - B6 修复：SSR 数据注入 initialData + staleTime 防止立即 revalidate
 * - B7 修复：settings 在 SSR 获取后传给客户端，不再独立查询
 *
 * @since home-v2
 */

import { Suspense, cache } from "react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PAGE_SIZE } from "@/components/home/constants";
import { BOOKMARK_HOMEPAGE_SELECT } from "@/lib/constants/query-fields";
import { getAuthenticatedUserIdFromCookies } from "@/lib/server/auth";
import { logger } from "@/lib/logger";
import HomeV2Loading from "./loading";
import type { Platform } from "@/types/supabase";
import type { BookmarkWithFolder as LegacyBookmarkWithFolder } from "@/components/home/types";
import { HomeV2Orchestrator } from "@/components/home-v2/orchestrator";
import { mergeWithDefaults } from "@/types/user-settings";
import type { UserSettings } from "@/types/user-settings";

// 动态渲染（用户特定数据）
export const dynamic = "force-dynamic";

// ============================================================================
// B2 修复：认证只执行一次（React cache 在同一请求中去重）
// ============================================================================

const getAuthUserId = cache(async (): Promise<string | null> => {
  try {
    return await getAuthenticatedUserIdFromCookies();
  } catch (error) {
    logger.error({ error }, "[Home-V2] Failed to get authenticated user");
    return null;
  }
});

// ============================================================================
// B7 修复：settings 使用同一个 userId 缓存，不重复认证
// ============================================================================

const getUserSettings = cache(async (): Promise<UserSettings> => {
  try {
    const userId = await getAuthUserId();
    if (!userId) return mergeWithDefaults(null);

    const supabase = await createClient();
    const { data } = (await supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .single()) as unknown as { data: { settings: unknown } | null };

    return mergeWithDefaults(data?.settings as Partial<UserSettings> | null);
  } catch (error) {
    logger.error({ error }, "[Home-V2] Failed to get user settings");
    return mergeWithDefaults(null);
  }
});

// ============================================================================
// B3 修复：精简查询字段（排除 embedding/search_vector 等大字段）
// ============================================================================

type BookmarkWithFolder = Record<string, unknown> & {
  id: number;
  title: string;
  url: string;
  folders?: { name: string } | null;
};

const getInitialBookmarks = cache(
  async (
    platform: string,
    sort: string,
    folder: string,
  ): Promise<{ bookmarks: BookmarkWithFolder[]; error?: string }> => {
    try {
      const userId = await getAuthUserId();
      if (!userId) {
        return { bookmarks: [], error: "请先登录" };
      }

      const supabase = await createClient();

      // B3: 精简字段查询
      let query = supabase
        .from("bookmarks")
        .select(BOOKMARK_HOMEPAGE_SELECT)
        .eq("user_id", userId)
        .is("deleted_at", null);

      // 虚拟文件夹筛选
      if (folder === "trash") {
        query = query.eq("is_in_trash", true);
      } else if (folder === "invalid") {
        query = query
          .eq("is_invalid", true)
          .or("is_in_trash.eq.false,is_in_trash.is.null");
      } else if (folder === "high-value") {
        query = query
          .eq("rating", 5)
          .or("is_in_trash.eq.false,is_in_trash.is.null");
      } else {
        query = query.or("is_in_trash.eq.false,is_in_trash.is.null");
      }

      // 平台筛选
      if (platform === "browser") {
        query = query.in("platform", [
          "BROWSER_CHROME",
          "BROWSER_EDGE",
          "BROWSER_FIREFOX",
          "BROWSER_SAFARI",
        ]);
      } else if (platform) {
        query = query.eq("platform", platform as Platform);
      } else {
        query = query.not(
          "platform",
          "in",
          '("BROWSER_CHROME","BROWSER_EDGE","BROWSER_FIREFOX","BROWSER_SAFARI")',
        );
      }

      // 排序
      const sortField = sort?.split("_")[0] || "created";
      const ascending = sort?.endsWith("_asc") || false;
      if (sortField === "created") {
        query = query.order("created_at", { ascending });
      } else if (sortField === "title") {
        query = query.order("title", { ascending, nullsFirst: false });
      }

      query = query.limit(DEFAULT_PAGE_SIZE);

      const { data, error } = await query;

      if (error) {
        return { bookmarks: [], error: error.message };
      }

      // RSC 安全序列化
      const safeData = JSON.parse(
        JSON.stringify(data ?? []),
      ) as BookmarkWithFolder[];
      return { bookmarks: safeData };
    } catch (error) {
      return {
        bookmarks: [],
        error: error instanceof Error ? error.message : "加载失败",
      };
    }
  },
);

// ============================================================================
// 页面组件
// ============================================================================

interface HomeV2PageProps {
  searchParams: Promise<{
    platform?: string;
    sort?: string;
    folder?: string;
    smartList?: string;
    usageTags?: string;
  }>;
}

/**
 * 异步数据加载组件（Suspense 边界内）
 */
async function HomeV2WithData({
  platform,
  sort,
  folder,
  smartListId,
  usageTags,
}: {
  platform: string;
  sort: string;
  folder: string;
  smartListId: number | null;
  usageTags: string[];
}) {
  // 智能列表模式：暂时复用旧组件（后续迁移）
  if (smartListId) {
    const userSettings = await getUserSettings();
    const { HomePageClientLayered } = await import(
      "@/components/home/home-page-client-layered"
    );
    return (
      <HomePageClientLayered
        smartListId={smartListId}
        userSettings={userSettings}
      />
    );
  }

  // 并行获取书签和设置
  const [bookmarksResult, userSettings] = await Promise.all([
    getInitialBookmarks(platform, sort, folder),
    getUserSettings(),
  ]);

  return (
    <HomeV2Orchestrator
      initialBookmarks={
        bookmarksResult.bookmarks as unknown as LegacyBookmarkWithFolder[]
      }
      initialError={bookmarksResult.error}
      userSettings={userSettings}
      usageTags={usageTags}
    />
  );
}

export default async function HomeV2Page({ searchParams }: HomeV2PageProps) {
  const params = await searchParams;
  const platform = params.platform || "";
  const sort = params.sort || "created_desc";
  const folder = params.folder || "";
  const smartListId = params.smartList ? parseInt(params.smartList, 10) : null;
  const usageTags = params.usageTags
    ? params.usageTags.split(",").filter(Boolean)
    : [];

  return (
    <ErrorBoundary>
      <Suspense fallback={<HomeV2Loading />}>
        <HomeV2WithData
          platform={platform}
          sort={sort}
          folder={folder}
          smartListId={smartListId && !isNaN(smartListId) ? smartListId : null}
          usageTags={usageTags}
        />
      </Suspense>
    </ErrorBoundary>
  );
}
