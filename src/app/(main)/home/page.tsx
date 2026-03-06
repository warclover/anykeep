/**
 * 我的收藏 - 收藏列表
 *
 * 性能优化 V3 (Streaming SSR + Request Cache):
 * - 使用 Suspense 边界实现流式 SSR，首屏立即返回骨架屏
 * - 数据加载异步进行，不阻塞 HTML 返回
 * - 使用 React cache() 在同一请求中缓存数据查询
 * - 客户端 SWR 缓存确保数据新鲜度
 *
 * V4.2.27 性能优化：
 * - 使用 Middleware 预验证的 x-user-id header
 * - 消除 Server Component 中的重复认证调用（节省 ~1000ms）
 *
 * V4.2.30 性能优化：
 * - 使用 unstable_cache 缓存用户设置（5 分钟）
 * - 减少重复数据库查询
 *
 * V4.2.32 性能优化：
 * - 使用 Promise.all 并行获取书签和用户设置，减少首屏等待时间
 */

import { Suspense, cache } from "react";
import { unstable_cache } from "next/cache";
import { HomePageClientLayered } from "@/components/home/home-page-client-layered";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PAGE_SIZE } from "@/components/home/constants";
import { getAuthenticatedUserIdFromCookies } from "@/lib/server/auth";
import { logger } from "@/lib/logger";
import HomeLoading from "./loading";
import type { Bookmark, Platform } from "@/types/supabase";
import { mergeWithDefaults } from "@/types/user-settings";
import type { UserSettings } from "@/types/user-settings";

// 动态渲染（用户特定数据）
export const dynamic = "force-dynamic";

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

/**
 * 从数据库获取用户设置（带持久化缓存）
 * V4.2.30: 使用 unstable_cache 缓存，减少重复数据库查询
 * 修复：缓存键包含 userId，避免不同用户共享缓存导致 RSC 序列化失败
 */
function getCachedUserSettings(userId: string) {
  return unstable_cache(
    async (): Promise<UserSettings> => {
      try {
        const supabase = await createClient();
        const { data } = (await supabase
          .from("profiles")
          .select("settings")
          .eq("id", userId)
          .single()) as unknown as { data: { settings: unknown } | null };

        return mergeWithDefaults(
          data?.settings as Partial<UserSettings> | null,
        );
      } catch (error) {
        logger.error({ error, userId }, "[Home] Failed to get user settings");
        return mergeWithDefaults(null);
      }
    },
    ["user-settings", userId],
    {
      revalidate: 60, // 1 分钟缓存，缩短以确保设置变更及时生效
      tags: ["user-settings"],
    },
  )();
}

/**
 * 获取用户设置（带请求级缓存）
 * V5.5: 从 cookies 读取用户信息，避免 RSC payload 请求失败
 * V4.2.30: 结合 unstable_cache 实现持久化缓存
 */
const getUserSettings = cache(async (): Promise<UserSettings> => {
  try {
    const userId = await getAuthenticatedUserIdFromCookies();
    if (!userId) {
      return mergeWithDefaults(null);
    }

    // V4.2.30: 使用持久化缓存获取用户设置
    return getCachedUserSettings(userId);
  } catch (error) {
    logger.error({ error }, "[Home] Failed to resolve user for settings");
    return mergeWithDefaults(null);
  }
});

/**
 * 获取初始书签数据（带请求级缓存）
 * 使用 React cache() 确保同一请求中多次调用只执行一次查询
 *
 * V4.2.27: 使用 Middleware 预验证的 userId，跳过重复认证
 * V4.2.28: 添加回退机制，解决登录后 session 同步延迟问题
 * V5.5: 从 cookies 读取用户信息，避免 RSC payload 请求失败
 */
const getInitialBookmarks = cache(
  async (
    platform: string,
    sort: string,
    folder: string,
  ): Promise<{ bookmarks: BookmarkWithFolder[]; error?: string }> => {
    const startTime = performance.now();

    try {
      // V4.2.31: 使用统一认证函数（带 session 回退）
      const userId = await getAuthenticatedUserIdFromCookies();
      if (!userId) {
        return { bookmarks: [], error: "请先登录" };
      }

      const supabase = await createClient();
      const clientTime = performance.now() - startTime;

      let query = supabase
        .from("bookmarks")
        .select("*, folders!bookmarks_folder_id_fkey(name)")
        .eq("user_id", userId)
        .is("deleted_at", null);

      // 虚拟文件夹筛选（优先级最高）
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
        // 兼容 is_in_trash 为 NULL 的情况（与 API GET 保持一致）
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
        // "全部"时排除浏览器平台
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

      // SSR 阶段使用默认分页大小（客户端视图模式未知）
      query = query.limit(DEFAULT_PAGE_SIZE);

      const { data, error } = await query;
      const totalTime = performance.now() - startTime;
      const _queryTime = totalTime - clientTime;

      // V4.2.27: 诊断日志 - Server Component 数据加载耗时
      // 已移除 console.error，改用结构化日志

      if (error) {
        return { bookmarks: [], error: error.message };
      }

      // 确保数据可被 RSC 安全序列化（过滤 undefined / 函数等不可序列化值）
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

interface HomePageProps {
  searchParams: Promise<{
    platform?: string;
    sort?: string;
    folder?: string;
    smartList?: string;
  }>;
}

/**
 * 异步数据加载组件
 * 被 Suspense 包裹，加载时显示骨架屏
 *
 * V4.2.32: 使用 Promise.all 并行获取书签和用户设置
 * 优化前：串行等待，总耗时 = getInitialBookmarks + getUserSettings
 * 优化后：并行执行，总耗时 ≈ max(getInitialBookmarks, getUserSettings)
 */
async function HomePageWithData({
  platform,
  sort,
  folder,
}: {
  platform: string;
  sort: string;
  folder: string;
}) {
  // V4.2.32: 并行获取书签数据和用户设置，减少首屏等待时间
  const [bookmarksResult, userSettings] = await Promise.all([
    getInitialBookmarks(platform, sort, folder),
    getUserSettings(),
  ]);

  return (
    <HomePageClientLayered
      initialBookmarks={bookmarksResult.bookmarks}
      error={bookmarksResult.error}
      userSettings={userSettings}
    />
  );
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const platform = params.platform || "";
  const sort = params.sort || "created_desc";
  const folder = params.folder || "";
  const smartListId = params.smartList ? parseInt(params.smartList, 10) : null;

  // 智能列表视图模式：不预加载书签，由客户端组件处理
  if (smartListId && !isNaN(smartListId)) {
    const userSettings = await getUserSettings();
    return (
      <ErrorBoundary>
        <HomePageClientLayered
          smartListId={smartListId}
          userSettings={userSettings}
        />
      </ErrorBoundary>
    );
  }

  // 使用 Suspense 实现流式 SSR
  // 首屏立即返回骨架屏，数据加载完成后流式更新
  return (
    <ErrorBoundary>
      <Suspense fallback={<HomeLoading />}>
        <HomePageWithData platform={platform} sort={sort} folder={folder} />
      </Suspense>
    </ErrorBoundary>
  );
}
