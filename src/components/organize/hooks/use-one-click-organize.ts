"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { fetchWithRetry } from "@/lib/utils/fetch-with-retry";
import { API_CLASSIFICATION } from "@/lib/constants/api-paths";
import { dataCache } from "@/lib/cache";

interface UseOneClickOrganizeOptions {
  bookmarkCount: number;
  refreshBookmarks: () => Promise<void>;
  refreshCounts: () => void;
}

export function useOneClickOrganize({
  bookmarkCount,
  refreshBookmarks,
  refreshCounts,
}: UseOneClickOrganizeOptions) {
  const [isOrganizing, setIsOrganizing] = useState(false);

  const handleOneClickOrganize = useCallback(async () => {
    if (bookmarkCount === 0) {
      toast.info("没有需要整理的书签");
      return;
    }

    setIsOrganizing(true);
    const loadingToast = toast.loading("正在分析并整理书签...");

    try {
      const analysisResponse = await fetchWithRetry(API_CLASSIFICATION.inbox);
      if (!analysisResponse.ok) {
        throw new Error("获取整理建议失败");
      }

      const analysisData = await analysisResponse.json();
      const suggestions = analysisData.data?.suggestions || [];

      if (suggestions.length === 0) {
        toast.dismiss(loadingToast);
        toast.info("暂无可自动整理的建议，请手动整理或等待 AI 聚类分析");
        return;
      }

      const results = await Promise.allSettled(
        suggestions.map(async (suggestion: { id: number }) => {
          const response = await fetchWithRetry(
            API_CLASSIFICATION.inbox,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ suggestionId: suggestion.id }),
            },
            { maxRetries: 3, requestId: "one-click-organize" },
          );
          if (!response.ok) {
            throw new Error(`Apply failed: ${response.status}`);
          }
          return response;
        }),
      );

      const successCount = results.filter(
        (r) => r.status === "fulfilled",
      ).length;
      const failCount = results.filter((r) => r.status === "rejected").length;

      toast.dismiss(loadingToast);

      if (successCount > 0) {
        dataCache.invalidate(/^bookmarks:/);
        await refreshBookmarks();
        refreshCounts();

        if (failCount === 0) {
          toast.success(`成功整理 ${successCount} 组书签`);
        } else {
          toast.warning(`整理完成：${successCount} 成功，${failCount} 失败`);
        }
      } else {
        toast.error("整理失败，请稍后重试");
      }
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error(err instanceof Error ? err.message : "整理失败");
    } finally {
      setIsOrganizing(false);
    }
  }, [bookmarkCount, refreshBookmarks, refreshCounts]);

  return { isOrganizing, handleOneClickOrganize };
}
