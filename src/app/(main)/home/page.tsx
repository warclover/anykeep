/**
 * 首页 - 收藏列表
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
 */

import { Suspense, cache } from "react";
import { headers } from "next/headers";
import { HomePageClient } from "@/components/home/home-page-client";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PAGE_SIZE } from "@/components/home/constants";
import HomeLoading from "./loading";
import type { Bookmark, Platform } from "@/types/supabase";

// 动态渲染（用户特定数据）
export const dynamic = "force-dynamic";

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

/**
 * 获取初始书签数据（带请求级缓存）
 * 使用 React cache() 确保同一请求中多次调用只执行一次查询
 *
 * V4.2.27: 使用 Middleware 预验证的 userId，跳过重复认证
 */
const getInitialBookmarks = cache(
  async (
    platform: string,
    sort: string,
    folder: string,
  ): Promise<{ bookmarks: BookmarkWithFolder[]; error?: string }> => {
    const startTime = performance.now();

    try {
      // V4.2.27: 从 Middleware 注入的 header 获取预验证的 userId
      // 这避免了在 Server Component 中重复调用 supabase.auth.getUser()
      const headersList = await headers();
      const userId = headersList.get("x-user-id");
      const isVerified = headersList.get("x-user-verified") === "true";

      const _headerTime = performance.now() - startTime;

      if (!isVerified || !userId) {
        return { bookmarks: [], error: "请先登录" };
      }

      const supabase = await createClient();
      const clientTime = performance.now() - startTime;

      let query = supabase
        .from("bookmarks")
        .select("*, folders(name)")
        .eq("user_id", userId)
        .is("deleted_at", null);

      // 虚拟文件夹筛选（优先级最高）
      if (folder === "trash") {
        query = query.eq("is_in_trash", true);
      } else if (folder === "invalid") {
        query = query.eq("is_invalid", true).eq("is_in_trash", false);
      } else if (folder === "high-value") {
        query = query.eq("rating", 5).eq("is_in_trash", false);
      } else {
        query = query.eq("is_in_trash", false);
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

      return { bookmarks: (data as BookmarkWithFolder[]) || [] };
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
  const { bookmarks, error } = await getInitialBookmarks(
    platform,
    sort,
    folder,
  );

  return <HomePageClient initialBookmarks={bookmarks} error={error} />;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const platform = params.platform || "";
  const sort = params.sort || "created_desc";
  const folder = params.folder || "";
  const smartListId = params.smartList ? parseInt(params.smartList, 10) : null;

  // 智能列表视图模式：不预加载书签，由客户端组件处理
  if (smartListId && !isNaN(smartListId)) {
    return (
      <ErrorBoundary>
        <HomePageClient smartListId={smartListId} />
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
