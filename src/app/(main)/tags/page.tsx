// 标记为动态路由
export const dynamic = "force-dynamic";

/**
 * 标签浏览页面 - 服务端组件
 * 展示所有标签及其使用统计
 */

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/server/auth";
import { TagsPageClient } from "@/components/tags/tags-page-client";

export interface TagWithCount {
  tag: string;
  count: number;
  type: "ai" | "user" | "both";
}

export default async function TagsPage() {
  // 从 Middleware 预验证的 header 获取用户 ID（无网络请求）
  const userId = await getAuthenticatedUserId();
  const supabase = await createClient();

  // 获取所有收藏的标签
  // 类型断言: 手动维护类型文件时需要此断言
  const { data: bookmarks, error } = (await supabase
    .from("bookmarks")
    .select("ai_tags, user_tags")
    .eq("user_id", userId)
    .is("deleted_at", null)) as unknown as {
    data: { ai_tags: string[] | null; user_tags: string[] | null }[] | null;
    error: unknown;
  };

  if (error) {
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
