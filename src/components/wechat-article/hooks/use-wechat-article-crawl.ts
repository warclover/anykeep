/**
 * 微信文章抓取操作 Hook
 *
 * @module wechat-article/hooks
 */

"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type {
  WechatArticleCrawlProgress,
  RefetchOptions,
  CrawlOptions,
} from "@/lib/wechat-article/wechat-article.types";
import { API_WECHAT_ARTICLE } from "@/lib/constants/api-paths";

/**
 * Hook 选项
 */
export interface UseWechatArticleCrawlOptions {
  /** 成功回调 */
  onSuccess?: () => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

/**
 * useWechatArticleCrawl Hook
 *
 * 提供微信文章抓取和重新获取功能
 *
 * @param snapshotId - 快照 ID
 * @param options - 选项
 * @returns 抓取操作和状态
 *
 * @example
 * ```tsx
 * const { crawl, refetch, isCrawling, progress } = useWechatArticleCrawl(123, {
 *   onSuccess: () => mutate(),
 * });
 *
 * return (
 *   <Button onClick={() => crawl()} disabled={isCrawling}>
 *     {isCrawling ? '抓取中...' : '抓取内容'}
 *   </Button>
 * );
 * ```
 */
export function useWechatArticleCrawl(
  snapshotId: number | null,
  options: UseWechatArticleCrawlOptions = {},
) {
  const [isCrawling, setIsCrawling] = useState(false);
  const [progress, setProgress] = useState<WechatArticleCrawlProgress | null>(
    null,
  );

  /**
   * 抓取完整内容
   *
   * 样式选项升级：支持 styleLevel 参数
   *
   * @param opts - 抓取选项（包含 styleLevel）
   */
  const crawl = useCallback(
    async (opts?: CrawlOptions) => {
      if (!snapshotId || isCrawling) return;

      setIsCrawling(true);
      setProgress({ stage: "fetching", progress: 0 });

      try {
        const res = await fetch(API_WECHAT_ARTICLE.detail(String(snapshotId)), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(opts || {}),
        });

        if (!res.ok) {
          const error = await res
            .json()
            .catch(() => ({ error: { message: "抓取失败" } }));
          throw new Error(error.error?.message || `HTTP ${res.status}`);
        }

        const result = await res.json();

        setProgress({ stage: "completed", progress: 100 });
        toast.success("文章内容抓取完成", {
          description: `${result.data.wordCount} 字，${result.data.imagesSuccess}/${result.data.imagesCount} 张图片`,
        });
        options.onSuccess?.();
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        setProgress({ stage: "failed", progress: 0, error: err.message });
        toast.error("抓取失败", { description: err.message });
        options.onError?.(err);
      } finally {
        setIsCrawling(false);
      }
    },
    [snapshotId, isCrawling, options],
  );

  /**
   * 重新获取内容
   */
  const refetch = useCallback(
    async (opts?: RefetchOptions) => {
      if (!snapshotId || isCrawling) return;

      setIsCrawling(true);

      try {
        const res = await fetch(
          API_WECHAT_ARTICLE.refetch(String(snapshotId)),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(opts || {}),
          },
        );

        if (!res.ok) {
          const error = await res
            .json()
            .catch(() => ({ error: { message: "重新获取失败" } }));
          throw new Error(error.error?.message || `HTTP ${res.status}`);
        }

        const result = await res.json();

        if (result.data.contentChanged) {
          toast.success("文章内容已更新", {
            description: `版本 ${result.data.newVersion}`,
          });
        } else {
          toast.info("文章内容无变化");
        }

        options.onSuccess?.();
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        toast.error("重新获取失败", { description: err.message });
        options.onError?.(err);
      } finally {
        setIsCrawling(false);
      }
    },
    [snapshotId, isCrawling, options],
  );

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setProgress(null);
  }, []);

  return {
    crawl,
    refetch,
    isCrawling,
    progress,
    reset,
  };
}

export default useWechatArticleCrawl;
