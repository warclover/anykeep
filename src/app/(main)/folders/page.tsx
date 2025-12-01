// 标记为动态路由
export const dynamic = "force-dynamic";

/**
 * 收藏夹管理页面
 * 展示所有文件夹和最近添加的收藏
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FoldersPageClient } from "@/components/folders/folders-page-client";
import { QUERY_LIMITS } from "@/lib/constants/app";
import type { Folder } from "@/types/supabase";

// 扩展 Folder 类型，包含统计字段
type FolderWithStats = Folder & {
  bookmark_count: number;
  today_count: number;
};

export default async function FoldersPage() {
  const supabase = await createClient();

  // 获取当前用户
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // 获取用户的所有文件夹
  const { data: folders, error: foldersError } = await supabase
    .from("folders")
    .select("*")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // 计算每个文件夹的书签数量和当日新增
  let foldersWithStats: FolderWithStats[] = [];

  // 获取今天的开始时间（UTC）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  if (folders && folders.length > 0) {
    // 获取所有文件夹的书签（用于统计）
    const folderIds = folders.map((f) => f.id);
    const { data: allBookmarks } = await supabase
      .from("bookmarks")
      .select("folder_id, created_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .in("folder_id", folderIds);

    // 统计每个文件夹的总数和今日新增
    const countMap = new Map<number, number>();
    const todayCountMap = new Map<number, number>();

    if (allBookmarks) {
      for (const bookmark of allBookmarks) {
        if (bookmark.folder_id) {
          // 统计总数
          countMap.set(
            bookmark.folder_id,
            (countMap.get(bookmark.folder_id) || 0) + 1,
          );
          // 统计今日新增
          if (bookmark.created_at && bookmark.created_at >= todayISO) {
            todayCountMap.set(
              bookmark.folder_id,
              (todayCountMap.get(bookmark.folder_id) || 0) + 1,
            );
          }
        }
      }
    }

    // 合并数据，系统文件夹置顶
    const systemFolders = folders.filter((f) => f.is_system);
    const normalFolders = folders.filter((f) => !f.is_system);

    foldersWithStats = [...systemFolders, ...normalFolders].map((folder) => ({
      ...folder,
      bookmark_count: countMap.get(folder.id) || 0,
      today_count: todayCountMap.get(folder.id) || 0,
    }));
  }

  // 获取最近添加的收藏
  const { data: recentBookmarks, error: bookmarksError } = await supabase
    .from("bookmarks")
    .select("*, folders:folder_id (name)")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(QUERY_LIMITS.RECENT_BOOKMARKS_COUNT);

  // 处理错误
  let error: string | undefined;
  if (foldersError) {
    error = "加载文件夹时出错，请稍后重试";
  } else if (bookmarksError) {
    error = "加载最近收藏时出错，请稍后重试";
  }

  return (
    <FoldersPageClient
      folders={foldersWithStats}
      recentBookmarks={recentBookmarks || []}
      error={error}
    />
  );
}
