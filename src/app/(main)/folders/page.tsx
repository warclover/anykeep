// 标记为动态路由
export const dynamic = "force-dynamic";

/**
 * 我的分类页面
 * 展示所有文件夹和最近添加的收藏
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FoldersPageClient } from "@/components/folders/folders-page-client";
import { QUERY_LIMITS } from "@/lib/constants/app";
import type { Folder } from "@/types/supabase";
import type { FolderWithStats } from "@/types/domain";

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
  const { data: folders, error: foldersError } = (await supabase
    .from("folders")
    .select("*")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })) as unknown as {
    data: Folder[] | null;
    error: unknown;
  };

  // 计算每个文件夹的书签数量和当日新增
  let foldersWithStats: FolderWithStats[] = [];

  if (folders && folders.length > 0) {
    const folderIds = folders.map((f) => f.id);

    // V4.2.26: 获取今天的开始时间（UTC）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // V4.2.26: 并行查询 - SQL 聚合统计 + 锁定状态
    // 优化效果：10,000+ 书签场景从 ~2000ms 优化到 ~100ms
    const [statsResult, profilesResult] = await Promise.all([
      // SQL 聚合统计（替代内存遍历）
      // 类型断言: 手动维护类型文件时需要此断言
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.rpc as any)("get_folder_bookmark_stats", {
        p_user_id: user.id,
        p_folder_ids: folderIds,
        p_today_start: today.toISOString(),
      }) as Promise<{
        data:
          | { folder_id: number; bookmark_count: number; today_count: number }[]
          | null;
        error: unknown;
      }>,
      // 锁定状态
      supabase
        .from("folder_profiles")
        .select("folder_id, is_system_locked")
        .eq("user_id", user.id)
        .in("folder_id", folderIds) as unknown as Promise<{
        data: { folder_id: number; is_system_locked: boolean | null }[] | null;
        error: unknown;
      }>,
    ]);

    // 构建统计映射
    const countMap = new Map<number, number>();
    const todayCountMap = new Map<number, number>();

    if (statsResult.data) {
      for (const stat of statsResult.data) {
        countMap.set(stat.folder_id, stat.bookmark_count);
        todayCountMap.set(stat.folder_id, stat.today_count);
      }
    }

    // 构建锁定状态映射
    const lockedMap = new Map<number, boolean>();
    if (profilesResult.data) {
      for (const profile of profilesResult.data) {
        lockedMap.set(profile.folder_id, profile.is_system_locked === true);
      }
    }

    // 合并数据，系统文件夹置顶
    const systemFolders = folders.filter((f) => f.is_system);
    const normalFolders = folders.filter((f) => !f.is_system);

    foldersWithStats = [...systemFolders, ...normalFolders].map(
      (folder): FolderWithStats => ({
        id: folder.id,
        user_id: folder.user_id,
        name: folder.name,
        parent_id: folder.parent_id,
        created_at: folder.created_at,
        updated_at: folder.updated_at,
        deleted_at: folder.deleted_at,
        folder_group: folder.folder_group,
        sort_order: folder.sort_order,
        source: folder.source ?? null,
        system_type: folder.system_type,
        is_system: folder.is_system ?? false,
        is_archived: folder.is_archived ?? false,
        bookmark_count: countMap.get(folder.id) || 0,
        today_count: todayCountMap.get(folder.id) || 0,
        is_locked: lockedMap.get(folder.id) || false,
      }),
    );
  }

  // 获取最近添加的收藏
  const { data: recentBookmarks, error: bookmarksError } = await supabase
    .from("bookmarks")
    .select("*, folders(name)")
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
