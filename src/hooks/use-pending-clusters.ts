/**
 * V4.2 待聚类书签 Hook
 * 管理待聚类书签的获取、确认和拒绝操作
 */

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

interface ClusterBookmark {
  id: number;
  title: string;
  url: string;
  ai_summary: string | null;
  ai_tags: string[] | null;
  pending_since: string | null;
  cluster_confidence: number | null;
}

interface ClusterGroup {
  clusterId: string;
  bookmarks: ClusterBookmark[];
  suggestedName: string;
  confidence: number;
  commonTags: string[];
}

interface PendingClustersData {
  clusters: ClusterGroup[];
  unclustered: ClusterBookmark[];
  totalPending: number;
  clusterCount: number;
}

interface UsePendingClustersOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function usePendingClusters(options: UsePendingClustersOptions = {}) {
  const { autoRefresh = false, refreshInterval = 30000 } = options;

  const [data, setData] = useState<PendingClustersData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取待聚类数据
  const fetchClusters = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/classification/pending-clusters");

      if (!response.ok) {
        throw new Error("获取聚类数据失败");
      }

      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || "获取聚类数据失败");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "获取聚类数据失败";
      setError(message);
      console.error("[usePendingClusters] fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 确认聚类建议 - 创建新文件夹
  const confirmCluster = useCallback(
    async (
      clusterId: string,
      folderName: string,
      bookmarkIds: number[],
    ): Promise<boolean> => {
      setIsProcessing(true);
      try {
        const response = await fetch("/api/classification/pending-clusters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "confirm",
            clusterId,
            folderName,
            bookmarkIds,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "创建文件夹失败");
        }

        toast.success(`已创建文件夹「${folderName}」并移动 ${bookmarkIds.length} 个书签`);

        // 刷新数据
        await fetchClusters();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "操作失败";
        toast.error(message);
        console.error("[usePendingClusters] confirm error:", err);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [fetchClusters],
  );

  // 拒绝聚类建议
  const rejectCluster = useCallback(
    async (clusterId: string): Promise<boolean> => {
      setIsProcessing(true);
      try {
        const response = await fetch("/api/classification/pending-clusters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reject",
            clusterId,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "拒绝建议失败");
        }

        toast.success("已忽略该聚类建议");

        // 刷新数据
        await fetchClusters();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "操作失败";
        toast.error(message);
        console.error("[usePendingClusters] reject error:", err);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [fetchClusters],
  );

  // 手动移动单个书签
  const moveBookmark = useCallback(
    async (bookmarkId: number, folderId: number): Promise<boolean> => {
      setIsProcessing(true);
      try {
        const response = await fetch(`/api/bookmarks/${bookmarkId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folder_id: folderId,
            pending_cluster: false,
            pending_since: null,
            cluster_id: null,
            cluster_confidence: null,
          }),
        });

        if (!response.ok) {
          throw new Error("移动书签失败");
        }

        toast.success("书签已移动");

        // 刷新数据
        await fetchClusters();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "移动失败";
        toast.error(message);
        console.error("[usePendingClusters] move error:", err);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [fetchClusters],
  );

  // 初始加载
  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchClusters, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchClusters]);

  return {
    // 数据
    clusters: data?.clusters || [],
    unclustered: data?.unclustered || [],
    totalPending: data?.totalPending || 0,
    clusterCount: data?.clusterCount || 0,

    // 状态
    isLoading,
    isProcessing,
    error,

    // 操作
    refresh: fetchClusters,
    confirmCluster,
    rejectCluster,
    moveBookmark,
  };
}

export default usePendingClusters;
