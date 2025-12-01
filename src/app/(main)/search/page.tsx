// 标记为动态路由
export const dynamic = "force-dynamic";

/**
 * 搜索页面 - 服务端组件
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SearchPageClient } from "@/components/search/search-page-client";
import { searchQuerySchema } from "@/lib/validation";
import { QUERY_LIMITS, ANALYTICS } from "@/lib/constants/app";
import { searchBookmarksFulltext } from "@/lib/utils/fulltext-search";
import { searchBookmarksHybrid } from "@/lib/utils/semantic-search";
import type { Bookmark } from "@/types/supabase";

// 搜索结果类型 - 兼容全文搜索和语义搜索
type SearchResult = Bookmark & {
  folders?: { name: string } | null;
  similarity?: number;
};

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    ai?: string;
  }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  // 获取当前用户
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // 如果有搜索关键词，验证并执行搜索
  let searchResults: SearchResult[] = [];
  let searchError: string | undefined;

  if (params.q) {
    // 验证搜索参数
    const validationResult = searchQuerySchema.safeParse(params);

    if (!validationResult.success) {
      searchError = validationResult.error.issues[0].message;
    } else {
      const validatedQuery = validationResult.data.q;
      const isAISearch = params.ai === "true";

      try {
        if (isAISearch) {
          // AI 语义搜索（混合搜索：关键词 + 向量相似度）
          const { data, error } = await searchBookmarksHybrid(
            supabase,
            user.id,
            validatedQuery,
            {
              threshold: 0.5,
              limit: QUERY_LIMITS.SEARCH_RESULTS_PER_PAGE,
            },
          );

          if (error) throw error;
          searchResults = (data as SearchResult[]) || [];
        } else {
          // PostgreSQL 全文搜索（使用 ts_vector + GIN 索引）
          const { data, error } = await searchBookmarksFulltext(
            supabase,
            user.id,
            validatedQuery,
            QUERY_LIMITS.SEARCH_RESULTS_PER_PAGE,
          );

          if (error) throw error;
          searchResults = (data as SearchResult[]) || [];
        }
      } catch {
        searchError = "搜索时出错，请稍后重试";
      }
    }
  }

  // 获取热门标签（从所有收藏的 AI 标签中统计）
  const { data: allBookmarks } = await supabase
    .from("bookmarks")
    .select("ai_tags")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .not("ai_tags", "is", null);

  // 统计标签频率
  const tagCounts: Record<string, number> = {};
  allBookmarks?.forEach((bookmark) => {
    bookmark.ai_tags?.forEach((tag: string) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  // 获取热门标签
  const hotTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, ANALYTICS.TOP_TAGS_COUNT)
    .map(([tag]) => tag);

  return (
    <SearchPageClient
      initialQuery={params.q || ""}
      initialAIMode={params.ai === "true"}
      searchResults={searchResults}
      hotTags={hotTags}
      error={searchError}
    />
  );
}
