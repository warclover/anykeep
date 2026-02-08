// 标记为动态路由
export const dynamic = "force-dynamic";

/**
 * 收藏详情页面
 * 展示收藏的完整信息，包括封面、标题、摘要、标签、备注等
 *
 * V4.2.22: SSR 阶段预取用途标签，消除客户端加载延迟
 * V5.6 性能优化 (2026-02-08):
 * - P1: 复用 middleware 预验证的用户 ID，消除重复 getUser()（~500-1000ms → ~1ms）
 * - P2: get_folder_path_by_bookmark 并行化，消除串行等待（~100-200ms）
 * - P4: 快照状态服务端预取，消除客户端额外请求（~200-500ms）
 */

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserIdFromCookies } from "@/lib/server/auth";
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

  // P1: 复用 middleware 预验证的用户 ID（~1ms vs ~500-1000ms）
  // 从 cookie 读取已验证的用户信息，失败时自动回退到 getSession()
  const userId = await getAuthenticatedUserIdFromCookies();
  if (!userId) {
    redirect("/login");
  }

  const supabase = await createClient();

  // V5.6: 4 个查询全部并行执行，消除串行等待
  // P2: get_folder_path_by_bookmark 直接通过 bookmark_id 查询，无需先获取 folder_id
  // P4: 快照状态预取，消除客户端 useEffect 额外请求
  const [bookmarkResult, profileResult, folderPathResult, snapshotResult] =
    await Promise.all([
      // 1. 书签详情 + 关联文件夹信息
      supabase
        .from("bookmarks")
        .select("*, folders!bookmarks_folder_id_fkey(id, name, parent_id)")
        .eq("id", bookmarkId)
        .eq("user_id", userId)
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
      // 2. 用户自定义标签配置
      supabase
        .from("profiles")
        .select("settings")
        .eq("id", userId)
        .single() as unknown as Promise<{
        data: { settings: unknown } | null;
        error: unknown;
      }>,
      // 3. P2: 文件夹路径（直接通过 bookmark_id 查询，与其他查询并行）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.rpc as any)("get_folder_path_by_bookmark", {
        p_bookmark_id: bookmarkId,
      }) as Promise<{
        data: Array<{ id: number; name: string; depth: number }> | null;
        error: unknown;
      }>,
      // 4. P4: 快照状态预取（消除客户端 useEffect 额外请求）
      supabase
        .from("bookmark_snapshots")
        .select("id, status")
        .eq("bookmark_id", bookmarkId)
        .eq("user_id", userId)
        .in("status", ["pending", "processing", "completed"])
        .limit(1)
        .maybeSingle() as unknown as Promise<{
        data: { id: number; status: string } | null;
        error: unknown;
      }>,
    ]);

  const { data: bookmark, error } = bookmarkResult;
  if (error || !bookmark) {
    notFound();
  }

  // 提取自定义用途标签
  const settings = (profileResult.data?.settings ?? {}) as ProfileSettings & {
    customUsageTags?: CustomUsageTag[];
  };
  const customUsageTags: CustomUsageTag[] = settings.customUsageTags || [];

  // P2: 从并行查询结果中提取文件夹路径
  let folderPath: Array<{ id: number; name: string }> = [];
  if (folderPathResult.data && Array.isArray(folderPathResult.data)) {
    folderPath = folderPathResult.data.map(
      (item: { id: number; name: string }) => ({
        id: item.id,
        name: item.name,
      }),
    );
  }

  // P4: 从并行查询结果中提取快照状态
  const initialHasSnapshot = !!snapshotResult.data?.id;

  return (
    <BookmarkDetailClient
      bookmark={bookmark}
      folderPath={folderPath}
      initialCustomUsageTags={customUsageTags}
      initialHasSnapshot={initialHasSnapshot}
    />
  );
}
