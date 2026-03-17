/**
 * 综述上下文检查 Hook
 *
 * 检查当前书签所在的文件夹/标签维度是否满足综述条件（≥3 篇）
 *
 * @version 1.0.0
 * @since 2026-03-17
 */

import { useQuery } from "@tanstack/react-query";
import { authFetcher } from "@/lib/api/fetch-with-auth";
import { API_SYNTHESIS } from "@/lib/constants/api-paths";
import { detailInsightsKeys } from "@/hooks/queries/keys";
import type { SynthesisEligibility } from "@/components/bookmark/detail-insights/types";

/** 综述预览 API 的 contentStats 片段 */
interface PreviewContentStats {
  totalCount: number;
  withSummary: number;
  avgSummaryLength: number;
}

interface PreviewResponse {
  contentStats: PreviewContentStats;
}

/** 最小书签数阈值 */
const MIN_BOOKMARKS_FOR_SYNTHESIS = 3;

/**
 * 查询书签的综述资格
 *
 * 优先检查文件夹维度，不满足时回退到标签维度
 */
export function useSynthesisContext(
  bookmarkId: number,
  folderId: number | null,
  folderName: string | null,
  userTags: string[] | null,
  aiTags: string[] | null,
) {
  const allTags = [...(userTags ?? []), ...(aiTags ?? [])];
  const primaryTag = allTags[0] ?? null;

  const enabled = !!(folderId || primaryTag);

  return useQuery<SynthesisEligibility[]>({
    queryKey: detailInsightsKeys.synthesisEligibility(bookmarkId),
    queryFn: async (): Promise<SynthesisEligibility[]> => {
      const results: SynthesisEligibility[] = [];

      // 检查文件夹维度
      if (folderId) {
        try {
          const url = `${API_SYNTHESIS.preview}?sourceType=folder&sourceId=${folderId}&pageSize=1`;
          const data = await authFetcher<PreviewResponse>(url);
          if (data.contentStats.totalCount >= MIN_BOOKMARKS_FOR_SYNTHESIS) {
            results.push({
              eligible: true,
              sourceType: "folder",
              sourceId: String(folderId),
              sourceName: folderName ?? "未知文件夹",
              count: data.contentStats.totalCount,
            });
          }
        } catch {
          // 静默失败，继续检查标签
        }
      }

      // 检查标签维度
      if (primaryTag) {
        try {
          const url = `${API_SYNTHESIS.preview}?sourceType=tag&sourceId=${encodeURIComponent(primaryTag)}&pageSize=1`;
          const data = await authFetcher<PreviewResponse>(url);
          if (data.contentStats.totalCount >= MIN_BOOKMARKS_FOR_SYNTHESIS) {
            results.push({
              eligible: true,
              sourceType: "tag",
              sourceId: primaryTag,
              sourceName: primaryTag,
              count: data.contentStats.totalCount,
            });
          }
        } catch {
          // 静默失败
        }
      }

      return results;
    },
    enabled,
    staleTime: 10 * 60 * 1000, // 10 分钟
    retry: 1,
  });
}
