/**
 * 视觉分析 React Hook
 *
 * 提供视觉分析功能的前端封装
 * 包括状态管理、API 调用、错误处理
 *
 * 这是一个独立的插件模块，可单独引入或移除
 *
 * @version 1.0.0
 * @since 2025-12-06
 */

"use client";

import { useState, useCallback } from "react";
import type {
  VisionAnalysisStatus,
  BookmarkVisionData,
  VisionAnalyzeResponse,
  UseVisionAnalysisReturn,
} from "@/types/vision";

// ============================================
// Hook 实现
// ============================================

/**
 * 视觉分析 Hook
 *
 * @example
 * ```tsx
 * function BookmarkDetail({ bookmarkId }) {
 *   const { status, data, isLoading, analyze, error } = useVisionAnalysis();
 *
 *   return (
 *     <div>
 *       <button onClick={() => analyze(bookmarkId)} disabled={isLoading}>
 *         {isLoading ? '分析中...' : '开始视觉分析'}
 *       </button>
 *       {data && <VisionInsights data={data} />}
 *       {error && <p className="text-red-500">{error}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useVisionAnalysis(): UseVisionAnalysisReturn {
  const [status, setStatus] = useState<VisionAnalysisStatus>("idle");
  const [data, setData] = useState<BookmarkVisionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * 触发视觉分析
   */
  const analyze = useCallback(
    async (bookmarkId: number, imageUrls?: string[]): Promise<void> => {
      // 防止重复调用
      if (status === "analyzing") {
        return;
      }

      setStatus("analyzing");
      setError(null);

      try {
        const response = await fetch("/api/ai/vision-analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bookmarkId,
            imageUrls,
          }),
        });

        const result: VisionAnalyzeResponse = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "视觉分析失败");
        }

        if (result.data) {
          setData(result.data);
          setStatus("completed");
        } else {
          setStatus("failed");
          setError("未返回分析结果");
        }
      } catch (err) {
        setStatus("failed");
        setError(
          err instanceof Error ? err.message : "视觉分析失败，请稍后重试",
        );
      }
    },
    [status],
  );

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setStatus("idle");
    setData(null);
    setError(null);
  }, []);

  return {
    status,
    data,
    error,
    isLoading: status === "analyzing",
    analyze,
    reset,
  };
}

// ============================================
// 数据获取 Hook
// ============================================

/**
 * 获取书签的视觉分析数据 Hook
 *
 * @param bookmarkId - 书签 ID
 * @returns 视觉分析数据和加载状态
 *
 * @example
 * ```tsx
 * function BookmarkVision({ bookmarkId }) {
 *   const { data, isLoading, refetch } = useVisionData(bookmarkId);
 *
 *   if (isLoading) return <Skeleton />;
 *   if (!data) return null;
 *
 *   return <VisionInsights data={data} />;
 * }
 * ```
 */
export function useVisionData(bookmarkId: number | null) {
  const [data, setData] = useState<BookmarkVisionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取视觉分析数据
   */
  const fetchData = useCallback(async () => {
    if (!bookmarkId) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/ai/vision-analyze?bookmarkId=${bookmarkId}`,
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "获取数据失败");
      }

      setData(result.data?.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取视觉分析数据失败");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [bookmarkId]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

// ============================================
// 辅助 Hook
// ============================================

/**
 * 检查视觉分析服务是否可用
 * 用于条件渲染 UI
 */
export function useVisionServiceStatus() {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    try {
      // 简单检查：尝试发起请求，如果服务不可用会返回 503
      const response = await fetch("/api/ai/vision-analyze?bookmarkId=0");
      // 即使返回 400 或 404 也说明服务是可用的
      setIsAvailable(response.status !== 503);
    } catch {
      setIsAvailable(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  return {
    isAvailable,
    isChecking,
    checkStatus,
  };
}

export default useVisionAnalysis;
