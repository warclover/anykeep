// 标记为动态路由
export const dynamic = "force-dynamic";

/**
 * 收藏详情页面
 * 展示收藏的完整信息，包括封面、标题、摘要、标签、备注等
 *
 * V4.2.22: SSR 阶段预取用途标签，消除客户端加载延迟
 */

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookmarkDetailClient } from "@/components/bookmark/bookmark-detail-client";
import type {
  CustomUsageTag,
  ProfileSettings,
  Bookmark,
} from "@/types/supabase";

interface BookmarkDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function BookmarkDetailPage({
  params,
}: BookmarkDetailPageProps) {
  const { id } = await params;
  const bookmarkId = parseInt(id);

  // 验证 ID 是否为有效数字
  if (isNaN(bookmarkId)) {
    notFound();
  }

  const supabase = await createClient();

  // 获取当前用户
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // V4.2.22: 并行获取书签详情和用途标签，消除客户端延迟
  const [bookmarkResult, profileResult] = await Promise.all([
    // 类型断言: 手动维护类型文件时需要此断言
    supabase
      .from("bookmarks")
      .select("*, folders!bookmarks_folder_id_fkey(id, name, parent_id)")
      .eq("id", bookmarkId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single() as unknown as Promise<{
      data:
        | (Bookmark & {
            folders?: {
              id: number;
              name: string;
              parent_id: number | null;
            } | null;
          })
        | null;
      error: unknown;
    }>,
    // 类型断言: 手动维护类型文件时需要此断言
    supabase
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .single() as unknown as Promise<{
      data: { settings: unknown } | null;
      error: unknown;
    }>,
  ]);

  const { data: bookmark, error } = bookmarkResult;
  if (error || !bookmark) {
    notFound();
  }

  // 提取自定义用途标签
  const settings = (profileResult.data?.settings as ProfileSettings) || {};
  const customUsageTags: CustomUsageTag[] = settings.customUsageTags || [];

  // V4.2.23: 使用 CTE 递归查询替代客户端递归，优化性能
  // 单次数据库往返替代 N 次（N = 文件夹嵌套层级）
  let folderPath: Array<{ id: number; name: string }> = [];
  if (bookmark.folders) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pathData } = await (supabase.rpc as any)("get_folder_path", {
      p_folder_id: bookmark.folders.id,
    });

    if (pathData && Array.isArray(pathData)) {
      folderPath = pathData.map((item: { id: number; name: string }) => ({
        id: item.id,
        name: item.name,
      }));
    }
  }

  return (
    <BookmarkDetailClient
      bookmark={bookmark}
      folderPath={folderPath}
      initialCustomUsageTags={customUsageTags}
    />
  );
}
