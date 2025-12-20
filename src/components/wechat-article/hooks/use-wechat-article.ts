/**
 * 微信文章数据获取 Hook
 *
 * @module wechat-article/hooks
 */

"use client";

import useSWR from "swr";
import type { WechatArticleContent } from "@/lib/wechat-article/wechat-article.types";

/**
 * API 数据获取器
 */
const fetcher = async (url: string): Promise<WechatArticleContent> => {
  const res = await fetch(url);

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
 * @returns SWR 返回值
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, mutate } = useWechatArticle(123);
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error.message} />;
 *
 * return <ArticleContent html={data.html} />;
 * ```
 */
export function useWechatArticle(snapshotId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<WechatArticleContent>(
    snapshotId ? `/api/wechat-article/${snapshotId}` : null,
    fetcher,
    {
      // 缓存配置
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // 1分钟内不重复请求

      // 错误重试
      shouldRetryOnError: true,
      errorRetryCount: 2,
      errorRetryInterval: 3000,
    },
  );

  return {
    data: data ?? null,
    isLoading,
    error: error ?? null,
    mutate,
  };
}

export default useWechatArticle;
