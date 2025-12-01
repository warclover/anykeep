// 标记为动态路由
export const dynamic = "force-dynamic";

/**
 * 首页 - 收藏列表
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HomePageClient } from "@/components/home/home-page-client";
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
    .is("deleted_at", null)
    .limit(QUERY_LIMITS.HOME_BOOKMARKS_PER_PAGE);

  // 平台筛选（验证平台值有效性）
  if (
    params.platform &&
    VALID_PLATFORMS.includes(params.platform as Platform)
  ) {
    query = query.eq("platform", params.platform as Platform);
  }

  // 文件夹筛选
  if (params.folder) {
    query = query.eq("folder_id", parseInt(params.folder));
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
      <HomePageClient bookmarks={[]} error="加载收藏列表时出错，请稍后重试" />
    );
  }

  return <HomePageClient bookmarks={bookmarks || []} />;
}
