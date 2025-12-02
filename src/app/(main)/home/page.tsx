// 标记为动态路由
export const dynamic = "force-dynamic";

/**
 * 首页 - 收藏列表
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HomePageClient } from "@/components/home/home-page-client";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { Platform } from "@/types/supabase";
import { QUERY_LIMITS } from "@/lib/constants/app";

// 有效的平台值（包含内容平台和浏览器平台）
const VALID_PLATFORMS: Platform[] = [
  "WECHAT_OFFICIAL_ACCOUNT",
  "BILIBILI",
  "XIAOHONGSHU",
  "BROWSER_CHROME",
  "BROWSER_EDGE",
  "BROWSER_FIREFOX",
  "BROWSER_SAFARI",
  "UNKNOWN",
];

interface HomePageProps {
  searchParams: Promise<{
    platform?: string;
    folder?: string;
    sort?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  // 获取当前用户
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // 解析排序参数
  const sort = params.sort || "created_desc";
  const [sortField, sortOrder] = sort.split("_");
  const ascending = sortOrder === "asc";

  // 构建查询
  let query = supabase
    .from("bookmarks")
    .select("*, folders(name)")
    .eq("user_id", user.id)
    .is("deleted_at", null);

  // 虚拟文件夹筛选（优先级最高）
  if (params.folder === "trash") {
    // 垃圾箱：只显示垃圾箱中的收藏
    query = query.eq("is_in_trash", true);
  } else if (params.folder === "invalid") {
    // 已失效：只显示失效且不在垃圾箱的收藏
    query = query.eq("is_invalid", true).eq("is_in_trash", false);
  } else if (params.folder === "high-value") {
    // 高价值：只显示5星评级且不在垃圾箱的收藏
    query = query.eq("rating", 5).eq("is_in_trash", false);
  } else {
    // 正常收藏：排除垃圾箱
    query = query.eq("is_in_trash", false);

    // 物理文件夹筛选（仅对非虚拟文件夹生效）
    if (params.folder && !isNaN(parseInt(params.folder))) {
      query = query.eq("folder_id", parseInt(params.folder));
    }
  }

  query = query.limit(QUERY_LIMITS.HOME_BOOKMARKS_PER_PAGE);

  // 平台筛选（验证平台值有效性）
  if (params.platform === "browser") {
    // 「浏览器书签」筛选：查询所有浏览器平台
    query = query.in("platform", [
      "BROWSER_CHROME",
      "BROWSER_EDGE",
      "BROWSER_FIREFOX",
      "BROWSER_SAFARI",
    ]);
  } else if (
    params.platform &&
    VALID_PLATFORMS.includes(params.platform as Platform)
  ) {
    query = query.eq("platform", params.platform as Platform);
  } else if (!params.folder) {
    // 默认「全部」：排除浏览器平台（仅当不是虚拟文件夹时）
    query = query.not(
      "platform",
      "in",
      '("BROWSER_CHROME","BROWSER_EDGE","BROWSER_FIREFOX","BROWSER_SAFARI")',
    );
  }

  // 应用排序
  if (sortField === "created") {
    query = query.order("created_at", { ascending });
  } else if (sortField === "title") {
    query = query.order("title", { ascending });
  }

  const { data: bookmarks, error } = await query;

  if (error) {
    return (
      <ErrorBoundary>
        <HomePageClient bookmarks={[]} error="加载收藏列表时出错，请稍后重试" />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <HomePageClient bookmarks={bookmarks || []} />
    </ErrorBoundary>
  );
}
