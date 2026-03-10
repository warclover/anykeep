/**
 * V5.5 配额查询 Hook
 *
 * 获取用户的统一配额状态
 */

import { useQuery } from "@tanstack/react-query";
import type { UnifiedQuotaResult } from "@/lib/folder-quota";
import { folderQuotaKeys } from "@/hooks/queries/keys";
import { API_FOLDERS } from "@/lib/constants/api-paths";

async function fetchFolderQuota(): Promise<UnifiedQuotaResult> {
  const response = await fetch(API_FOLDERS.quota);

  if (!response.ok) {
    throw new Error("Failed to fetch quota");
  }

  return response.json();
}

/**
 * 获取文件夹配额状态
 */
export function useFolderQuota() {
  return useQuery({
    queryKey: folderQuotaKeys.all,
    queryFn: fetchFolderQuota,
    staleTime: 60 * 1000, // 1 分钟内不重新请求
    refetchOnWindowFocus: false,
  });
}

/**
 * 获取配额使用百分比
 */
export function useQuotaUsagePercent(): number {
  const { data } = useFolderQuota();

  if (!data || data.total.limit === 0) {
    return 0;
  }

  return Math.round((data.total.aiCreated / data.total.limit) * 100);
}
