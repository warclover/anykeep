/**
 * 标签浏览页面 - 服务端组件
 * 展示所有标签及其使用统计
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TagsPageClient } from "@/components/tags/tags-page-client";

export interface TagWithCount {
  tag: string;
  count: number;
  type: "ai" | "user" | "both";
}

export default async function TagsPage() {
  const supabase = await createClient();

  // 获取当前用户
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // 获取所有收藏的标签
  const { data: bookmarks, error } = await supabase
    .from("bookmarks")
    .select("ai_tags, user_tags")
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (error) {
    console.error("Failed to fetch bookmarks for tags:", error);
    return <TagsPageClient tags={[]} error="加载标签失败，请稍后重试" />;
  }

  // 统计标签频率
  const aiTagCounts: Record<string, number> = {};
  const userTagCounts: Record<string, number> = {};

  bookmarks?.forEach((bookmark) => {
    // 统计 AI 标签
    bookmark.ai_tags?.forEach((tag: string) => {
      aiTagCounts[tag] = (aiTagCounts[tag] || 0) + 1;
    });

    // 统计用户标签
    bookmark.user_tags?.forEach((tag: string) => {
      userTagCounts[tag] = (userTagCounts[tag] || 0) + 1;
    });
  });

  // 合并标签统计
  const allTags: Map<string, TagWithCount> = new Map();

  // 添加 AI 标签
  Object.entries(aiTagCounts).forEach(([tag, count]) => {
    allTags.set(tag, { tag, count, type: "ai" });
  });

  // 添加用户标签（如果已存在则合并）
  Object.entries(userTagCounts).forEach(([tag, count]) => {
    const existing = allTags.get(tag);
    if (existing) {
      // 标签同时存在于 AI 和用户标签中
      allTags.set(tag, {
        tag,
        count: existing.count + count,
        type: "both",
      });
    } else {
      allTags.set(tag, { tag, count, type: "user" });
    }
  });

  // 转换为数组并按频率降序排序
  const tags = Array.from(allTags.values()).sort((a, b) => b.count - a.count);

  return <TagsPageClient tags={tags} />;
}
