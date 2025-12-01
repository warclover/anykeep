// 标记为动态路由
export const dynamic = "force-dynamic";

/**
 * 收藏详情页面
 * 展示收藏的完整信息，包括封面、标题、摘要、标签、备注等
 */

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookmarkDetailClient } from "@/components/bookmark/bookmark-detail-client";

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

  // 获取收藏详情
  const { data: bookmark, error } = await supabase
    .from("bookmarks")
    .select("*, folders(id, name)")
    .eq("id", bookmarkId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (error || !bookmark) {
    notFound();
  }

  return <BookmarkDetailClient bookmark={bookmark} />;
}
