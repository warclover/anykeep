/**
 * 首页 - 收藏列表
 *
 * 性能优化：
 * - 使用 unstable_noStore() 禁用缓存，确保每次获取最新数据
 * - 服务端获取初始数据，避免客户端认证问题
 * - 支持 Suspense loading 提升用户体验
 */

import { unstable_noStore } from "next/cache";
import { HomePageClient } from "@/components/home/home-page-client";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { createClient } from "@/lib/supabase/server";
import type { Bookmark, Platform } from "@/types/supabase";

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

async function getInitialBookmarks(
  platform: string,
  sort: string,
  folder: string,
): Promise<{ bookmarks: BookmarkWithFolder[]; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { bookmarks: [], error: "请先登录" };
    }

    let query = supabase
      .from("bookmarks")
      .select("*, folders(name)")
      .eq("user_id", user.id)
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

    query = query.limit(50);

    const { data, error } = await query;

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
}

interface HomePageProps {
  searchParams: Promise<{
    platform?: string;
    sort?: string;
    folder?: string;
    smartList?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  // 禁用缓存，确保每次都获取最新数据
  unstable_noStore();

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

  const { bookmarks, error } = await getInitialBookmarks(
    platform,
    sort,
    folder,
  );

  return (
    <ErrorBoundary>
      <HomePageClient initialBookmarks={bookmarks} error={error} />
    </ErrorBoundary>
  );
}
