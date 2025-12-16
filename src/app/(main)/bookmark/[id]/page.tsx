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
import type { CustomUsageTag, ProfileSettings } from "@/types/supabase";

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
    supabase
      .from("bookmarks")
      .select("*, folders(id, name, parent_id)")
      .eq("id", bookmarkId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single(),
    supabase.from("profiles").select("settings").eq("id", user.id).single(),
  ]);

  const { data: bookmark, error } = bookmarkResult;
  if (error || !bookmark) {
    notFound();
  }

  // 提取自定义用途标签
  const settings = (profileResult.data?.settings as ProfileSettings) || {};
  const customUsageTags: CustomUsageTag[] = settings.customUsageTags || [];

  // 如果有文件夹，递归获取父文件夹链
  let folderPath: Array<{ id: number; name: string }> = [];
  if (bookmark.folders) {
    const buildFolderPath = async (
      folderId: number,
    ): Promise<Array<{ id: number; name: string }>> => {
      const { data: folder } = await supabase
        .from("folders")
        .select("id, name, parent_id")
        .eq("id", folderId)
        .single();

      if (!folder) return [];

      const path = [{ id: folder.id, name: folder.name }];

      // 如果有父文件夹，递归获取
      if (folder.parent_id) {
        const parentPath = await buildFolderPath(folder.parent_id);
        return [...parentPath, ...path];
      }

      return path;
    };

    folderPath = await buildFolderPath(bookmark.folders.id);
  }

  return (
    <BookmarkDetailClient
      bookmark={bookmark}
      folderPath={folderPath}
      initialCustomUsageTags={customUsageTags}
    />
  );
}
