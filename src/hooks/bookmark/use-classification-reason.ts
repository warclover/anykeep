/**
 * 分类理由查询 Hook
 *
 * 使用 TanStack Query 获取书签分类决策的详细理由
 *
 * @version 1.0.0
 * @since 2026-03-17
 */

import { useQuery } from "@tanstack/react-query";
import { authFetcher } from "@/lib/api/fetch-with-auth";
import { API_CLASSIFICATION } from "@/lib/constants/api-paths";
import { detailInsightsKeys } from "@/hooks/queries/keys";
import type { ClassificationReason } from "@/components/bookmark/detail-insights/types";

interface ClassificationReasonResponse {
  success: boolean;
  data: ClassificationReason;
  error?: { message: string };
}

/**
 * 查询书签的分类决策理由
 *
 * @param bookmarkId - 书签 ID
 * @param enabled - 是否启用查询（当 classification_result 存在时才启用）
 */
export function useClassificationReason(bookmarkId: number, enabled: boolean) {
  return useQuery({
    queryKey: detailInsightsKeys.classificationReason(bookmarkId),
    queryFn: async () => {
      const response = await authFetcher<ClassificationReasonResponse>(
        API_CLASSIFICATION.reason(bookmarkId),
      );
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "获取分类信息失败");
      }
      return response.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 分钟
    retry: 1,
  });
}
