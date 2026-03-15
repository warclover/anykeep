// V5.7: 移除 force-dynamic，页面已通过 cookies() 自动标记为动态渲染
// Next.js 会根据 getAuthenticatedUserIdFromCookies 中的 cookies() 调用自动选择动态模式
// 移除后可保留路由段缓存（Router Cache），减少重复导航的开销

/**
 * 收藏详情页面
 * 展示收藏的完整信息，包括封面、标题、摘要、标签、备注等
 *
 * V4.2.22: SSR 阶段预取用途标签，消除客户端加载延迟
 * V5.6 性能优化 (2026-02-08):
 * - P1: 复用 middleware 预验证的用户 ID，消除重复 getUser()（~500-1000ms → ~1ms）
 * - P2: [已移除] get_folder_path_by_bookmark RPC 冗余 — 客户端仅使用最后一级文件夹名，
 *        直接从 bookmarks JOIN folders 获取即可，消除递归 CTE 开销
 * - P4: 快照状态服务端预取，消除客户端额外请求（~200-500ms）
 */

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserIdFromCookies } from "@/lib/server/auth";
import { BookmarkDetailClient } from "@/components/bookmark/bookmark-detail-client";
import {
  inferSourceType,
  type SourceInfo,
} from "@/components/bookmark/source-badge";
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

  // V5.6: 3 个查询并行执行（原 4 个，移除冗余 RPC）
  // P4: 快照状态预取，消除客户端 useEffect 额外请求
  // P0: 移除 get_folder_path_by_bookmark RPC — 客户端仅使用 folders.name，
  //     bookmarks JOIN folders 已包含该数据，消除递归 CTE + 1 次 DB 往返
  const [bookmarkResult, profileResult, snapshotResult] = await Promise.all([
    // 1. 书签详情 + 关联文件夹信息（folders.name 已足够，无需完整路径）
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
    // 3. P4: 快照状态预取（消除客户端 useEffect 额外请求）
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

  // P0: 从 bookmarks JOIN folders 直接提取文件夹信息（替代 RPC 递归查询）
  const folderPath: Array<{ id: number; name: string }> = bookmark.folders
    ? [{ id: bookmark.folders.id, name: bookmark.folders.name }]
    : [];

  // P4: 从并行查询结果中提取快照状态
  const initialHasSnapshot = !!snapshotResult.data?.id;
  const initialSnapshot = snapshotResult.data
    ? { id: snapshotResult.data.id, status: snapshotResult.data.status }
    : null;

  // P5: 服务端预计算 sourceInfo，消除客户端 useMemo + inferSourceType 依赖
  // source_id 是扩展字段，不在 Supabase 生成类型中，使用安全访问
  const bookmarkAny = bookmark as Record<string, unknown>;
  const sourceId = bookmarkAny.source_id as string | null | undefined;
  let sourceInfo: SourceInfo | null = null;
  if (sourceId) {
    sourceInfo = {
      sourceId,
      sourceName: (bookmark.source_name as string | null) || undefined,
      domain: bookmark.url ? new URL(bookmark.url).hostname : undefined,
      sourceType: inferSourceType(sourceId),
    };
  } else if (bookmark.url) {
    try {
      const domain = new URL(bookmark.url).hostname;
      sourceInfo = {
        sourceId: domain,
        sourceName: bookmark.source_name || domain,
        domain,
        sourceType: inferSourceType(domain),
      };
    } catch {
      // URL 解析失败，sourceInfo 保持 null
    }
  }

  return (
    <BookmarkDetailClient
      bookmark={bookmark}
      folderPath={folderPath}
      initialCustomUsageTags={customUsageTags}
      initialHasSnapshot={initialHasSnapshot}
      initialSnapshot={initialSnapshot}
      initialSourceInfo={sourceInfo}
    />
  );
}
