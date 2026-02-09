/**
 * 我的搜索页面 - 服务端组件
 * 优化：使用 Suspense 流式渲染热门标签，提升首屏加载速度
 */

import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserIdFromCookies } from "@/lib/server/auth";
import { SearchPageClient } from "@/components/search/search-page-client";
import { HotTagsSection } from "@/components/search/hot-tags-section";
import { HotTagsSkeleton } from "@/components/search/hot-tags-skeleton";
import { searchQuerySchema } from "@/lib/validation";
import { QUERY_LIMITS } from "@/lib/constants/app";
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
  // 从 Middleware 预验证的 cookies 获取用户 ID（兼容页面路由）
  const userId = await getAuthenticatedUserIdFromCookies();
  if (!userId) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  const supabase = await createClient();

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
            userId,
            validatedQuery,
            {
              threshold: 0.5,
              limit: QUERY_LIMITS.SEARCH_RESULTS_PER_PAGE,
            },
          );

          if (error) throw error;
          // 类型断言: 手动维护类型文件时需要 unknown 中转
          searchResults = (data as unknown as SearchResult[]) || [];
        } else {
          // PostgreSQL 全文搜索（使用 ts_vector + GIN 索引）
          const { data, error } = await searchBookmarksFulltext(
            supabase,
            userId,
            validatedQuery,
            QUERY_LIMITS.SEARCH_RESULTS_PER_PAGE,
          );

          if (error) throw error;
          // 全文搜索返回部分字段，使用 unknown 中转类型转换
          searchResults = (data as unknown as SearchResult[]) || [];
        }
      } catch {
        searchError = "搜索时出错，请稍后重试";
      }
    }
  }

  // 热门标签使用 Suspense 流式渲染，不阻塞主页面
  const hotTagsSlot = (
    <Suspense fallback={<HotTagsSkeleton />}>
      <HotTagsSection userId={userId} />
    </Suspense>
  );

  // V4.2.17: 确保 searchResults 是纯 JSON 可序列化的，避免 RSC hydration 问题
  // 通过 JSON.parse(JSON.stringify()) 强制序列化，移除任何非 JSON 兼容的值
  const serializedResults = JSON.parse(JSON.stringify(searchResults));

  return (
    <SearchPageClient
      initialQuery={params.q || ""}
      initialAIMode={params.ai === "true"}
      searchResults={serializedResults}
      hotTagsSlot={hotTagsSlot}
      error={searchError}
    />
  );
}
