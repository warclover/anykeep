/**
 * 待分类页面 - 待整理书签
 *
 * 专用于展示和管理待分类的书签内容
 * 包含智能整理建议面板
 */

import { InboxPageClient } from "@/components/inbox/inbox-page-client";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { createClient } from "@/lib/supabase/server";
import type { Bookmark } from "@/types/supabase";

// 确保每次请求都获取最新数据
export const dynamic = "force-dynamic";

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

interface FolderOption {
  id: number;
  name: string;
}

async function getInboxData(): Promise<{
  bookmarks: BookmarkWithFolder[];
  folders: FolderOption[];
  inboxFolderId: number | null;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        bookmarks: [],
        folders: [],
        inboxFolderId: null,
        error: "请先登录",
      };
    }

    // 获取待整理文件夹
    // 类型断言: 手动维护类型文件时需要此断言
    const { data: inboxFolder } = (await supabase
      .from("folders")
      .select("id")
      .eq("user_id", user.id)
      .eq("system_type", "INBOX")
      .single()) as unknown as { data: { id: number } | null };

    const inboxFolderId = inboxFolder?.id || null;

    // 获取待整理书签（folder_id 为 null 或在待整理文件夹中）
    let bookmarksQuery = supabase
      .from("bookmarks")
      .select("*, folders!bookmarks_folder_id_fkey(name)")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .eq("is_in_trash", false);

    if (inboxFolderId) {
      // 如果有待整理文件夹，获取该文件夹中的书签
      bookmarksQuery = bookmarksQuery.eq("folder_id", inboxFolderId);
    } else {
      // 否则获取 folder_id 为 null 的书签
      bookmarksQuery = bookmarksQuery.is("folder_id", null);
    }

    const { data: bookmarks, error: bookmarksError } = await bookmarksQuery
      .order("created_at", { ascending: false })
      .limit(100);

    if (bookmarksError) {
      return {
        bookmarks: [],
        folders: [],
        inboxFolderId,
        error: bookmarksError.message,
      };
    }

    // 获取用户的所有文件夹（用于整理建议）
    const { data: folders, error: foldersError } = await supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", user.id)
      .neq("system_type", "INBOX")
      .is("deleted_at", null)
      .order("name");

    if (foldersError) {
      return {
        bookmarks: (bookmarks as BookmarkWithFolder[]) || [],
        folders: [],
        inboxFolderId,
        error: foldersError.message,
      };
    }

    return {
      bookmarks: (bookmarks as BookmarkWithFolder[]) || [],
      folders: (folders as FolderOption[]) || [],
      inboxFolderId,
    };
  } catch (error) {
    return {
      bookmarks: [],
      folders: [],
      inboxFolderId: null,
      error: error instanceof Error ? error.message : "加载失败",
    };
  }
}

export default async function InboxPage() {
  const { bookmarks, folders, inboxFolderId, error } = await getInboxData();

  return (
    <ErrorBoundary>
      <InboxPageClient
        initialBookmarks={bookmarks}
        availableFolders={folders}
        inboxFolderId={inboxFolderId}
        error={error}
      />
    </ErrorBoundary>
  );
}
