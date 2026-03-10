/**
 * 微信文章数据获取 Hook
 *
 * @module wechat-article/hooks
 * @version 2.0.0 - 迁移至 TanStack Query
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { wechatArticleKeys } from "@/hooks/queries/keys";
import type { WechatArticleContent } from "@/lib/wechat-article/wechat-article.types";
import { API_WECHAT_ARTICLE } from "@/lib/constants/api-paths";

/**
 * API 数据获取器
 */
const fetchWechatArticle = async (
  snapshotId: number,
): Promise<WechatArticleContent> => {
  const res = await fetch(API_WECHAT_ARTICLE.detail(String(snapshotId)));

  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: { message: "Unknown error" } }));
    throw new Error(error.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.data;
};

/**
 * useWechatArticle Hook
 *
 * 获取微信文章内容
 *
 * @param snapshotId - 快照 ID
 * @returns TanStack Query 返回值
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useWechatArticle(123);
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error.message} />;
 *
 * return <ArticleContent html={data.html} />;
 * ```
 */
export function useWechatArticle(snapshotId: number | null) {
  const query = useQuery({
    queryKey: snapshotId ? wechatArticleKeys.detail(snapshotId) : ["disabled"],
    queryFn: () => fetchWechatArticle(snapshotId as number),
    enabled: snapshotId !== null,
    // 缓存配置
    staleTime: 60 * 1000, // 1分钟内认为数据新鲜
    gcTime: 5 * 60 * 1000, // 5分钟后垃圾回收
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // 错误重试
    retry: 2,
    retryDelay: 3000,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ?? null,
    mutate: query.refetch,
  };
}

export default useWechatArticle;
